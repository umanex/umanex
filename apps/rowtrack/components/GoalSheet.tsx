import { useEffect, useState } from 'react';
import { View, Text, Alert, StyleSheet } from 'react-native';
import { BottomSheet } from './BottomSheet';
import { Button } from './Button';
import { Segmented, type SegmentedOption } from './Segmented';
import { WheelPicker } from './WheelPicker';
import { supabase } from '@/lib/supabase';
import { reportError } from '@/lib/monitoring';
import { formatDurationLabel, type WheelItem } from '@/lib/formatters';
import type { PeriodGoal, PeriodGoalPeriod, PeriodGoalMetric } from '@/lib/hooks/usePeriodGoal';
import { t } from '@/i18n';
import { fg, space, fontFamily, fontSize, letterSpacing } from '@/constants';

export type GoalSheetProps = {
  visible: boolean;
  /** Huidige (opgeslagen) doel — bron voor de initiële draft; null = nog geen doel. */
  currentGoal: PeriodGoal | null;
  userId: string | undefined;
  onClose: () => void;
  /** Aangeroepen na een succesvolle write, zodat de caller kan refetchen. */
  onSaved: () => void;
};

const PERIOD_OPTIONS: readonly SegmentedOption<PeriodGoalPeriod>[] = [
  { value: 'week', label: t.goals.periodWeek },
  { value: 'month', label: t.goals.periodMonth },
];
const METRIC_OPTIONS: readonly SegmentedOption<PeriodGoalMetric>[] = [
  { value: 'distance', label: t.goals.metricDistance },
  { value: 'duration', label: t.goals.metricDuration },
  { value: 'workouts', label: t.goals.metricWorkouts },
];

// Streefwaarde-bereik + eenheid per doeltype (weergave-eenheden; save() converteert naar opslag).
const RANGES: Record<PeriodGoalMetric, { min: number; max: number; step: number; unit: string }> = {
  distance: { min: 1, max: 500, step: 1, unit: 'km' },
  duration: { min: 5, max: 600, step: 5, unit: t.units.minuteShort },
  workouts: { min: 1, max: 100, step: 1, unit: t.units.sessions },
};
const DEFAULTS: Record<PeriodGoalMetric, number> = { distance: 10, duration: 60, workouts: 4 };

function itemsFor(metric: PeriodGoalMetric): WheelItem[] {
  const { min, max, step, unit } = RANGES[metric];
  const items: WheelItem[] = [];
  for (let v = min; v <= max; v += step) {
    // Duur vanaf een uur als "1 u 10 min" (gedeelde helper, gelijk aan de workout-wheel).
    const label = metric === 'duration' ? formatDurationLabel(v) : `${v} ${unit}`;
    items.push({ label, value: v, unit });
  }
  return items;
}
// Opgeslagen doel (m / s / count) ↔ weergave-waarde (km / min / count)
function toDisplay(metric: PeriodGoalMetric, stored: number): number {
  if (metric === 'distance') return Math.round(stored / 1000);
  if (metric === 'duration') return Math.round(stored / 60);
  return stored;
}
function toStored(metric: PeriodGoalMetric, value: number): number {
  if (metric === 'distance') return value * 1000;
  if (metric === 'duration') return value * 60;
  return value;
}
function indexFor(metric: PeriodGoalMetric, value: number): number {
  const { min, max, step } = RANGES[metric];
  const clamped = Math.min(Math.max(value, min), max);
  return Math.round((clamped - min) / step);
}

const NO_GOAL = { period_goal_period: null, period_goal_metric: null, period_goal_target: null } as const;

/**
 * Doel-instellen-bottomsheet. Zelf-persisterend: schrijft `period_goal_*` rechtstreeks
 * naar `profiles` en roept `onSaved` aan. Gedeeld door home + profiel (in-place, geen
 * redirect). PERIODE/TYPE via de gedeelde Segmented; STREEFWAARDE via de WheelPicker.
 */
