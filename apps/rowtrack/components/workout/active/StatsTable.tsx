import { View, Text, StyleSheet } from 'react-native';
import { bg, border, fg, radii, space, typeStyles } from '@/constants';

/** Eén regel: label, gemiddelde, piek. Beide waarden zijn al geformatteerd. */
export type StatsRow = { label: string; gem: string; piek: string };

export type StatsTableProps = {
  rows: readonly StatsRow[];
  /** Kop boven de gemiddelde-kolom. */
  colAvg: string;
  /** Kop boven de piek-kolom. */
  colPeak: string;
};

/**
 * De gem/piek-tabel van de samenvatting: kolomkoppen erboven, daaronder een omrand vlak met
 * een hairline tussen elke twee rijen.
 *
 * De labelkolom is 165 breed en NIET flexibel: de twee waardekolommen delen de rest gelijk, en
 * daardoor staan de cijfers van alle rijen onder elkaar. Met een flexibele labelkolom
 * verspringen ze per rij mee met de labellengte.
 */
export function StatsTable({ rows, colAvg, colPeak }: StatsTableProps) {
  return (
    <View testID="StatsTable" style={styles.statsSection}>
      <View style={styles.statsHeader}>
        <View style={styles.statsLabelCol} />
        <Text style={styles.statsColLabel}>{colAvg}</Text>
        <Text style={styles.statsColLabel}>{colPeak}</Text>
      </View>
      <View style={styles.statsTable}>
        {rows.map((row, i) => (
          <View key={row.label}>
            <View style={styles.statsRow}>
              <Text style={styles.statsRowLabel}>{row.label}</Text>
              <Text style={styles.statsRowValue}>{row.gem}</Text>
              <Text style={styles.statsRowValue}>{row.piek}</Text>
            </View>
            {i < rows.length - 1 && <View style={styles.statsRowDivider} />}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Stats-sectie (Frame 42 + 49)
  statsSection: {
    paddingHorizontal: space['20'],
    paddingVertical: space['28'],
    gap: space['8'],
  },
  statsHeader: {
    flexDirection: 'row',
    paddingHorizontal: space['16'],
  },
  statsLabelCol: {
    width: 165,
  },
  statsColLabel: {
    flex: 1,
    ...typeStyles.labelGoalPrefix,
    color: fg.tertiary,
  },
  statsTable: {
    backgroundColor: bg.raised,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: border.default,
    overflow: 'hidden',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space['16'],
    paddingVertical: space['16'],
  },
  statsRowLabel: {
    width: 165,
    ...typeStyles.labelGoalPrefix,
    color: fg.secondary,
  },
  statsRowValue: {
    flex: 1,
    ...typeStyles.kpiValue,
    color: fg.primary,
  },
  statsRowDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: border.default,
  },
});
