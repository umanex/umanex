import { View, Text, StyleSheet } from 'react-native';
import type { PrEntry } from '@/lib/personalRecords';
import { prMetricLabel, formatPrValue, formatPrPrevious, prEntrySpoken } from '@/lib/prDisplay';
import { t } from '@/i18n';
import { achievement, bg, body, componentRadius, fg, fontSize, space, typeStyles } from '@/constants';

export type PrBannerProps = {
  /** De records die deze rit brak, met de waarde die ze vervingen. Leeg = de banner rendert niets. */
  prEntries: readonly PrEntry[];
};

/**
 * Eén regel per gebroken record: "Vermogen · 143 W" met daaronder wat het verving.
 *
 * Eerder stond hier één generieke zin, waardoor je wél las dát je een record brak maar niet
 * waarop.
 *
 * De rij is één a11y-stop met de volzin als label: los voorgelezen worden metriek, waarde en
 * vorige waarde drie losse fragmenten zonder verband.
 */
export function PrEntryRow({ entry }: { entry: PrEntry }) {
  return (
    <View testID="PrEntryRow" accessible accessibilityLabel={prEntrySpoken(entry)} style={styles.prEntryRow}>
      <Text style={styles.prEntryMetric}>{prMetricLabel(entry.metric)}</Text>
      <View style={styles.prEntryValues}>
        <Text style={styles.prEntryValue}>{formatPrValue(entry.metric, entry.value)}</Text>
        <Text style={styles.prEntryPrevious}>{formatPrPrevious(entry)}</Text>
      </View>
    </View>
  );
}

/**
 * Het vieringsblok bovenaan de samenvatting, zodra er een record gebroken is.
 *
 * Een VOLLEDIGE rand en niet alleen links: `bg.raised` is ook het vlak van de KPI-band
 * eronder, dus zonder eigen omtrek leest het vieringsmoment als een gewone sectie.
 */
export function PrBanner({ prEntries }: PrBannerProps) {
  if (prEntries.length === 0) return null;
  return (
    <View testID="PrBanner" style={styles.prWrapper}>
      <View style={styles.prBanner}>
        <View style={styles.prBannerTop}>
          <Text style={styles.prEmoji}>🏅</Text>
          <Text style={styles.prText}>
            {prEntries.length === 1 ? t.pr.bannerTitleOne : t.pr.bannerTitleMany(prEntries.length)}
          </Text>
        </View>
        {prEntries.map((entry) => <PrEntryRow key={entry.metric} entry={entry} />)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  prWrapper: {
    paddingHorizontal: space['20'],
  },
  prBanner: {
    // Was een rauwe rgba-amber — een hardcoded waarde zonder token. Nu de raised-rol met
    // een achievement-rand: dezelfde betekenis, dezelfde markering als het PR-blok op het
    // detailscherm, en geen nieuwe kleur nodig.
    backgroundColor: bg.raised,
    // TODO: geen borderWidth-token in constants/; een `achievement.surface`-rol zou hier
    // beter passen dan een rand — bespreken vóór er een derde plek bij komt.
    borderWidth: 2,
    borderColor: achievement.muted,
    borderRadius: componentRadius.highlightRow,
    padding: space['20'],
    gap: space['12'],
  },
  prBannerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space['8'],
  },
  prEmoji: {
    fontSize: fontSize['14'],
  },
  prText: {
    ...typeStyles.kpiUnit,
    color: achievement.default,
  },
  prEntryRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: space['12'],
  },
  prEntryMetric: {
    ...typeStyles.labelMicro,
    color: fg.secondary,
    paddingTop: space['4'],
    flexShrink: 1,
  },
  prEntryValues: {
    alignItems: 'flex-end',
    gap: space['2'],
    // Zie het PR-blok op het detailscherm: zonder shrink loopt de vorige-waarde-regel
    // buiten de banner, en wrappen kan hij niet.
    flexShrink: 1,
  },
  prEntryValue: {
    ...typeStyles.kpiValue,
    color: achievement.default,
  },
  prEntryPrevious: {
    // Volzin, dus body.xs — labelMicro kapitaliseerde de eenheden ('12,5 KM').
    ...body.xs,
    color: fg.tertiary,
    textAlign: 'right',
  },
});
