import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { supabase } from '@/lib/supabase';

export type PeriodGoalPeriod = 'week' | 'month';
export type PeriodGoalMetric = 'distance' | 'duration' | 'workouts';

export interface PeriodGoal {
  period: PeriodGoalPeriod;
  metric: PeriodGoalMetric;
  target: number; // meters | seconds | count
}

export interface PeriodGoalProgress {
  goal: PeriodGoal;
  current: number;
  percentage: number; // 0–100
}

export interface PersonalRecords {
  longestDistance: number | null;   // meters
  longestDuration: number | null;  // seconds
  fastestSplit: number | null;     // seconds per 500m
}

function getPeriodStart(period: PeriodGoalPeriod): string {
  const now = new Date();
  if (period === 'week') {
    const day = now.getDay();
    const diff = day === 0 ? 6 : day - 1; // Monday = start
    const monday = new Date(now);
    monday.setDate(now.getDate() - diff);
    monday.setHours(0, 0, 0, 0);
    return monday.toISOString();
  }
  // month
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  return first.toISOString();
}

export function usePeriodGoal(userId: string | undefined) {
  const [goalProgress, setGoalProgress] = useState<PeriodGoalProgress | null>(null);
  const [records, setRecords] = useState<PersonalRecords>({
    longestDistance: null,
    longestDuration: null,
    fastestSplit: null,
  });
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!userId) return;

    // Fetch goal from profile + PRs from workouts in parallel
    const [profileRes, prDistRes, prDurRes, prSplitRes] = await Promise.all([
      supabase
        .from('profiles')
        .select('period_goal_period, period_goal_metric, period_goal_target')
        .eq('id', userId)
        .single(),
      supabase
        .from('workouts')
        .select('distance_meters')
        .eq('user_id', userId)
        .order('distance_meters', { ascending: false })
        .limit(1),
      supabase
        .from('workouts')
        .select('duration_seconds')
        .eq('user_id', userId)
        .order('duration_seconds', { ascending: false })
        .limit(1),
      supabase
        .from('workouts')
        .select('best_split')
        .eq('user_id', userId)
        .not('best_split', 'is', null)
        .order('best_split', { ascending: true })
        .limit(1),
    ]);

    // Personal records
    setRecords({
      longestDistance: prDistRes.data?.[0]?.distance_meters ?? null,
      longestDuration: prDurRes.data?.[0]?.duration_seconds ?? null,
      fastestSplit: prSplitRes.data?.[0]?.best_split ?? null,
    });

    // Period goal progress
    const p = profileRes.data;
    if (p?.period_goal_period && p?.period_goal_metric && p?.period_goal_target) {
      const goal: PeriodGoal = {
        period: p.period_goal_period,
        metric: p.period_goal_metric,
        target: p.period_goal_target,
      };

      const periodStart = getPeriodStart(goal.period);
      const { data: periodWorkouts } = await supabase
        .from('workouts')
        .select('distance_meters, duration_seconds')
        .eq('user_id', userId)
        .gte('started_at', periodStart);

      let current = 0;
      if (goal.metric === 'distance') {
        current = (periodWorkouts ?? []).reduce((s, w) => s + w.distance_meters, 0);
      } else if (goal.metric === 'duration') {
        current = (periodWorkouts ?? []).reduce((s, w) => s + w.duration_seconds, 0);
      } else {
        current = periodWorkouts?.length ?? 0;
      }

      setGoalProgress({
        goal,
        current,
        percentage: Math.min((current / goal.target) * 100, 100),
      });
    } else {
      setGoalProgress(null);
    }

    setLoading(false);
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      fetchAll();
    }, [fetchAll]),
  );

  return { goalProgress, records, loading, refetch: fetchAll };
}
