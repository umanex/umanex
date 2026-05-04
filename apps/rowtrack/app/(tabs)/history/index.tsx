import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { Card, MetricDisplay, EmptyState, WorkoutCard } from '@/components';
import {
  background,
  brand,
  text as textColors,
  display,
  space,
  layout,
} from '@/constants';
import type { WorkoutSummary } from '@/types/workout';

export default function HistoryScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [workouts, setWorkouts] = useState<WorkoutSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchWorkouts = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('workouts')
      .select('id, started_at, duration_seconds, distance_meters, avg_watts, avg_spm, avg_split_seconds')
      .order('started_at', { ascending: false });
    setWorkouts(data ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchWorkouts();
  }, [fetchWorkouts]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchWorkouts();
    setRefreshing(false);
  }, [fetchWorkouts]);

  const handleWorkoutPress = useCallback((id: string) => {
    router.push(`/(tabs)/history/${id}`);
  }, [router]);

  // --- Computed stats ---
  const totalWorkouts = workouts.length;
  const totalDistance = workouts.reduce((sum, w) => sum + w.distance_meters, 0);
  const avgWatts =
    workouts.length > 0
      ? Math.round(
          workouts.reduce((sum, w) => sum + (w.avg_watts ?? 0), 0) /
            workouts.filter((w) => w.avg_watts != null).length || 0,
        )
      : 0;

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
      <Text style={styles.title}>Historiek</Text>

      {/* Stat cards */}
      <View style={styles.statsRow}>
        <Card padding={space[3]} style={styles.statCard}>
          <MetricDisplay value={totalWorkouts} label="WORKOUTS" size="md" />
        </Card>
        <Card padding={space[3]} style={styles.statCard}>
          <MetricDisplay
            value={(totalDistance / 1000).toFixed(1)}
            label="KM TOTAAL"
            size="md"
          />
        </Card>
        <Card padding={space[3]} style={styles.statCard}>
          <MetricDisplay
            value={avgWatts || '\u2014'}
            label="GEM. WATT"
            size="md"
          />
        </Card>
      </View>

      {/* Workout list */}
      {loading ? (
        <ActivityIndicator color={brand.primary} style={styles.loader} />
      ) : workouts.length === 0 ? (
        <EmptyState
          icon="time-outline"
          title="Nog geen workouts — begin met roeien!"
        />
      ) : (
        <View style={styles.workoutList}>
          {workouts.map((w) => (
            <WorkoutCard key={w.id} workout={w} onPress={handleWorkoutPress} showExtras />
          ))}
        </View>
      )}
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
    gap: space[6],
  },
  title: {
    ...display.sm,
    color: textColors.primary,
    paddingTop: space[6],
  },
  statsRow: {
    flexDirection: 'row',
    gap: space[3],
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
  },
  loader: {
    paddingVertical: space[10],
  },
  workoutList: {
    gap: space[3],
  },
});
