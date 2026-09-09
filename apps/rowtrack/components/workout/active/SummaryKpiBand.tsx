import { View, StyleSheet } from 'react-native';
import { KpiSingle } from '@/components/KpiSingle';
import { bg, border, space } from '@/constants';

/** Eén tegel: waarde, optionele eenheid, label eronder. */
export type SummaryKpi = { value: string; unit?: string; label: string };

export type SummaryKpiBandProps = {
  /** Exact vier tegels: twee rijen van twee, met een hairline ertussen. */
  kpis: [SummaryKpi, SummaryKpi, SummaryKpi, SummaryKpi];
};

/**
 * De KPI-band van de samenvatting: vier tegels op een volle-breedte `bg.raised` vlak.
 *
 * De tuple van vier is geen willekeurige beperking maar de vorm van het ontwerp (KPI Row-frame,
 * Figma 43-8278): twee rijen van twee, met een hairline op de scheiding. Een `SummaryKpi[]`
 * zou een derde rij toelaten die nergens bestaat.
 */
export function SummaryKpiBand({ kpis }: SummaryKpiBandProps) {
  const [a, b, c, d] = kpis;
  return (
    <View testID="SummaryKpiBand" style={styles.kpiBand}>
      <View style={styles.kpiRow}>
        <KpiSingle value={a.value} unit={a.unit} label={a.label} style={styles.kpiCell} />
        <KpiSingle value={b.value} unit={b.unit} label={b.label} style={styles.kpiCell} />
      </View>
      <View style={styles.kpiBandDivider} />
      <View style={styles.kpiRow}>
        <KpiSingle value={c.value} unit={c.unit} label={c.label} style={styles.kpiCell} />
        <KpiSingle value={d.value} unit={d.unit} label={d.label} style={styles.kpiCell} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Volle-breedte bg.raised band (KPI Row-frame).
  kpiBand: {
    backgroundColor: bg.raised,
    paddingHorizontal: space['20'],
  },
  kpiRow: {
    flexDirection: 'row',
    paddingVertical: space['20'],
    gap: space['20'],
  },
  kpiCell: {
    flex: 1,
  },
  kpiBandDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: border.strong,
  },
});
