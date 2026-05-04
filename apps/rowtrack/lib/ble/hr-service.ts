import type {
  BleManager,
  Device,
  Subscription,
} from 'react-native-ble-plx';
import { Platform, PermissionsAndroid } from 'react-native';
import { base64ToBytes } from './base64';

const log: (...args: unknown[]) => void = __DEV__
  ? (...args: unknown[]) => console.log('[HR]', ...args)
  : () => {};

/** Standard BLE Heart Rate Service */
const HR_SERVICE_UUID = '0000180d-0000-1000-8000-00805f9b34fb';
/** Heart Rate Measurement Characteristic (notify) */
const HR_MEASUREMENT_UUID = '00002a37-0000-1000-8000-00805f9b34fb';

const SCAN_COLLECT_MS = 5_000;

export type HRStatus = 'idle' | 'scanning' | 'connected' | 'error';

export interface HRFoundDevice {
  id: string;
  name: string;
  rssi: number;
}

let blePlxModule: typeof import('react-native-ble-plx') | null = null;

async function loadBlePlx() {
  if (!blePlxModule) {
    blePlxModule = await import('react-native-ble-plx');
  }
  return blePlxModule;
}

type StatusListener = (
  status: HRStatus,
  error?: string,
  deviceName?: string,
) => void;
type HRListener = (bpm: number) => void;
type DevicesFoundListener = (devices: HRFoundDevice[]) => void;

export class HRBleService {
  private manager: BleManager | null = null;
  private device: Device | null = null;
  private monitorSub: Subscription | null = null;
  private scanTimeout: ReturnType<typeof setTimeout> | null = null;
  private intentionalDisconnect = false;

  private onStatusChange: StatusListener;
  private onHR: HRListener;
  private onDevicesFound: DevicesFoundListener | null;

  constructor(onStatusChange: StatusListener, onHR: HRListener, onDevicesFound?: DevicesFoundListener) {
    this.onStatusChange = onStatusChange;
    this.onHR = onHR;
    this.onDevicesFound = onDevicesFound ?? null;
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
    this.onStatusChange('scanning');

    try {
      const { State } = await loadBlePlx();
      const manager = await this.getManager();
      const state = await manager.state();

      if (state !== State.PoweredOn) {
        this.onStatusChange('error', 'Bluetooth staat uit.');
        return;
      }

      if (Platform.OS === 'android') {
        const ok = await this.requestAndroidPermissions();
        if (!ok) {
          this.onStatusChange('error', 'Bluetooth toestemming geweigerd.');
          return;
        }
      }

      const foundDevices: HRFoundDevice[] = [];
      const seenIds = new Set<string>();

      this.scanTimeout = setTimeout(() => {
        manager.stopDeviceScan();
        this.handleScanComplete(foundDevices);
      }, SCAN_COLLECT_MS);

      log('scan started (filter: service 0x180D, collecting for 5s)');
      manager.startDeviceScan([HR_SERVICE_UUID], null, (err, dev) => {
        if (err) {
          this.clearScanTimeout();
          log('scan error:', err.message);
          this.onStatusChange('error', `Scanfout: ${err.message}`);
          return;
        }
        if (!dev) return;

        const name = dev.name || dev.localName;
        if (!name || seenIds.has(dev.id)) return;

        seenIds.add(dev.id);
        log('found HR device:', name, dev.id, 'rssi:', dev.rssi);
        foundDevices.push({ id: dev.id, name, rssi: dev.rssi ?? -100 });
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'HR scan mislukt';
      log('startScan error:', msg);
      this.onStatusChange('error', msg);
    }
  }

  private handleScanComplete(devices: HRFoundDevice[]): void {
    if (devices.length === 0) {
      this.onStatusChange('error', 'Geen hartslagmeter gevonden.');
    } else if (devices.length === 1) {
      // Single device: connect automatically
      this.connectToDeviceById(devices[0].id, devices[0].name);
    } else {
      // Multiple devices: let user choose
      log('multiple HR devices found:', devices.length);
      this.onDevicesFound?.(devices);
    }
  }

  async connectToDeviceById(deviceId: string, name?: string): Promise<void> {
    try {
      const manager = await this.getManager();
      const device = await manager.connectToDevice(deviceId);
      this.device = device;
      const deviceName = name || device.name || device.localName || 'HR Monitor';

      await device.discoverAllServicesAndCharacteristics();

      this.monitorSub = device.monitorCharacteristicForService(
        HR_SERVICE_UUID,
        HR_MEASUREMENT_UUID,
        (error, char) => {
          if (error) {
            log('monitor error:', error.message);
            if (!this.intentionalDisconnect) {
              this.onStatusChange('error', 'HR verbinding verloren.');
            }
            return;
          }
          if (!char?.value) return;
          const bpm = this.parseHRMeasurement(char.value);
          if (bpm >= 30 && bpm <= 220) {
            this.onHR(bpm);
          }
        },
        'hr-measurement',
      );

      device.onDisconnected(() => {
        log('disconnected, intentional:', this.intentionalDisconnect);
        if (!this.intentionalDisconnect) {
          this.cleanup();
          this.device = null;
          this.onStatusChange('error', 'HR verbinding verloren.');
        }
      });

      this.onStatusChange('connected', undefined, deviceName);
      log('connected:', deviceName);
    } catch (e: unknown) {
      const bleErr = e as { message?: string };
      log('connect error:', bleErr.message);
      this.onStatusChange('error', bleErr.message || 'HR verbinding mislukt');
    }
  }

  stop(): void {
    this.intentionalDisconnect = true;
    this.cleanup();
    if (this.device) {
      this.device.cancelConnection().catch(() => {});
      this.device = null;
    }
    this.onStatusChange('idle');
  }

  destroy(): void {
    this.stop();
    this.manager?.destroy();
    this.manager = null;
  }

  // ── Private ───────────────────────────────────────────────

  private parseHRMeasurement(base64: string): number {
    const data = base64ToBytes(base64);
    if (data.length < 2) return 0;

    const flags = data[0];
    // Bit 0 = 0: HR is uint8 (byte 1)
    // Bit 0 = 1: HR is uint16 LE (bytes 1-2)
    if (flags & 1) {
      if (data.length < 3) return 0;
      return data[1] | (data[2] << 8);
    }
    return data[1];
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
  }
}
