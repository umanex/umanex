import type {
  BleManager,
  Device,
  Subscription,
} from 'react-native-ble-plx';
import { Platform, PermissionsAndroid } from 'react-native';
import {
  FTMS_SERVICE_UUID,
  ROWER_DATA_UUID,
  ROWER_DATA_ALT_UUID,
  ROWER_NAME_PREFIX,
  SCAN_TIMEOUT_MS,
  RECONNECT_DELAY_MS,
  MAX_RECONNECT_ATTEMPTS,
} from './constants';
import { parseRowerData } from './ftms-parser';
import type { RowerMetrics, ConnectionStatus } from './types';

const log: (...args: unknown[]) => void = __DEV__
  ? (...args: unknown[]) => console.log('[BLE]', ...args)
  : () => {};

/** Return a RowerMetrics with all fields null. */
function emptyMetrics(): RowerMetrics {
  return {
    strokeRate: null, strokeCount: null, totalDistance: null,
    instantaneousPace: null, averagePace: null,
    instantaneousPower: null, averagePower: null,
    resistanceLevel: null,
    heartRate: null, metabolicEquivalent: null,
    elapsedTime: null, remainingTime: null,
  };
}

/** Merge non-null fields from `incoming` into `base`, return new object. */
function mergeMetrics(base: RowerMetrics, incoming: RowerMetrics): RowerMetrics {
  const merged = { ...base };
  for (const key of Object.keys(incoming) as (keyof RowerMetrics)[]) {
    if (incoming[key] !== null) {
      (merged as Record<string, unknown>)[key] = incoming[key];
    }
  }
  return merged;
}

type StatusListener = (
  status: ConnectionStatus,
  error?: string,
  deviceName?: string,
) => void;
type MetricsListener = (metrics: RowerMetrics) => void;

let blePlxModule: typeof import('react-native-ble-plx') | null = null;

async function loadBlePlx() {
  if (!blePlxModule) {
    blePlxModule = await import('react-native-ble-plx');
  }
  return blePlxModule;
}

export class RowerBleService {
  private manager: BleManager | null = null;
  private device: Device | null = null;
  private monitorSub: Subscription | null = null;
  private stateSub: Subscription | null = null;
  private scanTimeout: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private intentionalDisconnect = false;
  private isConnecting = false;

  private lastMetrics: RowerMetrics = emptyMetrics();
  private onStatusChange: StatusListener;
  private onMetrics: MetricsListener;

  constructor(onStatusChange: StatusListener, onMetrics: MetricsListener) {
    this.onStatusChange = onStatusChange;
    this.onMetrics = onMetrics;
  }

  private async getManager(): Promise<BleManager> {
    if (!this.manager) {
      const { BleManager: BM } = await loadBlePlx();
      this.manager = new BM();
    }
    return this.manager;
  }

  // ── Public API ────────────────────────────────────────────

