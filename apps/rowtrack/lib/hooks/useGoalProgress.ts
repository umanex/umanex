import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated } from 'react-native';
import * as Haptics from 'expo-haptics';
import { supabase } from '@/lib/supabase';
import { calculateProgress } from '@/lib/workout-goals';
import type { WorkoutGoal } from '@/lib/workout-goals';
import { getPaceZone } from '@/components/workout';
import type { PaceZoneLevel, SplitEntry } from '@/components/workout';
import type { WorkoutMetricsState, AccumulatorRefs } from './useWorkoutMetrics';

// --- Milestone messages ---

const MILESTONE_MESSAGES: Record<number, string> = {
  25: 'Op dreef! \u{1F4AA}',
  50: 'Halverwege! Blijf gaan! \u{1F525}',
  75: 'Bijna daar! Geef alles! \u{26A1}',
  100: 'DOEL BEREIKT! \u{1F3C6}',
};

// --- Motivational messages ---

const MOTIVATIONAL: Record<PaceZoneLevel, string[]> = {
  on_pace: ['Perfecte pace, hou vol!', 'Geweldig ritme!', 'Zo moet het!'],
  slightly_off: ['Kom op, iets meer gas!', 'Je kan sneller!', 'Trek het tempo op!'],
  off_pace: ['Geef alles wat je hebt!', 'Push door!', 'Niet opgeven!'],
};

// --- PR types ---

interface PersonalRecords {
  bestAvgWatts: number | null;
  bestAvgSplit: number | null;
  bestDistance: number | null;
}

// --- Hook ---

type Phase = 'idle' | 'active' | 'summary';

