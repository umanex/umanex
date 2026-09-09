import { View, Text, StyleSheet } from 'react-native';
import type { ConnectionStatus, HRStatus } from '@/lib/ble/types';
import { BleStatusBar } from '@/components/BleStatusBar';
import { HrStatusBar } from '@/components/HrStatusBar';
import { t } from '@/i18n';
import { bg, border, fg, fontFamily, fontSize, radii, space, status, typeStyles } from '@/constants';
import { variantData } from '@/lib/variantData';

export type DeviceSectionProps = {
  bleStatus: ConnectionStatus;
  deviceName: string | null;
  onConnect: () => void;
  onDisconnect: () => void;
  hrStatus: HRStatus;
  hrDeviceName: string | null;
  /** Foutzin onder de kaart. `null` = geen fout, en dan neemt hij geen ruimte. */
  hrError: string | null;
  onHRConnect: () => void;
  onHRDisconnect: () => void;
};

/**
 * De TOESTELLEN-sectie van het startscherm: sectielabel, één omrande kaart met de twee
 * verbindingsrijen gescheiden door een hairline, en daaronder de foutzin.
 *
 * De sectie is de snede en niet de kaart alleen: het label en `hrError` horen bij hetzelfde
 * geheel. Een `DeviceCard` zou de twee rijen dekken en die twee buiten laten, waarna de
 * afzender opnieuw moet weten hoe ze zich tot de kaart verhouden.
 *
 * De rijen zelf zijn transparant — de kaart draagt de rand en de radius.
 *
 * De foutzin is niet cosmetisch: een mislukte hartslag-scan liet de rij gewoon terugvallen op
 * "Verbinden", zonder één woord uitleg, en dat is niet te onderscheiden van een dode knop.
 */
export function DeviceSection({
  bleStatus, deviceName, onConnect, onDisconnect,
  hrStatus, hrDeviceName, hrError, onHRConnect, onHRDisconnect,
}: DeviceSectionProps) {
  return (
    <View testID="DeviceSection" dataSet={variantData({ bleStatus, hrStatus })} style={styles.toestelSection}>
      <Text style={styles.sectionLabel}>{t.workout.idle.devicesLabel}</Text>
      <View style={styles.deviceCard}>
        <BleStatusBar
          bleStatus={bleStatus}
          deviceName={deviceName}
          onConnect={onConnect}
          onDisconnect={onDisconnect}
        />
        <View style={styles.deviceDivider} />
        <HrStatusBar
          hrStatus={hrStatus}
          hrDeviceName={hrDeviceName}
          onConnect={onHRConnect}
          onDisconnect={onHRDisconnect}
        />
      </View>
      {hrError ? <Text style={styles.deviceError}>{hrError}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  toestelSection: {
    gap: 8,
  },
  sectionLabel: {
    ...typeStyles.labelGoalPrefix,
    color: fg.tertiary,
  },
  // Grouped device card: one rounded container holding both rows, split by a
  // hairline divider. The rows themselves are transparent (DeviceRow).
  deviceCard: {
    backgroundColor: bg.elevated,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: border.default,
    overflow: 'hidden',
  },
  deviceDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: border.default,
  },
  deviceError: {
    fontFamily: fontFamily.albertSansRegular,
    fontSize: fontSize['13'],
    color: status.error,
    marginTop: space['8'],
  },
});
