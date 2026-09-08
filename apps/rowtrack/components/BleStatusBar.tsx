import type { ConnectionStatus } from '@/lib/ble/types';
import { accent, status } from '@/constants';
import { t } from '@/i18n';
import { DeviceRow } from './DeviceRow';

type BleStatusBarProps = {
  bleStatus: ConnectionStatus;
  deviceName: string | null;
  onConnect: () => void;
  onDisconnect: () => void;
};

export function BleStatusBar({ bleStatus, deviceName, onConnect, onDisconnect }: BleStatusBarProps) {
  const isConnecting = bleStatus === 'scanning' || bleStatus === 'connecting' || bleStatus === 'discovering';
  const isConnected = bleStatus === 'connected';
  const isError = bleStatus === 'error';

  if (isConnected) {
    return (
      <DeviceRow
        testID="BleStatusBar"
        icon="dot"
        iconColor={status.success}
        label={deviceName || t.devices.rowerConnected}
        action={t.devices.disconnect}
        onPress={onDisconnect}
      />
    );
  }

  if (isConnecting) {
    return (
      <DeviceRow
        testID="BleStatusBar"
        icon="dot"
        iconColor={accent.default}
        label={t.devices.rower}
        action={t.devices.connecting}
        onPress={onConnect}
        loading
        actionDisabled
      />
    );
  }

  if (isError) {
    return (
      <DeviceRow
        testID="BleStatusBar"
        icon="dot"
        iconColor={status.error}
        label={t.devices.rower}
        action={t.devices.retry}
        onPress={onConnect}
      />
    );
  }

  return (
    <DeviceRow
      testID="BleStatusBar"
      icon="dot"
      iconColor={accent.default}
      label={t.devices.rower}
      action={t.devices.connect}
      onPress={onConnect}
    />
  );
}