  async startScan(): Promise<void> {
    this.intentionalDisconnect = false;
    this.reconnectAttempts = 0;
    this.lastMetrics = emptyMetrics();
    this.onStatusChange('scanning');

    try {
      const { State } = await loadBlePlx();
      const manager = await this.getManager();
      const state = await manager.state();
      log(' adapter state:', state);

      if (state !== State.PoweredOn) {
        if (state === State.PoweredOff) {
          this.onStatusChange('error', 'Bluetooth staat uit. Schakel Bluetooth in.');
          return;
        }
        if (state === State.Unauthorized) {
          this.onStatusChange('error', 'Bluetooth toestemming is vereist.');
          return;
        }
        this.stateSub = manager.onStateChange((s) => {
          if (s === State.PoweredOn) {
            this.stateSub?.remove();
            this.stateSub = null;
            this.startScan();
          }
        }, true);
        return;
      }

      if (Platform.OS === 'android') {
        const ok = await this.requestAndroidPermissions();
        if (!ok) {
          this.onStatusChange('error', 'Bluetooth toestemming geweigerd.');
          return;
        }
      }

      this.scanTimeout = setTimeout(() => {
        manager.stopDeviceScan();
        this.onStatusChange('error', 'Geen roeier gevonden. Controleer of de roeier aan staat.');
      }, SCAN_TIMEOUT_MS);

      log(' scan started (filter: name prefix "' + ROWER_NAME_PREFIX + '")');
      manager.startDeviceScan(null, null, (err, dev) => {
        if (err) {
          this.clearScanTimeout();
          log(' scan error:', err.message);
          this.onStatusChange('error', `Scanfout: ${err.message}`);
          return;
        }
        if (!dev) return;

        // Log every device for debugging
        if (dev.name || dev.localName) {
          log(' found:', dev.name, dev.localName, dev.id);
        }

        if (
          dev.name?.startsWith(ROWER_NAME_PREFIX) ||
          dev.localName?.startsWith(ROWER_NAME_PREFIX)
        ) {
          this.clearScanTimeout();
          manager.stopDeviceScan();
          this.connectToDevice(dev);
        }
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'BLE scan mislukt';
      log(' startScan error:', msg);
      this.onStatusChange('error', msg);
    }
  }

  async disconnect(): Promise<void> {
    this.intentionalDisconnect = true;
    this.onStatusChange('disconnecting');
    this.cleanup();

    try {
      if (this.device) {
        await this.device.cancelConnection();
      }
    } catch {
      // ignore
    }

    this.device = null;
    this.onStatusChange('idle');
  }

  destroy(): void {
    this.intentionalDisconnect = true;
    this.cleanup();
    this.device = null;
    this.manager?.destroy();
    this.manager = null;
  }

  // ── Private ───────────────────────────────────────────────

  private async connectToDevice(device: Device): Promise<void> {
    if (this.isConnecting) {
      log(' connectToDevice skipped — already connecting');
      return;
    }
    this.isConnecting = true;
    const name = device.name || device.localName || 'Rower';
    this.onStatusChange('connecting', undefined, name);

    try {
      const manager = await this.getManager();

      log(' connecting:', device.id, name);
      const connected = await manager.connectToDevice(device.id, {
        requestMTU: 512,
      });
      log(' connected:', connected.id);
      this.device = connected;

      // Wait for BLE stack to settle
      await this.delay(2000);

      this.onStatusChange('discovering', undefined, name);
      await connected.discoverAllServicesAndCharacteristics();

      // Log discovered services
      const services = await connected.services();
      for (const svc of services) {
        const chars = await svc.characteristics();
        log(' service:', svc.uuid, '→', chars.map((c) => c.uuid).join(', '));
      }

      await this.delay(1000);

      // Start notifications — try 2AD1 first, fallback to 2ACC
      this.startMonitoring(connected);

      // Listen for unexpected disconnect
      connected.onDisconnected((err) => {
        log(' disconnected, intentional:', this.intentionalDisconnect, 'error:', err?.message);
        if (!this.intentionalDisconnect) {
          this.handleDisconnect();
        }
      });

      this.onStatusChange('connected', undefined, name);
      this.isConnecting = false;
    } catch (e: unknown) {
      this.isConnecting = false;
      const bleErr = e as { message?: string; errorCode?: number };
      log(' connect error:', bleErr.message, 'code:', bleErr.errorCode);
      this.onStatusChange('error', bleErr.message || 'Verbinding mislukt');
    }
  }


  private startMonitoring(device: Device, charUuid = ROWER_DATA_UUID): void {
    log(' subscribing to notifications:', charUuid);

    this.monitorSub = device.monitorCharacteristicForService(
      FTMS_SERVICE_UUID,
      charUuid,
      (error, char) => {
        if (error) {
          const bleErr = error as unknown as { message?: string; errorCode?: number };
          log(' monitor error on', charUuid, ':', bleErr.message, 'code:', bleErr.errorCode);

          // 403 on primary → try fallback characteristic
          if (bleErr.errorCode === 403 && charUuid === ROWER_DATA_UUID) {
            log(' 403 on 2AD1, trying fallback 2ACC');
            this.monitorSub?.remove();
            this.monitorSub = null;
            setTimeout(() => {
              if (!this.intentionalDisconnect) {
                this.startMonitoring(device, ROWER_DATA_ALT_UUID);
              }
            }, 2_000);
            return;
          }

          // 403 on fallback too → give up
          if (bleErr.errorCode === 403) {
            log(' 403 on both characteristics');
            this.onStatusChange('error', 'Kan geen data ontvangen. Herstart de app.');
            return;
          }

          if (!this.intentionalDisconnect) {
            this.handleDisconnect();
          }
          return;
        }

        if (!char?.value) return;

        log(' notification received on', charUuid);
        try {
          const parsed = parseRowerData(char.value);
          this.lastMetrics = mergeMetrics(this.lastMetrics, parsed);

          // When rower is idle (spm=0, watts=0), clear stale pace values
          if (
            this.lastMetrics.strokeRate === 0 &&
            this.lastMetrics.instantaneousPower === 0
          ) {
            this.lastMetrics.strokeRate = null;
            this.lastMetrics.instantaneousPower = null;
            this.lastMetrics.instantaneousPace = null;
          }

          this.onMetrics(this.lastMetrics);
        } catch (e) {
          log('parse error:', e);
        }
      },
      'rower-data',
    );
  }

  private handleDisconnect(): void {
    this.monitorSub?.remove();
    this.monitorSub = null;

    if (this.intentionalDisconnect) {
      this.onStatusChange('idle');
      return;
    }

    this.attemptReconnect();
  }

  private async attemptReconnect(): Promise<void> {
    if (this.intentionalDisconnect) return;

    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      this.onStatusChange('error', 'Verbinding verloren. Probeer opnieuw.');
      this.cleanup();
      this.device = null;
      return;
    }

    this.reconnectAttempts++;
    log(' reconnect', this.reconnectAttempts, '/', MAX_RECONNECT_ATTEMPTS);
    this.onStatusChange('reconnecting');

    await this.delay(RECONNECT_DELAY_MS);

    if (this.device && !this.intentionalDisconnect) {
      try {
        await this.connectToDevice(this.device);
        this.reconnectAttempts = 0;
      } catch (e: unknown) {
        const bleErr = e as { message?: string };
        log(' reconnect failed:', bleErr.message);
        this.attemptReconnect();
      }
    }
  }

  private async requestAndroidPermissions(): Promise<boolean> {
    try {
      const results = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      ]);
      return Object.values(results).every(
        (r) => r === PermissionsAndroid.RESULTS.GRANTED,
      );
    } catch {
      return false;
    }
  }

  private clearScanTimeout(): void {
    if (this.scanTimeout) {
      clearTimeout(this.scanTimeout);
      this.scanTimeout = null;
    }
  }

  private cleanup(): void {
    this.clearScanTimeout();
    this.monitorSub?.remove();
    this.monitorSub = null;
    this.stateSub?.remove();
    this.stateSub = null;
    this.isConnecting = false;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