export function useGoalProgress(
  phase: Phase,
  goal: WorkoutGoal | null,
  metricsState: WorkoutMetricsState,
  refs: AccumulatorRefs,
  userId: string | undefined,
) {
  const { seconds, distanceMeters, splitSeconds } = metricsState;

  // State
  const [milestoneMsg, setMilestoneMsg] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [splits, setSplits] = useState<SplitEntry[]>([]);
  const [goalReached, setGoalReached] = useState(false);
  const [prFlags, setPrFlags] = useState<{ watts: boolean; split: boolean; distance: boolean }>({
    watts: false, split: false, distance: false,
  });

  // Refs
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const goalReachedRef = useRef(false);
  const milestonesHit = useRef(new Set<string>());
  const lastToastTime = useRef(0);
  const lastSplitDistance = useRef(0);
  const splitStartSeconds = useRef(0);
  const personalRecords = useRef<PersonalRecords>({
    bestAvgWatts: null, bestAvgSplit: null, bestDistance: null,
  });

  // --- Computed (useMemo) ---

  const avgWatts = useMemo(() => {
    const tc = refs.tickCount.current || 1;
    return Math.round(refs.wattsSum.current / tc);
  }, [seconds, refs]);

  const avgSpm = useMemo(() => {
    const tc = refs.tickCount.current || 1;
    return Math.round(refs.spmSum.current / tc);
  }, [seconds, refs]);

  const avgSplit = useMemo(() => {
    const tc = refs.splitTickCount.current || 1;
    return Math.round(refs.splitSum.current / tc);
  }, [seconds, refs]);

  const goalProgress = useMemo(() => {
    if (!goal) return null;
    return calculateProgress(goal, {
      seconds,
      distanceMeters,
      splitSeconds,
      avgWatts: refs.tickCount.current > 0
        ? Math.round(refs.wattsSum.current / refs.tickCount.current)
        : 0,
    });
  }, [goal, seconds, distanceMeters, splitSeconds, refs]);

  const isCountdown = useMemo(
    () => goalProgress != null && goalProgress.percentage >= 90 && !goalProgress.reached,
    [goalProgress],
  );

  const paceZone = useMemo((): PaceZoneLevel | null => {
    if (!goal || (goal.type !== 'split' && goal.type !== 'watts')) return null;
    if (refs.tickCount.current < 5) return null;
    if (goal.type === 'split') return getPaceZone(avgSplit, goal.target, true);
    return getPaceZone(goal.target, avgWatts, false);
  }, [goal, avgSplit, avgWatts, refs]);

  const hasPR = useMemo(
    () => prFlags.watts || prFlags.split || prFlags.distance,
    [prFlags],
  );

  // --- Fetch personal records ---
  const fetchPRs = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase
      .from('workouts')
      .select('avg_watts, avg_split_seconds, distance_meters')
      .eq('user_id', userId)
      .order('started_at', { ascending: false })
      .limit(100);

    if (data && data.length > 0) {
      let bestW: number | null = null;
      let bestS: number | null = null;
      let bestD: number | null = null;
      for (const w of data) {
        if (w.avg_watts != null && (bestW == null || w.avg_watts > bestW)) bestW = w.avg_watts;
        if (w.avg_split_seconds != null && (bestS == null || w.avg_split_seconds < bestS)) bestS = w.avg_split_seconds;
        if (w.distance_meters != null && (bestD == null || w.distance_meters > bestD)) bestD = w.distance_meters;
      }
      personalRecords.current = { bestAvgWatts: bestW, bestAvgSplit: bestS, bestDistance: bestD };
    }
  }, [userId]);

  // --- Goal progress + milestones + countdown haptics ---
  useEffect(() => {
    if (phase !== 'active' || !goal || !goalProgress) return;

    // Goal reached
    if (goalProgress.reached && !goalReachedRef.current) {
      goalReachedRef.current = true;
      setGoalReached(true);
    }

    // Percentage milestones
    for (const pct of [25, 50, 75, 100]) {
      const key = `pct_${pct}`;
      if (goalProgress.percentage >= pct && !milestonesHit.current.has(key)) {
        milestonesHit.current.add(key);
        setMilestoneMsg(MILESTONE_MESSAGES[pct]);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      }
    }

    // Countdown haptics at 90%, 95%, 99%
    for (const pct of [90, 95, 99]) {
      const key = `countdown_${pct}`;
      if (goalProgress.percentage >= pct && !milestonesHit.current.has(key)) {
        milestonesHit.current.add(key);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      }
    }
  }, [phase, goal, goalProgress]);

  // --- 500m split tracking ---
  useEffect(() => {
    if (phase !== 'active') return;

    const nextMilestone = lastSplitDistance.current + 500;
    if (distanceMeters >= nextMilestone) {
      const splitTime = seconds - splitStartSeconds.current;
      setSplits((prev) => [...prev, { distance: nextMilestone, split: splitTime }]);

      const key = `dist_${nextMilestone}`;
      if (!milestonesHit.current.has(key)) {
        milestonesHit.current.add(key);
        if (goal?.type === 'distance') {
          setMilestoneMsg(`${nextMilestone}m \u2713`);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        }
      }

      lastSplitDistance.current = nextMilestone;
      splitStartSeconds.current = seconds;
    }
  }, [phase, distanceMeters, seconds, goal]);

  // --- Motivational messages ---
  useEffect(() => {
    if (phase !== 'active' || !goal) return;
    if (goal.type !== 'split' && goal.type !== 'watts') return;
    if (toastMsg !== null) return;
    if (seconds < 30) return;

    const now = Date.now();
    if (now - lastToastTime.current < 90_000) return;

    let zone: PaceZoneLevel;
    if (goal.type === 'split') {
      zone = getPaceZone(avgSplit, goal.target, true);
    } else {
      zone = getPaceZone(goal.target, avgWatts, false);
    }

    const messages = MOTIVATIONAL[zone];
    const msg = messages[Math.floor(Math.random() * messages.length)];
    lastToastTime.current = now;
    setToastMsg(msg);
  }, [phase, goal, seconds, toastMsg, avgSplit, avgWatts]);

  // --- PR checking ---
  useEffect(() => {
    if (phase !== 'active') return;
    const tc = refs.tickCount.current;
    if (tc < 10) return;

    const pr = personalRecords.current;
    const dist = Math.round(distanceMeters);

    const newWatts = pr.bestAvgWatts != null && avgWatts > pr.bestAvgWatts;
    const newSplit = pr.bestAvgSplit != null && avgSplit > 0 && avgSplit < pr.bestAvgSplit;
    const newDistance = pr.bestDistance != null && dist > pr.bestDistance;

    const hasChange =
      newWatts !== prFlags.watts ||
      newSplit !== prFlags.split ||
      newDistance !== prFlags.distance;

    if (hasChange) {
      setPrFlags({ watts: newWatts, split: newSplit, distance: newDistance });
    }
  }, [phase, seconds, distanceMeters, avgWatts, avgSplit, refs, prFlags]);

  // --- Countdown pulse animation ---
  useEffect(() => {
    if (phase !== 'active' || !goal || !goalProgress) {
      pulseAnim.setValue(1);
      return;
    }

    if (goalProgress.percentage >= 90 && !goalProgress.reached) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.4,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ]),
      );
      loop.start();
      return () => loop.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [phase, goal, goalProgress]); // pulseAnim is stable ref, excluded from deps

  // --- Dismiss callbacks ---
  const dismissMilestone = useCallback(() => setMilestoneMsg(null), []);
  const dismissToast = useCallback(() => setToastMsg(null), []);

  // --- Reset gamification state ---
  const resetGameState = useCallback(() => {
    goalReachedRef.current = false;
    setGoalReached(false);
    milestonesHit.current.clear();
    lastToastTime.current = 0;
    lastSplitDistance.current = 0;
    splitStartSeconds.current = 0;
    setSplits([]);
    setMilestoneMsg(null);
    setToastMsg(null);
    setPrFlags({ watts: false, split: false, distance: false });
  }, []);

  // --- Reset goal reached (for mid-workout goal changes) ---
  const resetGoalReached = useCallback(() => {
    goalReachedRef.current = false;
    setGoalReached(false);
    milestonesHit.current.clear();
  }, []);

  return {
    // State
    milestoneMsg,
    toastMsg,
    splits,
    goalReached,
    prFlags,
    pulseAnim,
    // Computed
    avgWatts,
    avgSpm,
    avgSplit,
    goalProgress,
    isCountdown,
    paceZone,
    hasPR,
    // Actions
    dismissMilestone,
    dismissToast,
    fetchPRs,
    resetGameState,
    resetGoalReached,
  };
}
