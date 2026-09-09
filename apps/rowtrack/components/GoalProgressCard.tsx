import { View, Text, StyleSheet } from 'react-native';
import { bg, fg, accent, border, progressBar, typeStyles, space, radii } from '@/constants';
import { Subtitle } from './Subtitle';
import { Dot } from './Dot';
import { t } from '@/i18n';
import { formatDecimal, formatInt } from '@/lib/formatters';
import type { PeriodGoalMetric, PeriodGoalPeriod, PeriodGoalProgress } from '@/lib/hooks/usePeriodGoal';

type GoalProgressCardProps = {
  progress: PeriodGoalProgress;
  onEdit?: () => void;
};

function periodLabel(period: PeriodGoalPeriod): string {
  return period === 'week' ? t.goals.thisWeek : t.goals.thisMonth;
}

function fmtDistance(meters: number): string {
  if (meters >= 1000) {
    const km = meters / 1000;
    const rounded = Math.round(km * 10) / 10;
    return `${Number.isInteger(rounded) ? formatInt(rounded) : formatDecimal(rounded, 1)} km`;
  }
  return `${formatInt(meters)} m`;
}

function fmtDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  // Spatie vóór 'u', gelijk aan formatDurationLabel ('1 u 10 min') — die twee
  // stonden op hetzelfde scherm met verschillende spatiëring.
  if (h > 0) return `${h} ${t.units.hourShort}${m > 0 ? ` ${m} ${t.units.minuteShort}` : ''}`;
  return `${m} ${t.units.minuteShort}`;
}

function fmtValue(metric: PeriodGoalMetric, value: number): string {
  if (metric === 'distance') return fmtDistance(value);
  if (metric === 'duration') return fmtDuration(value);
  return `${Math.round(value)}`;
}

function fmtRemaining(metric: PeriodGoalMetric, current: number, target: number): string {
  const remaining = Math.max(target - current, 0);
  if (metric === 'distance') return t.goals.remaining(fmtDistance(remaining));
  if (metric === 'duration') return t.goals.remaining(fmtDuration(remaining));
  return t.goals.remainingWorkouts(Math.round(remaining));
}

export function GoalProgressCard({ progress, onEdit }: GoalProgressCardProps) {
  const { goal, current, percentage } = progress;
  // Floor, niet round: een 'voldaan'-teller mag een drempel pas tonen zodra hij écht bereikt is
  // (99,6% → 99%, niet 100%). Round zou progressie overdrijven.
  const pct = Math.floor(percentage);
  const fillWidth = `${Math.min(pct, 100)}%` as const;

  return (
    <View testID="GoalProgressCard" style={styles.card}>
      <Subtitle
        label={periodLabel(goal.period)}
        action={onEdit ? { label: t.goals.editAction, onPress: onEdit } : undefined}
      />

      <View style={styles.valuesRow}>
        <Text style={styles.currentValue}>{fmtValue(goal.metric, current)}</Text>
        <Text style={styles.connector}>{t.goals.of}</Text>
        <Text style={styles.targetValue}>{fmtValue(goal.metric, goal.target)}</Text>
      </View>

      <View style={styles.progressSection}>
        <View style={styles.trackOuter}>
          <View style={[styles.trackFill, { width: fillWidth }]} />
        </View>
        <View style={styles.statusRow}>
          <Text style={styles.statusPct}>{pct}%</Text>
          <Text style={styles.statusLabel}>{t.goals.done}</Text>
          <Dot />
          <Text style={styles.statusRemaining}>{fmtRemaining(goal.metric, current, goal.target)}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: bg.raised,
    padding: space['20'],
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: border.default,
  },

  valuesRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: space['8'],
    paddingTop: space['20'],
    paddingBottom: space['16'],
  },
  currentValue: {
    ...typeStyles.sectionValue,
    color: fg.primary,
  },
  connector: {
    ...typeStyles.italicConnector,
    color: fg.tertiary,
    paddingBottom: space['4'],
  },
  targetValue: {
    ...typeStyles.sectionValue,
    color: fg.secondary,
  },

  progressSection: {
    gap: space['16'],
  },
  // Full-bleed: de track loopt edge-to-edge (Figma ProgressBar w=402, x=0) door de
  // card-padding heen; de statusRow-tekst eronder blijft wél gepad. Hoogte 4px (Figma
  // ProgressBar h=4), geen dot meer aan het einde van de fill.
  trackOuter: {
    height: 4,
    backgroundColor: progressBar.trackColor,
    borderRadius: radii.lg,
    marginHorizontal: -space['20'],
  },
  trackFill: {
    height: 4,
    backgroundColor: accent.default,
    borderRadius: radii.xs,
  },

  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space['4'],
  },
  statusPct: {
    ...typeStyles.italicConnector,
    color: accent.default,
  },
  statusLabel: {
    ...typeStyles.italicConnector,
    color: fg.secondary,
  },
  statusRemaining: {
    ...typeStyles.italicConnector,
    color: fg.secondary,
  },
});
