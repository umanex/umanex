import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { border, fg, fontFamily, fontSize } from '@/constants';

export type KpiRowProps = {
  label: string;
  /** De waarde als tekst. Wordt genegeerd zolang `loading` waar is. */
  value: string;
  /**
   * `true` in landscape: de rijen verdelen de kolomhoogte onder elkaar. `false` in portrait:
   * elke rij is 56 hoog. Een `minHeight` van 44 houdt de tikbare rij boven de raakdrempel.
   */
  fill?: boolean;
  /** Hairline onder de rij. De laatste rij van een lijst heeft er geen. */
  divider?: boolean;
  /** Zonder handler is de rij een gewone View — geen lege raakzone en geen a11y-knop. */
  onPress?: () => void;
  disabled?: boolean;
  /** Toont een spinner in plaats van de waarde. Alleen zinvol op een tikbare rij. */
  loading?: boolean;
};

/**
 * Eén rij van de KPI-lijst op het active-scherm: label links, waarde rechts, hairline eronder.
 *
 * Gedeeld portrait/landscape — het verschil zit in `fill`. De rij is alleen een
 * `TouchableOpacity` wanneer er een handler is: een tikbare rij zonder gedrag is voor
 * VoiceOver een knop die niets doet.
 */
export function KpiRow({ label, value, fill = false, divider = false, onPress, disabled = false, loading = false }: KpiRowProps) {
  const stijl = [styles.kpiRow, fill ? styles.kpiRowFill : styles.kpiRowFixed, divider && styles.kpiRowDivider];
  const inhoud = (
    <>
      <Text style={styles.kpiLabel}>{label}</Text>
      {loading ? <ActivityIndicator size="small" color={fg.secondary} /> : <Text style={styles.kpiValue}>{value}</Text>}
    </>
  );
  if (!onPress) return <View testID="KpiRow" style={stijl}>{inhoud}</View>;
  return (
    <TouchableOpacity testID="KpiRow" style={stijl} onPress={onPress} disabled={disabled} activeOpacity={0.8}>
      {inhoud}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  kpiRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  kpiRowFixed: {
    height: 56,
  },
  kpiRowFill: {
    flex: 1,
    minHeight: 44,
  },
  kpiRowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: border.default,
  },
  kpiLabel: {
    fontFamily: fontFamily.albertSansLight,
    fontSize: fontSize['22'],
    letterSpacing: 1.1, // 5% van 22
    color: fg.secondary,
  },
  kpiValue: {
    fontFamily: fontFamily.albertSansMedium,
    fontSize: fontSize['28'],
    letterSpacing: -0.7, // -2.5% van 28
    color: fg.primary,
  },
});
