import { memo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Dot } from './Dot';
import { PrBadge } from './PrBadge';
import { prRowLabel, prAccessibilityLabel } from '@/lib/prDisplay';
import type { PrEntry } from '@/lib/personalRecords';
import { t } from '@/i18n';
import { formatInt } from '@/lib/formatters';
import { bg, fg, accent, space, typeStyles } from '@/constants';

function fmtDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const isToday =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();
  if (isToday) return t.dates.today;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    d.getDate() === yesterday.getDate() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getFullYear() === yesterday.getFullYear();
  if (isYesterday) return t.dates.yesterday;
  return `${d.getDate()} ${t.dates.monthsShort[d.getMonth()]} ${d.getFullYear()}`;
}

function fmtDuration(sec: number | null): { value: string; unit: string } | null {
  if (sec == null) return null;
  // Eerst afronden, dán splitsen: op de losse rest landt 119,6 s als '1:60'.
  const total = Math.round(sec);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return { value: `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`, unit: t.units.hourLong };
  // Onder de minuut is '0:17 min' twee keer fout: het getal leest als een decimaal
  // en de eenheid klopt niet. Seconden krijgen hun eigen eenheid.
  if (total < 60) return { value: `${total}`, unit: t.units.secondShort };
  return { value: `${m}:${String(s).padStart(2, '0')}`, unit: t.units.minuteShort };
}

// Duizendtal-groepering via de gedeelde formatter. De handgerolde variant hardcodeerde
// de punt én schaduwde de i18n-`t` met een lokale variabele van dezelfde naam.
function fmtMetersVU(m: number): { value: string; unit: string } {
  return { value: formatInt(m), unit: 'm' };
}

/** Minimale rij-data — zowel WorkoutSummary (historiek) als HomeWorkout (home) voldoen. */
export type WorkoutRowData = {
  id: string;
  started_at: string;
  duration_seconds: number | null;
  distance_meters: number | null;
  calories: number | null;
};

export type WorkoutCardProps = {
  workout: WorkoutRowData;
  onPress: (id: string) => void;
  /** Rij-index voor zebra-striping — oneven rijen (1, 3, …) krijgen de raised tile. */
  index: number;
  /**
   * De records die deze rit brak. Komt van buiten en niet uit `workout`: voor ritten van
   * vóór `workouts.pr_metrics` wordt hij afgeleid uit de chronologie van de hele lijst,
   * en dat is niets wat één rij over zichzelf kan weten.
   */
  prEntries?: readonly PrEntry[] | null;
};

// Full-bleed zebra-tile trainingsrij (Figma "Workout / Variant2"). Gedeeld door de home-
// en historiek-lijst. De parent zorgt dat de rij edge-to-edge staat: home legt een
// negatieve marge op de lijst-container, de historiek-FlatList-content is al full-bleed.
export const WorkoutCard = memo(function WorkoutCard({
  workout: w,
  onPress,
  index,
  prEntries,
}: WorkoutCardProps) {
  const dur = fmtDuration(w.duration_seconds);
  const dist = w.distance_meters != null ? fmtMetersVU(w.distance_meters) : null;
  // `null` (of ontbrekend) betekent: geen record. Een lege array is wél een record,
  // alleen zonder bekende metric — die krijgt de kale badge.
  const prLabel = prEntries != null ? prRowLabel(prEntries) : null;
  const prA11y = prEntries != null ? prAccessibilityLabel(prEntries) : null;
  const dateLabel = fmtDate(w.started_at);

  return (
    <Pressable
      testID="WorkoutCard"
      onPress={() => onPress(w.id)}
      accessibilityRole="button"
      // Volledig label, niet alleen de datum: een Pressable staat standaard op
      // `accessible`, dus een expliciet label vervángt de samengevoegde kindteksten. Alleen
      // de datum zetten zou duur, calorieën en afstand uit élke rij laten verdwijnen —
      // ook uit rijen zonder record.
      accessibilityLabel={[
        dateLabel,
        dur != null ? `${dur.value} ${dur.unit}` : null,
        w.calories != null ? `${w.calories} kcal` : null,
        dist != null ? `${dist.value} ${dist.unit}` : null,
        prA11y,
      ]
        .filter(Boolean)
        .join('. ')}
      style={({ pressed }) => [
        styles.row,
        index % 2 === 1 && styles.rowAlt,
        pressed && styles.rowPressed,
      ]}
    >
      <View style={styles.left}>
        <View style={styles.dateRow}>
          <Text style={styles.date} numberOfLines={1}>
            {dateLabel}
          </Text>
          {prEntries != null && <PrBadge label={prLabel} size="sm" />}
        </View>
        <View style={styles.statsRow}>
          {dur != null && (
            <View style={styles.durGroup}>
              <Text style={styles.value}>{dur.value}</Text>
              <Text style={styles.unit}>{dur.unit}</Text>
            </View>
          )}
          {w.calories != null && (
            <>
              <View style={styles.dotWrapper}>
                <Dot />
              </View>
              <View style={styles.caloriesGroup}>
                <Text style={styles.value}>{w.calories}</Text>
                <Text style={styles.unit}>kcal</Text>
              </View>
            </>
          )}
        </View>
      </View>
      <View style={styles.right}>
        {dist != null && (
          <View style={styles.distRow}>
            <Text style={styles.distValue}>{dist.value}</Text>
            <Text style={styles.distUnit}>{dist.unit}</Text>
          </View>
        )}
        <Ionicons name="arrow-forward" size={16} color={accent.default} />
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: space['20'],
    paddingVertical: space['12'],
    paddingHorizontal: space['20'],
  },
  // Zebra-striping: oneven rijen krijgen de raised tile; idem bij press.
  rowAlt: {
    backgroundColor: bg.raised,
  },
  rowPressed: {
    backgroundColor: bg.raised,
  },
  left: {
    flex: 1,
    gap: space['6'],
    // Vangnet onder de flexShrink hierboven: liever zichtbaar afgekapt dan stil over de
    // rechterkolom heen getekend.
    overflow: 'hidden',
  },
  // De datumregel draagt nu ook de PR-badge. `alignItems: 'center'` houdt de badge op de
  // optische middenlijn van de 11px-datum; de badge zelf heeft geen verticale padding,
  // dus de rijhoogte blijft die van een rij zonder record.
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space['8'],
  },
  date: {
    ...typeStyles.labelGoalPrefix,
    color: fg.tertiary,
    // De datum krimpt, de badge niet: bij vergrote systeemtekst groeit de inhoud van deze
    // regel harder dan de kolom, en zonder shrink schuift de badge over de afstand en de
    // pijl heen (RN kapt niet af, `overflow` staat standaard op 'visible'). De datum is
    // hier de meest redundante informatie — hij staat ook in het a11y-label.
    flexShrink: 1,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space['6'],
  },
  durGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  value: {
    ...typeStyles.kpiValue,
    color: fg.primary,
  },
  unit: {
    ...typeStyles.kpiUnit,
    color: fg.primary,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space['8'],
  },
  distRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  dotWrapper: {
    paddingBottom: 3,
  },
  caloriesGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  distValue: {
    ...typeStyles.kpiValue,
    color: fg.onAccent,
  },
  distUnit: {
    ...typeStyles.kpiUnit,
    color: fg.onAccent,
  },
});
