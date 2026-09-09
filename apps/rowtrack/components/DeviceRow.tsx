import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { accent, fg, radii, space, typeStyles } from '@/constants';

export type DeviceRowProps = {
  icon: 'dot' | 'heart';
  iconColor: string;
  label: string;
  action: string;
  onPress: () => void;
  loading?: boolean;
  actionDisabled?: boolean;
  /**
   * De OVERSCHRIJFBARE grens. Naast deze prop draagt de wortel ook `dataSet={{ bron:
   * 'DeviceRow' }}` — dat is de niet-overschrijfbare identiteit: `testID` zegt van wélk
   * component dit de wortel is, `data-bron` zegt welke code hem rendert.
   *
   * De componentgrens in de DOM. react-native-web schrijft hem als `data-testid`
   * (createDOMProps/index.js:831) en `scripts/figma-build-spec.mjs` leest hem terug, zodat de
   * laagnaam-pas een FEIT gebruikt in plaats van een sleutel-heuristiek. Een component dat
   * dit component ALS ZIJN EIGEN WORTEL rendert (BleStatusBar, HrStatusBar) geeft hier zijn
   * eigen naam mee — anders zou de grens van dat component nergens in de DOM staan.
   */
  testID?: string;
  /**
   * De variant-vingerafdruk van het component dat deze rij als zijn eigen wortel rendert.
   * Zelfde vorm als overal (`lib/variantData.ts`), maar hij moet hier langs een prop: de
   * wortel draagt al `dataSet={{ bron }}`, en twee `dataSet`-props op één node zouden elkaar
   * overschrijven. Zonder deze doorgifte kan de builder voor BleStatusBar en HrStatusBar
   * géén variant kiezen en bouwt hij de subboom na in plaats van te instantiëren — gemeten
   * 2026-09-09: 8 van de 8 voorkomens in de schermen.
   */
  dataSet?: Record<string, string>;
};

/**
 * One device line inside the TOESTELLEN card: left status icon + device
 * label, right an italic connect/disconnect verb with a bluetooth glyph.
 * Purely presentational — BleStatusBar / HrStatusBar map their connection
 * state onto these props. Carries no border/radius/background; the card
 * wrapper provides those and the divider between rows.
 */
export function DeviceRow({
  icon,
  iconColor,
  label,
  action,
  onPress,
  loading = false,
  actionDisabled = false,
  testID = 'DeviceRow',
  dataSet,
}: DeviceRowProps) {
  return (
    <View testID={testID} dataSet={{ bron: 'DeviceRow', ...dataSet }} style={styles.container}>
      <View style={styles.left}>
        <View style={styles.iconContainer}>
          {loading ? (
            <ActivityIndicator size="small" color={accent.default} />
          ) : icon === 'heart' ? (
            <Ionicons name="heart" size={14} color={iconColor} />
          ) : (
            <View style={[styles.dot, { backgroundColor: iconColor }]} />
          )}
        </View>
        <Text style={styles.label} numberOfLines={1} maxFontSizeMultiplier={1.3}>
          {label}
        </Text>
      </View>

      <TouchableOpacity
        style={styles.action}
        onPress={onPress}
        disabled={actionDisabled}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${action}`}
      >
        <Text style={styles.actionText} maxFontSizeMultiplier={1.3}>{action}</Text>
        <Ionicons name="bluetooth-outline" size={15} color={fg.secondary} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: space['48'],
    paddingLeft: space['16'],
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space['8'],
    flex: 1,
  },
  iconContainer: {
    width: space['16'],
    height: space['16'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: space['10'],
    height: space['10'],
    borderRadius: radii.full,
  },
  label: {
    ...typeStyles.kpiValue,
    color: fg.primary,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space['4'],
    height: '100%',
    paddingHorizontal: space['16'],
  },
  actionText: {
    ...typeStyles.textLink,
    // Actie-affordance in merk-accent (design cluster 7, 2026-07-14): Verbind/Verbreek
    // in accent-rood. De connected-STATUS blijft groen (verkeerslicht) — status ≠ actie.
    color: accent.default,
  },
});