export function GoalSheet({ visible, currentGoal, userId, onClose, onSaved }: GoalSheetProps) {
  const [period, setPeriod] = useState<PeriodGoalPeriod | null>(null);
  const [metric, setMetric] = useState<PeriodGoalMetric | null>(null);
  const [target, setTarget] = useState<number>(DEFAULTS.distance); // weergave-waarde
  const [saving, setSaving] = useState(false);

  // Init bij openen én wanneer currentGoal ná het openen binnenkomt (edge: sheet geopend
  // vóór de fetch klaar was). currentGoal is stabiel zolang de sheet open staat.
  useEffect(() => {
    if (!visible) return;
    if (currentGoal) {
      setPeriod(currentGoal.period);
      setMetric(currentGoal.metric);
      setTarget(toDisplay(currentGoal.metric, currentGoal.target));
    } else {
      setPeriod(null);
      setMetric(null);
      setTarget(DEFAULTS.distance);
    }
  }, [visible, currentGoal]);

  // Bij een ander doeltype: de streefwaarde naar een zinvolle default voor dat type zetten
  // (een afstand-getal slaat nergens op als eenheid voor duur/sessies).
  function handleMetric(m: PeriodGoalMetric) {
    if (m !== metric) setTarget(DEFAULTS[m]);
    setMetric(m);
  }

  async function persist(row: typeof NO_GOAL | { period_goal_period: PeriodGoalPeriod; period_goal_metric: PeriodGoalMetric; period_goal_target: number }) {
    if (!userId) return;
    setSaving(true);
    const { error } = await supabase.from('profiles').update(row).eq('id', userId);
    setSaving(false);
    if (error) {
      reportError(error, { where: 'GoalSheet.persist' });
      Alert.alert(t.common.error, t.common.saveFailed(error.message));
      return;
    }
    onSaved();
    onClose();
  }

  // Opslaan zonder periode én type schreef stil NO_GOAL weg en sloot de sheet alsof het
  // gelukt was (audit F6): de gebruiker koos niets, drukte Opslaan, en kreeg een wissing.
  // Wissen heeft een eigen knop — Opslaan mag nooit wissen.
  const canSave = period !== null && metric !== null;

  function save() {
    // Bewust `!period || !metric` i.p.v. `!canSave`: dit narrowt beide waarden voor de
    // aanroep hieronder zonder op aliased-condition-narrowing te leunen.
    if (!period || !metric) return;
    persist({ period_goal_period: period, period_goal_metric: metric, period_goal_target: toStored(metric, target) });
  }
  function removeGoal() {
    persist(NO_GOAL);
  }

  return (
    <BottomSheet
      testID="GoalSheet"
      visible={visible}
      onClose={onClose}
      title={t.goals.sheetTitle}
      footer={
        <View style={styles.footer}>
          {currentGoal && (
            <Button
              title={t.goals.sheetRemoveButton}
              variant="outline"
              size="md"
              icon="arrow-forward"
              iconPosition="trailing"
              onPress={removeGoal}
              disabled={saving}
            />
          )}
          <Button
            title={t.common.save}
            size="md"
            icon="arrow-forward"
            iconPosition="trailing"
            onPress={save}
            disabled={!canSave}
            loading={saving}
          />
        </View>
      }
    >
      <View style={styles.group}>
        <Text style={styles.label}>{t.goals.sheetPeriodLabel}</Text>
        <Segmented options={PERIOD_OPTIONS} value={period} onChange={setPeriod} />
      </View>

      <View style={styles.group}>
        <Text style={styles.label}>{t.goals.sheetTypeLabel}</Text>
        <Segmented options={METRIC_OPTIONS} value={metric} onChange={handleMetric} />
      </View>

      {metric && (
        <View style={styles.group}>
          <Text style={styles.label}>{t.goals.sheetTargetLabel}</Text>
          <WheelPicker
            items={itemsFor(metric)}
            selectedIndex={indexFor(metric, target)}
            onIndexChange={(idx) => setTarget(RANGES[metric].min + idx * RANGES[metric].step)}
            visibleRows={3}
            surface="raised"
          />
        </View>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: space['8'],
  },
  // Veld-label (Figma 388:2256): Albert Sans SemiBold 13, 20% tracking, uppercase, fg.secondary.
  label: {
    fontFamily: fontFamily.albertSansSemiBold,
    fontSize: fontSize['13'],
    letterSpacing: letterSpacing.wide * fontSize['13'],
    textTransform: 'uppercase',
    color: fg.secondary,
  },
  footer: {
    gap: space['16'],
  },
});
