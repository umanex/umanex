import { useCallback, useEffect, useReducer, useRef } from 'react';
import type { RowerMetrics } from '@/lib/ble/types';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { calculateCalories } from '@/lib/calories';

const log: (...args: unknown[]) => void = __DEV__
  ? (...args: unknown[]) => console.log('[kcal]', ...args)
  : () => {};

// --- State + Reducer ---

export interface WorkoutMetricsState {
  seconds: number;
  watts: number;
  spm: number;
  splitSeconds: number;
  distanceMeters: number;
  calories: number;
  resistanceLevel: number | null;
}

type MetricsAction =
  | { type: 'BLE_UPDATE'; metrics: Partial<WorkoutMetricsState> }
  | { type: 'RESET' };

const initialState: WorkoutMetricsState = {
  seconds: 0,
  watts: 0,
  spm: 0,
  splitSeconds: 0,
  distanceMeters: 0,
  calories: 0,
  resistanceLevel: null,
};

function metricsReducer(state: WorkoutMetricsState, action: MetricsAction): WorkoutMetricsState {
  switch (action.type) {
    case 'BLE_UPDATE':
      return { ...state, ...action.metrics };
    case 'RESET':
      return initialState;
  }
}

// --- Accumulator Refs ---

export interface AccumulatorRefs {
  wattsSum: React.MutableRefObject<number>;
  spmSum: React.MutableRefObject<number>;
  splitSum: React.MutableRefObject<number>;
  tickCount: React.MutableRefObject<number>;
  splitTickCount: React.MutableRefObject<number>;
  maxWattsRef: React.MutableRefObject<number>;
  bestSplitRef: React.MutableRefObject<number>;
  heartRateSum: React.MutableRefObject<number>;
  heartRateCount: React.MutableRefObject<number>;
  maxHeartRateRef: React.MutableRefObject<number>;
  startedAtRef: React.MutableRefObject<Date | null>;
}

// --- Hook ---

type Phase = 'idle' | 'active' | 'summary';

export function useWorkoutMetrics(
  phase: Phase,
  bleMetrics: RowerMetrics | null,
  hrBpm?: number | null,
) {
  const [state, dispatch] = useReducer(metricsReducer, initialState);

  const wattsSum = useRef(0);
  const spmSum = useRef(0);
  const splitSum = useRef(0);
  const tickCount = useRef(0);
  const splitTickCount = useRef(0);
  const maxWattsRef = useRef(0);
  const bestSplitRef = useRef(Infinity);
  const heartRateSum = useRef(0);
  const heartRateCount = useRef(0);
  const maxHeartRateRef = useRef(0);
  const startedAtRef = useRef<Date | null>(null);
  const initialElapsed = useRef<number | null>(null);
  const initialDistance = useRef<number | null>(null);
  const weightKgRef = useRef<number | null>(null);
  const kcalAccumulator = useRef(0);
  const lastKcalElapsed = useRef(0);
  const currentWattsRef = useRef(0);
  const currentSecondsRef = useRef(0);

  // --- Load profile weight ---
  const { user } = useAuth();
  useEffect(() => {
    if (!user) return;
    supabase
      .from('profiles')
      .select('weight_kg')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        weightKgRef.current = data?.weight_kg ?? null;
      });
  }, [user]);

  // --- BLE metrics effect ---
  useEffect(() => {
    if (phase !== 'active' || !bleMetrics) return;

    const partial: Partial<WorkoutMetricsState> = {};

    if (bleMetrics.instantaneousPower != null) {
      partial.watts = bleMetrics.instantaneousPower;
      wattsSum.current += bleMetrics.instantaneousPower;
      if (bleMetrics.instantaneousPower > maxWattsRef.current) {
        maxWattsRef.current = bleMetrics.instantaneousPower;
      }
    }
    if (bleMetrics.strokeRate != null) {
      partial.spm = bleMetrics.strokeRate;
      spmSum.current += bleMetrics.strokeRate;
    }
    if (bleMetrics.instantaneousPace != null && bleMetrics.instantaneousPace > 0) {
      partial.splitSeconds = bleMetrics.instantaneousPace;
      splitSum.current += bleMetrics.instantaneousPace;
      splitTickCount.current += 1;
      if (bleMetrics.instantaneousPace < bestSplitRef.current) {
        bestSplitRef.current = bleMetrics.instantaneousPace;
      }
    }
    if (bleMetrics.totalDistance != null) {
      if (initialDistance.current === null) initialDistance.current = bleMetrics.totalDistance;
      partial.distanceMeters = bleMetrics.totalDistance - initialDistance.current;
    }
    if (bleMetrics.elapsedTime != null) {
      if (initialElapsed.current === null) initialElapsed.current = bleMetrics.elapsedTime;
      partial.seconds = bleMetrics.elapsedTime - initialElapsed.current;
    }
    if (bleMetrics.resistanceLevel != null) {
      partial.resistanceLevel = bleMetrics.resistanceLevel;
    }
    // HR: prefer external HR monitor, fallback to FTMS heart rate
    const hr = (hrBpm != null && hrBpm > 0) ? hrBpm
      : (bleMetrics.heartRate != null && bleMetrics.heartRate > 0) ? bleMetrics.heartRate
      : null;
    if (hr != null) {
      heartRateSum.current += hr;
      heartRateCount.current += 1;
      if (hr > maxHeartRateRef.current) {
        maxHeartRateRef.current = hr;
      }
    }
    tickCount.current += 1;

    // Keep refs in sync for kcal calculation
    if (partial.watts != null) currentWattsRef.current = partial.watts;
    if (partial.seconds != null) currentSecondsRef.current = partial.seconds;

    // Cumulative calories: add interval kcal every 5 seconds
    const elapsed = currentSecondsRef.current;
    if (elapsed > 0 && elapsed >= lastKcalElapsed.current + 5) {
      const w = currentWattsRef.current;
      const intervalSecs = elapsed - lastKcalElapsed.current;
      const weightKg = weightKgRef.current ?? undefined;
      const intervalKcal = calculateCalories(w, intervalSecs, weightKg);
      kcalAccumulator.current += intervalKcal;
      lastKcalElapsed.current = elapsed;
      partial.calories = Math.round(kcalAccumulator.current);
      log('tick — watts:', w, 'weight:', weightKg, 'interval:', intervalKcal.toFixed(3), 'total:', kcalAccumulator.current.toFixed(1));
    }

    dispatch({ type: 'BLE_UPDATE', metrics: partial });
  }, [bleMetrics, phase, hrBpm]);

  // --- Reset ---
  const resetAll = useCallback(() => {
    dispatch({ type: 'RESET' });
    wattsSum.current = 0;
    spmSum.current = 0;
    splitSum.current = 0;
    tickCount.current = 0;
    splitTickCount.current = 0;
    maxWattsRef.current = 0;
    bestSplitRef.current = Infinity;
    heartRateSum.current = 0;
    heartRateCount.current = 0;
    maxHeartRateRef.current = 0;
    initialElapsed.current = null;
    initialDistance.current = null;
    kcalAccumulator.current = 0;
    lastKcalElapsed.current = 0;
    currentWattsRef.current = 0;
    currentSecondsRef.current = 0;
    startedAtRef.current = new Date();
  }, []);

  const refs: AccumulatorRefs = {
    wattsSum,
    spmSum,
    splitSum,
    tickCount,
    splitTickCount,
    maxWattsRef,
    bestSplitRef,
    heartRateSum,
    heartRateCount,
    maxHeartRateRef,
    startedAtRef,
  };

  return { state, refs, resetAll, hasProfileWeight: weightKgRef.current !== null };
}
