import { Modal, View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { FoundDevice } from '@/lib/ble/types';
import { t } from '@/i18n';
import {
  bg,
  fg,
  accent,
  status,
  overlay,
  fontFamily,
  fontSize,
  space,
  componentRadius,
} from '@/constants';

export type DeviceSelectionKind = 'rower' | 'hr';

type Props = {
  visible: boolean;
  kind: DeviceSelectionKind;
  devices: FoundDevice[];
  onSelect: (deviceId: string) => void;
  onCancel: () => void;
};

/**
 * Ruwe RSSI → een label dat iets zegt over waar je het toestel moet leggen.
 * Kleuren en grenzen ongewijzigd t.o.v. de inline versie waar dit uit komt:
 * -80 hoort nog bij "Goed", en "Goed" is accent, geen waarschuwing.
 */
function signalLabel(rssi: number): { text: string; color: string } {
  if (rssi > -60) return { text: t.workout.deviceModal.signalStrong, color: status.success };
  if (rssi >= -80) return { text: t.workout.deviceModal.signalGood, color: accent.default };
  return { text: t.workout.deviceModal.signalWeak, color: status.error };
}

/**
 * Keuzelijst wanneer een scan meerdere toestellen oplevert. Gedeeld door de
 * roeitrainer en de hartslagmeter: met twee machines in één ruimte pakte de app
 * voorheen blind de eerste die "Rower" heette.
 */
export const DeviceSelectionModal = ({ visible, kind, devices, onSelect, onCancel }: Props) => (
  <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
    <View testID="DeviceSelectionModal" style={styles.backdrop}>
      <View style={styles.sheet}>
        <Text style={styles.title}>
          {kind === 'rower' ? t.workout.deviceModal.titleRower : t.workout.deviceModal.titleHr}
        </Text>

        <FlatList
          data={devices}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const signal = signalLabel(item.rssi);
            return (
              <TouchableOpacity
                onPress={() => onSelect(item.id)}
                style={styles.deviceRow}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={item.name}
              >
                <View style={styles.deviceLabel}>
                  <Ionicons
                    name={kind === 'rower' ? 'boat' : 'heart'}
                    size={18}
                    color={accent.default}
                  />
                  <Text style={styles.deviceName} numberOfLines={1}>{item.name}</Text>
                </View>
                <Text style={[styles.deviceSignal, { color: signal.color }]}>{signal.text}</Text>
              </TouchableOpacity>
            );
          }}
        />

        <TouchableOpacity
          onPress={onCancel}
          style={styles.cancelBtn}
          accessibilityRole="button"
        >
          <Text style={styles.cancelText}>{t.common.cancel}</Text>
        </TouchableOpacity>
      </View>
    </View>
  </Modal>
);

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: overlay.scrim,
  },
  sheet: {
    backgroundColor: bg.elevated,
    borderTopLeftRadius: componentRadius.modal,
    borderTopRightRadius: componentRadius.modal,
    paddingTop: space['24'],
    paddingBottom: space['40'],
    paddingHorizontal: space['20'],
  },
  title: {
    color: fg.primary,
    fontSize: fontSize['18'],
    fontFamily: fontFamily.displayBold,
    marginBottom: space['16'],
    textAlign: 'center',
  },
  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space['12'],
    backgroundColor: bg.raised,
    borderRadius: componentRadius.cardSm,
    paddingHorizontal: space['16'],
    paddingVertical: space['14'],
    marginBottom: space['8'],
    minHeight: space['48'],
  },
  deviceLabel: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space['10'],
  },
  deviceName: {
    flex: 1,
    color: fg.primary,
    fontSize: fontSize['15'],
    fontFamily: fontFamily.albertSansMedium,
  },
  deviceSignal: {
    fontSize: fontSize['13'],
    fontFamily: fontFamily.albertSansMedium,
  },
  cancelBtn: {
    marginTop: space['8'],
    paddingVertical: space['14'],
    borderRadius: componentRadius.cardSm,
    alignItems: 'center',
  },
  cancelText: {
    color: fg.tertiary,
    fontSize: fontSize['15'],
    fontFamily: fontFamily.albertSansSemiBold,
  },
});
