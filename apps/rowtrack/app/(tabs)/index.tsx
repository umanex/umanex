import { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import {
  Button,
  Card,
  EmptyState,
  MetricDisplay,
  SectionHeader,
  WorkoutCard,
} from '@/components';
import {
  background,
  brand,
  text as textColors,
  status as statusColors,
  display,
  body,
  label,
  space,
  layout,
  fontFamily,
  fontSize,
  radii,
} from '@/constants';
import type { WorkoutSummary } from '@/types/workout';
import { usePeriodGoal } from '@/lib/hooks/usePeriodGoal';

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Goedemorgen';
  if (hour < 18) return 'Goedemiddag';
  return 'Goedenavond';
}

function fmtTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function fmtDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}u ${m}min`;
  return `${m} min`;
}

export default function HomeScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [displayName, setDisplayName] = useState('');
  const [workouts, setWorkouts] = useState<WorkoutSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const { goalProgress, records, refetch: refetchGoal } = usePeriodGoal(user?.id);

  const fetchData = useCallback(async () => {
    if (!user) return;

    const [profileRes, workoutsRes] = await Promise.all([
      supabase
        .from('profiles')
        .select('display_name')
        .eq('id', user.id)
        .single(),
      supabase
        .from('workouts')
        .select('id, started_at, duration_seconds, distance_meters, avg_watts, avg_spm, avg_split_seconds')
        .order('started_at', { ascending: false })
        .limit(3),
    ]);

    if (profileRes.data?.display_name) {
      setDisplayName(profileRes.data.display_name);
    }
    setWorkouts(workoutsRes.data ?? []);
    setLoading(false);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchData(), refetchGoal()]);
    setRefreshing(false);
  }, [fetchData, refetchGoal]);

  const handleWorkoutPress = useCallback((id: string) => {
    router.push(`/(tabs)/history/${id}`);
  }, [router]);

  const greeting = getGreeting();
  const name = displayName || 'roeier';

  // Format goal progress for display
  const goalLabel = goalProgress
    ? goalProgress.goal.period === 'week' ? 'Deze week' : 'Deze maand'
    : null;
  const goalMetricLabel = goalProgress
    ? goalProgress.goal.metric === 'distance'
      ? `${(goalProgress.current / 1000).toFixed(1)} / ${(goalProgress.goal.target / 1000).toFixed(0)} km`
      : goalProgress.goal.metric === 'duration'
        ? `${fmtDuration(goalProgress.current)} / ${fmtDuration(goalProgress.goal.target)}`
        : `${goalProgress.current} / ${goalProgress.goal.target} sessies`
    : null;

  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top }]}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={brand.primary}
        />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.greeting}>{greeting},</Text>
        <Text style={styles.name}>{name}</Text>
      </View>

      {/* CTA */}
      <Button
        title="Nieuwe training"
        icon="play"
        onPress={() => router.push('/(tabs)/workout')}
      />

      {/* Period goal progress */}
      {goalProgress && (
        <View style={styles.section}>
          <SectionHeader title={goalLabel!.toUpperCase()} />
          <Card padding={space[4]}>
            <Text style={styles.goalMetricText}>{goalMetricLabel}</Text>
            <View style={styles.progressBarBg}>
              <View
                style={[
                  styles.progressBarFill,
                  {
                    width: `${Math.min(goalProgress.percentage, 100)}%`,
                    backgroundColor: goalProgress.percentage >= 100
                      ? statusColors.success
                      : brand.primary,
                  },
                ]}
              />
            </View>
            <Text style={styles.goalPercentText}>
              {Math.round(goalProgress.percentage)}% {goalProgress.percentage >= 100 ? 'behaald!' : 'voldaan'}
            </Text>
          </Card>
        </View>
      )}

      {/* Personal records */}
      {(records.longestDistance || records.longestDuration || records.fastestSplit) && (
        <View style={styles.section}>
          <SectionHeader title="PERSOONLIJKE RECORDS" />
          <View style={styles.prRow}>
            {records.longestDistance != null && (
              <Card padding={space[3]} style={styles.prCard}>
                <MetricDisplay
                  value={(records.longestDistance / 1000).toFixed(1)}
                  label="LANGSTE AFSTAND"
                  unit="km"
                  size="sm"
                />
              </Card>
            )}
            {records.longestDuration != null && (
              <Card padding={space[3]} style={styles.prCard}>
                <MetricDisplay
                  value={fmtDuration(records.longestDuration)}
                  label="LANGSTE DUUR"
                  size="sm"
                />
              </Card>
            )}
            {records.fastestSplit != null && (
              <Card padding={space[3]} style={styles.prCard}>
                <MetricDisplay
                  value={fmtTime(records.fastestSplit)}
                  label="SNELSTE SPLIT"
                  unit="/500m"
                  size="sm"
                />
              </Card>
            )}
          </View>
        </View>
      )}

      {/* Recente workouts */}
      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionLabel}>RECENTE WORKOUTS</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/history')}>
            <Text style={styles.sectionLink}>Bekijk alle →</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator
            color={brand.primary}
            style={styles.loader}
          />
        ) : workouts.length === 0 ? (
          <EmptyState
            icon="water-outline"
            title="Nog geen workouts — tijd om te beginnen!"
          />
        ) : (
          <View style={styles.workoutList}>
            {workouts.map((w) => (
              <WorkoutCard key={w.id} workout={w} onPress={handleWorkoutPress} />
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: background.base,
  },
  content: {
    paddingHorizontal: layout.screenHorizontal,
    paddingBottom: space[10],
    gap: space[8],
  },
  header: {
    paddingTop: space[6],
    gap: space[1],
  },
  greeting: {
    ...body.lg,
    color: textColors.secondary,
  },
  name: {
    ...display.sm,
    color: textColors.primary,
  },
  section: {
    gap: space[4],
  },
  loader: {
    paddingVertical: space[10],
  },
  workoutList: {
    gap: space[3],
  },
  goalMetricText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize['16'],
    color: textColors.primary,
    marginBottom: space[2],
  },
  progressBarBg: {
    height: 8,
    borderRadius: 4,
    backgroundColor: background.elevated,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  goalPercentText: {
    ...body.sm,
    color: textColors.secondary,
    marginTop: space[1],
  },
  prRow: {
    flexDirection: 'row',
    gap: space[3],
  },
  prCard: {
    flex: 1,
    alignItems: 'center',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionLabel: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize['12'],
    color: textColors.muted,
    letterSpacing: 0.8,
  },
  sectionLink: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize['12'],
    color: brand.primary,
  },
});
