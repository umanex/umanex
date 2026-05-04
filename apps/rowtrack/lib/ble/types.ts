export type ConnectionStatus =
  | 'idle'
  | 'scanning'
  | 'connecting'
  | 'discovering'
  | 'connected'
  | 'disconnecting'
  | 'reconnecting'
  | 'error';

export interface RowerMetrics {
  strokeRate: number | null;
  strokeCount: number | null;
  totalDistance: number | null;
  instantaneousPace: number | null;
  averagePace: number | null;
  instantaneousPower: number | null;
  averagePower: number | null;
  resistanceLevel: number | null;
  heartRate: number | null;
  metabolicEquivalent: number | null;
  elapsedTime: number | null;
  remainingTime: number | null;
}

export type HRStatus = 'idle' | 'scanning' | 'connected' | 'error';

export interface HRFoundDevice {
  id: string;
  name: string;
  rssi: number;
}

export interface BleContextValue {
  status: ConnectionStatus;
  deviceName: string | null;
  metrics: RowerMetrics | null;
  error: string | null;
  startScan: () => void;
  disconnect: () => void;
  // HR monitor
  hrStatus: HRStatus;
  hrDeviceName: string | null;
  hrBpm: number | null;
  startHRScan: () => void;
  stopHR: () => void;
  hrDevices: HRFoundDevice[];
  hrSelecting: boolean;
  selectHRDevice: (deviceId: string) => void;
  cancelHRSelection: () => void;
}

export type DataSource = 'ble';
