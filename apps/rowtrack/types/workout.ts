import type { SplitEntry } from '@/components/workout';

export type WorkoutBase = {
  id: string;
  started_at: string;
  duration_seconds: number;
  distance_meters: number;
  avg_watts: number | null;
  avg_spm: number | null;
};

export type WorkoutSummary = WorkoutBase & {
  avg_split_seconds: number | null;
};

export type WorkoutDetail = WorkoutSummary & {
  calories: number | null;
  max_watts: number | null;
  best_split: number | null;
  avg_heart_rate: number | null;
  max_heart_rate: number | null;
  resistance_level: number | null;
  notes: string | null;
  goal_type: string | null;
  goal_target: number | null;
  goal_reached: boolean | null;
  splits: SplitEntry[] | null;
};
