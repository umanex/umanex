import { useCallback, useEffect, useState } from 'react';
import { Alert, Platform, UIManager } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { useBle } from '@/lib/ble/ble-context';
import { useWorkoutPhase } from '@/lib/workout-phase-context';
import { supabase } from '@/lib/supabase';
import type { GoalType, WorkoutGoal } from '@/lib/workout-goals';
import { userInputToTarget, targetToUserInput } from '@/lib/workout-goals';
import { useWorkoutMetrics } from '@/lib/hooks/useWorkoutMetrics';
import { useGoalProgress } from '@/lib/hooks/useGoalProgress';
import { IdlePhase } from '@/components/workout/IdlePhase';
import { ActivePhase } from '@/components/workout/ActivePhase';

if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

export default function WorkoutScreen() {
  const { user } = useAuth();
  const {
    status, deviceName, metrics: bleMetrics, error: bleError, startScan, disconnect,
    hrStatus, hrDeviceName, hrBpm, startHRScan, stopHR,
    hrDevices, hrSelecting, selectHRDevice, cancelHRSelection,
  } = useBle();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // --- Core state ---
  const { phase, setPhase } = useWorkoutPhase();
  const [saving, setSaving] = useState(false);
  const [goal, setGoal] = useState<WorkoutGoal | null>(null);

  // Idle goal setup state
  const [idleGoalType, setIdleGoalType] = useState<GoalType | null>(null);
  const [idleGoalInput, setIdleGoalInput] = useState('');
  const [idleDurMin, setIdleDurMin] = useState('');
  const [idleDurSec, setIdleDurSec] = useState('');

  // --- Hooks ---
  const { state: metricsState, refs, resetAll, hasProfileWeight } = useWorkoutMetrics(phase, bleMetrics, hrBpm);
  const {
    milestoneMsg, toastMsg, splits, goalReached, prFlags, pulseAnim,
    avgWatts, avgSpm, avgSplit, goalProgress, isCountdown, paceZone, hasPR,
    dismissMilestone, dismissToast, fetchPRs, resetGameState, resetGoalReached,
  } = useGoalProgress(phase, goal, metricsState, refs, user?.id);

  // --- Sync idle goal inputs from goal state ---
  useEffect(() => {
    if (goal) {
      setIdleGoalType(goal.type);
      if (goal.type === 'duration') {
        setIdleDurMin(String(Math.floor(goal.target / 60)));
        setIdleDurSec(String(goal.target % 60));
      } else {
        setIdleGoalInput(String(targetToUserInput(goal.type, goal.target)));
      }
    }
  }, [goal]);

  // --- Handlers ---

  const handleStart = useCallback(() => {
    if (status !== 'connected') {
      Alert.alert('Niet verbonden', 'Verbind eerst de roeitrainer via de knop bovenaan.');
      return;
    }

    // Build goal from idle inputs
    let newGoal: WorkoutGoal | null = null;
    if (idleGoalType === 'duration') {
      const target = (parseInt(idleDurMin || '0', 10) * 60) + parseInt(idleDurSec || '0', 10);
      if (target > 0) newGoal = { type: 'duration', target };
    } else if (idleGoalType) {
      const val = parseFloat(idleGoalInput);
      if (!isNaN(val) && val > 0) {
        newGoal = { type: idleGoalType, target: userInputToTarget(idleGoalType, val) };
      }
    }
    setGoal(newGoal);

    resetAll();
    resetGameState();
    fetchPRs();

    // Already connected — no startScan needed
    setPhase('active');
  }, [status, fetchPRs, resetAll, resetGameState, idleGoalType, idleDurMin, idleDurSec, idleGoalInput]);

  const handleStop = useCallback(() => {
    disconnect();
    setPhase('summary');
  }, [disconnect]);

  const handleDiscard = useCallback(() => {
    setPhase('idle');
  }, []);

  const handleSave = useCallback(async () => {
    if (!user || refs.tickCount.current === 0) return;
    setSaving(true);

    const t = refs.tickCount.current;
    const avgW = Math.round(refs.wattsSum.current / t);

    const { error } = await supabase.from('workouts').insert({
      user_id: user.id,
      started_at: refs.startedAtRef.current?.toISOString(),
      duration_seconds: metricsState.seconds,
      distance_meters: Math.round(metricsState.distanceMeters),
      avg_watts: avgW,
      avg_spm: Math.round(refs.spmSum.current / t),
      avg_split_seconds: refs.splitTickCount.current > 0
        ? Math.round(refs.splitSum.current / refs.splitTickCount.current)
        : null,
      calories: Math.round(metricsState.calories),
      max_watts: refs.maxWattsRef.current > 0 ? refs.maxWattsRef.current : null,
      best_split: refs.bestSplitRef.current < Infinity ? Math.round(refs.bestSplitRef.current) : null,
      avg_heart_rate: refs.heartRateCount.current > 0
        ? Math.round(refs.heartRateSum.current / refs.heartRateCount.current)
        : null,
      max_heart_rate: refs.maxHeartRateRef.current > 0 ? refs.maxHeartRateRef.current : null,
      resistance_level: metricsState.resistanceLevel,
      goal_type: goal?.type ?? null,
      goal_target: goal?.target ?? null,
      goal_reached: goal ? goalReached : null,
      splits: splits.length > 0 ? splits : null,
    });

    setSaving(false);
    if (!error) {
      setPhase('idle');
      router.replace('/(tabs)');
    }
  }, [user, metricsState, router, goal, goalReached, splits, refs]);

  const handleSetGoal = useCallback((g: WorkoutGoal) => {
    setGoal(g);
    resetGoalReached();
  }, [resetGoalReached]);

  const handleClearGoal = useCallback(() => {
    setGoal(null);
    resetGoalReached();
  }, [resetGoalReached]);

  // --- Summary computed values ---
  const summaryMaxWatts = refs.maxWattsRef.current > 0 ? refs.maxWattsRef.current : null;
  const summaryBestSplit = refs.bestSplitRef.current < Infinity ? Math.round(refs.bestSplitRef.current) : null;
  const summaryAvgHr = refs.heartRateCount.current > 0
    ? Math.round(refs.heartRateSum.current / refs.heartRateCount.current)
    : null;

  // --- Render ---

  if (phase === 'idle') {
    return (
      <IdlePhase
        bleStatus={status}
        deviceName={deviceName}
        bleError={bleError}
        onConnect={startScan}
        onDisconnect={disconnect}
        hrStatus={hrStatus}
        hrDeviceName={hrDeviceName}
        onHRConnect={startHRScan}
        onHRDisconnect={stopHR}
        hrDevices={hrDevices}
        hrSelecting={hrSelecting}
        onSelectHRDevice={selectHRDevice}
        onCancelHRSelection={cancelHRSelection}
        idleGoalType={idleGoalType}
        setIdleGoalType={setIdleGoalType}
        idleGoalInput={idleGoalInput}
        setIdleGoalInput={setIdleGoalInput}
        idleDurMin={idleDurMin}
        setIdleDurMin={setIdleDurMin}
        idleDurSec={idleDurSec}
        setIdleDurSec={setIdleDurSec}
        onStart={handleStart}
        insets={insets}
      />
    );
  }

  return (
    <ActivePhase
      phase={phase}
      metricsState={metricsState}
      bleStatus={status}
      deviceName={deviceName}
      bleError={bleError}
      startScan={startScan}
      goal={goal}
      goalProgress={goalProgress}
      goalReached={goalReached}
      isCountdown={isCountdown}
      paceZone={paceZone}
      milestoneMsg={milestoneMsg}
      toastMsg={toastMsg}
      dismissMilestone={dismissMilestone}
      dismissToast={dismissToast}
      splits={splits}
      prFlags={prFlags}
      hasPR={hasPR}
      pulseAnim={pulseAnim}
      avgWatts={avgWatts}
      avgSpm={avgSpm}
      avgSplit={avgSplit}
      summaryMaxWatts={summaryMaxWatts}
      summaryBestSplit={summaryBestSplit}
      summaryAvgHr={summaryAvgHr}
      onStop={handleStop}
      onSave={handleSave}
      onDiscard={handleDiscard}
      onSetGoal={handleSetGoal}
      onClearGoal={handleClearGoal}
      saving={saving}
      hasProfileWeight={hasProfileWeight}
      hrStatus={hrStatus}
      hrBpm={hrBpm}
      startHRScan={startHRScan}
      insets={insets}
    />
  );
}
