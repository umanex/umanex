import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { RowerBleService } from './ble-service';
import { HRBleService } from './hr-service';
import type { BleContextValue, ConnectionStatus, HRFoundDevice, HRStatus, RowerMetrics } from './types';

const BleContext = createContext<BleContextValue>({
  status: 'idle',
  deviceName: null,
  metrics: null,
  error: null,
  startScan: () => {},
  disconnect: () => {},
  hrStatus: 'idle',
  hrDeviceName: null,
  hrBpm: null,
  startHRScan: () => {},
  stopHR: () => {},
  hrDevices: [],
  hrSelecting: false,
  selectHRDevice: () => {},
  cancelHRSelection: () => {},
});

export function BleProvider({ children }: { children: React.ReactNode }) {
  // Rower state
  const [status, setStatus] = useState<ConnectionStatus>('idle');
  const [deviceName, setDeviceName] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<RowerMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const serviceRef = useRef<RowerBleService | null>(null);

  // HR state
  const [hrStatus, setHRStatus] = useState<HRStatus>('idle');
  const [hrDeviceName, setHRDeviceName] = useState<string | null>(null);
  const [hrBpm, setHRBpm] = useState<number | null>(null);
  const [hrDevices, setHRDevices] = useState<HRFoundDevice[]>([]);
  const [hrSelecting, setHRSelecting] = useState(false);
  const hrServiceRef = useRef<HRBleService | null>(null);

  useEffect(() => {
    // Rower service
    const service = new RowerBleService(
      (newStatus, errorMsg, name) => {
        setStatus(newStatus);
        setError(errorMsg ?? null);
        if (name) setDeviceName(name);
        if (newStatus === 'idle') {
          setMetrics(null);
          setDeviceName(null);
        }
      },
      (newMetrics) => {
        setMetrics(newMetrics);
      },
    );
    serviceRef.current = service;

    // HR service
    const hrService = new HRBleService(
      (newStatus, errorMsg, name) => {
        setHRStatus(newStatus);
        if (name) setHRDeviceName(name);
        if (newStatus === 'idle') {
          setHRBpm(null);
          setHRDeviceName(null);
        }
        if (newStatus === 'error' && errorMsg) {
          // HR errors are non-blocking, just log
          if (__DEV__) console.log('[HR] error:', errorMsg);
        }
      },
      (bpm) => {
        setHRBpm(bpm);
      },
      (devices) => {
        setHRDevices(devices);
        setHRSelecting(true);
      },
    );
    hrServiceRef.current = hrService;

    return () => {
      service.destroy();
      serviceRef.current = null;
      hrService.destroy();
      hrServiceRef.current = null;
    };
  }, []);

  // Rower controls
  const startScan = useCallback(() => {
    setError(null);
    serviceRef.current?.startScan().catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : 'BLE scan mislukt';
      setStatus('error');
      setError(msg);
    });
  }, []);

  const disconnect = useCallback(() => {
    serviceRef.current?.disconnect();
  }, []);

  // HR controls
  const startHRScan = useCallback(() => {
    hrServiceRef.current?.startScan().catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : 'HR scan mislukt';
      setHRStatus('error');
      if (__DEV__) console.log('[HR] scan error:', msg);
    });
  }, []);

  const stopHR = useCallback(() => {
    hrServiceRef.current?.stop();
  }, []);

  const selectHRDevice = useCallback((deviceId: string) => {
    const device = hrDevices.find((d) => d.id === deviceId);
    setHRSelecting(false);
    setHRDevices([]);
    hrServiceRef.current?.connectToDeviceById(deviceId, device?.name);
  }, [hrDevices]);

  const cancelHRSelection = useCallback(() => {
    setHRSelecting(false);
    setHRDevices([]);
    setHRStatus('idle');
  }, []);

  return (
    <BleContext.Provider
      value={{
        status, deviceName, metrics, error, startScan, disconnect,
        hrStatus, hrDeviceName, hrBpm, startHRScan, stopHR,
        hrDevices, hrSelecting, selectHRDevice, cancelHRSelection,
      }}
    >
      {children}
    </BleContext.Provider>
  );
}

export function useBle() {
  return useContext(BleContext);
}
