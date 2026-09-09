import type { HRStatus } from '@/lib/ble/types';
import { accent, status } from '@/constants';
import { t } from '@/i18n';
import { DeviceRow } from './DeviceRow';
import { variantData } from '@/lib/variantData';

type HrStatusBarProps = {
  hrStatus: HRStatus;
  hrDeviceName: string | null;
  onConnect: () => void;
  onDisconnect: () => void;
};

export function HrStatusBar({ hrStatus, hrDeviceName, onConnect, onDisconnect }: HrStatusBarProps) {
  const isScanning = hrStatus === 'scanning';
  const isConnected = hrStatus === 'connected';

  // Verbonden, maar nog geen hartslag binnen. Bewust niet groen: groen betekent hier
  // "het werkt", en dat is precies wat we op dit moment niet weten. Verbreken blijft
  // beschikbaar, want dit is de stand waarin je een ándere band wil pakken.
  if (hrStatus === 'waiting') {
    return (
      <DeviceRow
        testID="HrStatusBar"
        dataSet={variantData({ hrStatus })}
        icon="heart"
        iconColor={status.warning}
        label={hrDeviceName || t.devices.heartRateMonitor}
        action={t.devices.disconnect}
        onPress={onDisconnect}
        loading
      />
    );
  }

  if (isConnected) {
    return (
      <DeviceRow
        testID="HrStatusBar"
        dataSet={variantData({ hrStatus })}
        icon="heart"
        iconColor={status.success}
        label={hrDeviceName || t.devices.hrConnected}
        action={t.devices.disconnect}
        onPress={onDisconnect}
      />
    );
  }

  if (isScanning) {
    return (
      <DeviceRow
        testID="HrStatusBar"
        dataSet={variantData({ hrStatus })}
        icon="heart"
        iconColor={accent.default}
        label={t.devices.heartRateMonitor}
        action={t.devices.searching}
        onPress={onConnect}
        loading
        actionDisabled
      />
    );
  }

  return (
    <DeviceRow
      testID="HrStatusBar"
        dataSet={variantData({ hrStatus })}
      icon="heart"
      iconColor={accent.default}
      label={t.devices.heartRateMonitor}
      action={t.devices.connect}
      onPress={onConnect}
    />
  );
}
