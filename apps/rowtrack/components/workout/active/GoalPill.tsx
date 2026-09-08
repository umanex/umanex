import { View, Text, StyleSheet } from 'react-native';
import type { WorkoutGoal } from '@/lib/workout-goals';
import { formatSplit, formatInt, formatDecimal } from '@/lib/formatters';
import { t } from '@/i18n';
import { accent, fg, fontFamily, fontSize, space } from '@/constants';

export type GoalPillProps = {
  /** Het doel van deze rit, of `null` voor een vrije rit. */
  goal: WorkoutGoal | null;
};

/**
 * De DOEL-pill in de header van het active-scherm: label · divider · waarde + eenheid.
 *
 * Plat inline, geen fill of border — de accent-tint zit op de header-band eromheen
 * (Figma 297:2227). Hoogte 48 zodat hij met de Stop-knop op één lijn ligt.
 *
 * Waarde en eenheid staan bewust APART: beide bold, gap 2, zodat "180" en "W" als één
 * getal lezen maar elk hun eigen grootte houden (18 tegen 16).
 */
export function GoalPill({ goal }: GoalPillProps) {
  const { value, unit } = goalPillParts(goal);
  return (
    <View testID="GoalPill" style={styles.doelPill}>
      <Text style={styles.doelPillLabel}>{t.workout.active.goalPillLabel}</Text>
      <View style={styles.doelPillDivider} />
      <View style={styles.doelPillValueRow}>
        <Text style={styles.doelPillValue}>{value}</Text>
        {unit != null && <Text style={styles.doelPillUnit}>{unit}</Text>}
      </View>
    </View>
  );
}

/**
 * Doelwaarde gesplitst in waarde en eenheid.
 *
 * Alle doeltypes volgen {waarde} {eenheid}: "Geen" / "20 min" / "10 km" / "2:20 split" /
 * "180 W". Split neemt de frame-copy over; watts houdt bewust de spatie (Figma toont
 * "180W", 2026-07-14 gelijkgetrokken op het patroon). "Geen" heeft geen eenheid.
 */
export function goalPillParts(goal: WorkoutGoal | null): { value: string; unit: string | null } {
  if (!goal) return { value: t.workout.active.goalNone, unit: null };
  switch (goal.type) {
    case 'duration': {
      const m = Math.floor(goal.target / 60);
      const s = goal.target % 60;
      return { value: s === 0 ? `${m}` : `${m}:${String(s).padStart(2, '0')}`, unit: 'min' };
    }
    case 'distance': {
      if (goal.target >= 1000) {
        const km = goal.target / 1000;
        return { value: Number.isInteger(km) ? formatInt(km) : formatDecimal(km, 1), unit: 'km' };
      }
      return { value: formatInt(goal.target), unit: 'm' };
    }
    case 'split':
      return { value: formatSplit(goal.target, true), unit: t.workout.active.goalUnitSplit };
    case 'watts':
      return { value: `${goal.target}`, unit: 'W' };
  }
}

const styles = StyleSheet.create({
  doelPill: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    gap: space['16'],
  },
  doelPillLabel: {
    fontFamily: fontFamily.albertSansSemiBold,
    fontSize: fontSize['14'],
    letterSpacing: 2.8, // 20% van 14
    color: fg.onAccent,
  },
  doelPillDivider: {
    width: 1,
    height: 16,
    borderRadius: 8,
    backgroundColor: fg.secondary,
  },
  // Waarde + eenheid beide bold, strak naast elkaar (gap 2) — "180W" (Figma 297:2227).
  doelPillValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  doelPillValue: {
    fontFamily: fontFamily.albertSansBold,
    fontSize: fontSize['18'],
    letterSpacing: -0.45, // -2.5% van 18
    color: accent.default,
  },
  doelPillUnit: {
    fontFamily: fontFamily.albertSansBold,
    fontSize: fontSize['16'],
    color: accent.default,
  },
});
