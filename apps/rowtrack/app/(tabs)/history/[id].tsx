import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { Button, Card, MetricDisplay, SectionHeader, SummaryRow, EmptyState } from '@/components';
import { SplitsList } from '@/components/workout';
import { formatDuration, formatDistanceDynamic, formatSplit, formatDateLong } from '@/lib/formatters';
import { GOAL_TYPES, type GoalType } from '@/lib/workout-goals';
import {
  background,
  brand,
  status,
  text as textColors,
  display,
  body,
  fontFamily,
  fontSize,
  space,
  layout,
  radii,
} from '@/constants';
import type { WorkoutDetail } from '@/types/workout';

export default function WorkoutDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [workout, setWorkout] = useState<WorkoutDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data } = await supabase
        .from('workouts')
        .select('id, started_at, duration_seconds, distance_meters, avg_watts, avg_spm, avg_split_seconds, calories, max_watts, best_split, avg_heart_rate, max_heart_rate, resistance_level, notes, goal_type, goal_target, goal_reached, splits')
        .eq('id', id)
        .single();

      if (!cancelled) {
        setWorkout(data);
        setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [id]);

  const handleDelete = useCallback(async () => {
    setDeleting(true);
    const { error } = await supabase.from('workouts').delete().eq('id', id);
    setDeleting(false);
    if (error) {
      Alert.alert('Fout', 'Verwijderen mislukt. Probeer opnieuw.');
    } else {
      router.back();
    }
  }, [id, router]);

  const confirmDelete = useCallback(() => {
    Alert.alert(
      'Training verwijderen',
      'Ben je zeker dat je deze training wil verwijderen? Dit kan niet ongedaan gemaakt worden.',
      [
        { text: 'Annuleren', style: 'cancel' },
        { text: 'Verwijderen', style: 'destructive', onPress: handleDelete },
      ],
    );
  }, [handleDelete]);

  if (loading) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator color={brand.primary} size="large" />
      </View>
    );
  }

  if (!workout) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={24} color={textColors.primary} />
          </TouchableOpacity>
        </View>
        <EmptyState
          icon="alert-circle-outline"
          title="Workout niet gevonden"
          size="lg"
        />
      </View>
    );
  }

  const hasMetrics =
    workout.avg_watts != null ||
    workout.avg_spm != null ||
    workout.avg_split_seconds != null ||
    workout.calories != null ||
    workout.max_watts != null ||
    workout.best_split != null;

  const hasHeartRate = workout.avg_heart_rate != null || workout.max_heart_rate != null;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={textColors.primary} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.headerDate}>{formatDateLong(workout.started_at)}</Text>
        </View>
        <View style={styles.backButton} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Hero */}
        <Card padding={space[6]} style={styles.heroCard}>
          <View style={styles.heroRow}>
            <MetricDisplay
              value={formatDuration(workout.duration_seconds)}
              label="DUUR"
              size="lg"
            />
            <MetricDisplay
              value={formatDistanceDynamic(workout.distance_meters).value}
              label="AFSTAND"
              unit={formatDistanceDynamic(workout.distance_meters).unit}
              size="lg"
            />
          </View>
        </Card>

        {/* Goal */}
        {workout.goal_type && workout.goal_target != null && (
          <>
            <SectionHeader title="DOEL" />
            <Card>
              <View style={styles.goalRow}>
                <View style={styles.goalInfo}>
                  <Ionicons
                    name={GOAL_TYPES[workout.goal_type as GoalType].icon}
                    size={24}
                    color={workout.goal_reached ? status.success : status.error}
                  />
                  <View>
                    <Text style={styles.goalLabel}>
                      {GOAL_TYPES[workout.goal_type as GoalType].label}
                    </Text>
                    <Text style={styles.goalTarget}>
                      {GOAL_TYPES[workout.goal_type as GoalType].formatTarget(workout.goal_target)}
                    </Text>
                  </View>
                </View>
                <View style={[
                  styles.goalBadge,
                  { backgroundColor: workout.goal_reached ? status.success : status.error },
                ]}>
                  <Ionicons
                    name={workout.goal_reached ? 'checkmark' : 'close'}
                    size={16}
                    color={textColors.inverse}
                  />
                  <Text style={styles.goalBadgeText}>
                    {workout.goal_reached ? 'Bereikt' : 'Niet bereikt'}
                  </Text>
                </View>
              </View>
            </Card>
          </>
        )}

        {/* Details grid */}
        {hasMetrics && (
          <>
            <SectionHeader title="DETAILS" />
            <View style={styles.grid}>
              {workout.avg_watts != null && (
                <Card style={styles.tile}>
                  <MetricDisplay value={workout.avg_watts} label="GEM. WATT" unit="W" size="md" />
                </Card>
              )}
              {workout.avg_spm != null && (
                <Card style={styles.tile}>
                  <MetricDisplay value={workout.avg_spm} label="GEM. SPM" size="md" />
                </Card>
              )}
              {workout.avg_split_seconds != null && (
                <Card style={styles.tile}>
                  <MetricDisplay
                    value={formatSplit(workout.avg_split_seconds)}
                    label="GEM. SPLIT"
                    unit="/500m"
                    size="md"
                  />
                </Card>
              )}
              {workout.calories != null && (
                <Card style={styles.tile}>
                  <MetricDisplay value={workout.calories} label="CALORIEEN" unit="kcal" size="md" />
                </Card>
              )}
              {workout.max_watts != null && (
                <Card style={styles.tile}>
                  <MetricDisplay value={workout.max_watts} label="MAX WATT" unit="W" size="md" />
                </Card>
              )}
              {workout.best_split != null && (
                <Card style={styles.tile}>
                  <MetricDisplay
                    value={formatSplit(workout.best_split)}
                    label="BESTE SPLIT"
                    unit="/500m"
                    size="md"
                  />
                </Card>
              )}
            </View>
          </>
        )}

        {/* Heart rate */}
        {hasHeartRate && (
          <>
            <SectionHeader title="HARTSLAG" />
            <View style={styles.grid}>
              {workout.avg_heart_rate != null && (
                <Card style={styles.tile}>
                  <MetricDisplay value={workout.avg_heart_rate} label="GEM. BPM" unit="bpm" size="md" />
                </Card>
              )}
              {workout.max_heart_rate != null && (
                <Card style={styles.tile}>
                  <MetricDisplay value={workout.max_heart_rate} label="MAX BPM" unit="bpm" size="md" />
                </Card>
              )}
            </View>
          </>
        )}

        {/* Resistance */}
        {workout.resistance_level != null && (
          <>
            <SectionHeader title="APPARAAT" />
            <Card>
              <SummaryRow label="Weerstandsniveau" value={`${workout.resistance_level}`} />
            </Card>
          </>
        )}

        {/* 500m Splits */}
        {workout.splits && workout.splits.length > 0 && (
          <>
            <SectionHeader title="500M SPLITS" />
            <Card>
              {workout.splits.map((s, i) => (
                <SummaryRow
                  key={i}
                  label={`${formatDistanceDynamic(s.distance).value} ${formatDistanceDynamic(s.distance).unit}`}
                  value={formatSplit(s.split)}
                />
              ))}
            </Card>
          </>
        )}

        {/* Notes */}
        {workout.notes != null && workout.notes.length > 0 && (
          <>
            <SectionHeader title="NOTITIES" />
            <Card>
              <Text style={styles.notes}>{workout.notes}</Text>
            </Card>
          </>
        )}

        <Button
          title="Training verwijderen"
          icon="trash-outline"
          variant="ghost"
          onPress={confirmDelete}
          loading={deleting}
          disabled={deleting}
          size="md"
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: background.base,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: layout.screenHorizontal,
    paddingVertical: space[3],
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
    alignItems: 'center',
  },
  headerDate: {
    ...body.sm,
    fontFamily: fontFamily.bodySemiBold,
    color: textColors.secondary,
  },
  content: {
    paddingHorizontal: layout.screenHorizontal,
    paddingBottom: space[10],
    gap: space[6],
  },
  heroCard: {
    alignItems: 'center',
  },
  heroRow: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    width: '100%',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[3],
  },
  tile: {
    flexBasis: '45%',
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notes: {
    ...body.md,
    color: textColors.primary,
  },
  goalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  goalInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
  },
  goalLabel: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize['12'],
    color: textColors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  goalTarget: {
    fontFamily: fontFamily.monoMedium,
    fontSize: fontSize['18'],
    color: textColors.primary,
  },
  goalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[1],
    paddingHorizontal: space[3],
    paddingVertical: space[1],
    borderRadius: radii.full,
  },
  goalBadgeText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize['12'],
    color: textColors.inverse,
  },
});
