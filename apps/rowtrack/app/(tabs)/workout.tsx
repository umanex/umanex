import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState, Platform, UIManager } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { useBle } from '@/lib/ble/ble-context';
import { useHealthConsent } from '@/lib/health-consent-context';
import { useWorkoutPhase } from '@/lib/workout-phase-context';
import { supabase } from '@/lib/supabase';
import { reportError } from '@/lib/monitoring';
import { savePendingWorkout, clearPendingWorkout, UNIQUE_VIOLATION } from '@/lib/pendingWorkout';
import { markPrMetricsMissing } from '@/lib/prColumn';
/** Postgres: kolom bestaat niet. Zie de fallback in saveWorkout. */
const UNDEFINED_COLUMN = '42703';
/** Minimum aantal BLE-ticks voordat een rit een record mág zijn. */
const MIN_PR_TICKS = 10;
import type { GoalType, WorkoutGoal } from '@/lib/workout-goals';
import { userInputToTarget, targetToUserInput } from '@/lib/workout-goals';
import { useWorkoutMetrics } from '@/lib/hooks/useWorkoutMetrics';
import { useGoalProgress } from '@/lib/hooks/useGoalProgress';
import { bestTimeForDistance } from '@/lib/bestDistanceTime';
import { buildPrEntries, type PrEntry } from '@/lib/personalRecords';
import { IdlePhase } from '@/components/workout/IdlePhase';
import { ActivePhase } from '@/components/workout/ActivePhase';
import { t } from '@/i18n';

if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

/** Zonder toestemming voor gezondheidsgegevens doet de hartslag-rij niets. */
const noop = () => {};

export default function WorkoutScreen() {
  const { user } = useAuth();
  const {
    status, deviceName, metrics: bleMetrics, error: bleError, startScan, disconnect,
    hrStatus, hrDeviceName, hrBpm, hrError, startHRScan, stopHR,
    devices, picking, selectDevice, cancelSelection, autoConnect,
  } = useBle();
  const { granted: healthGranted } = useHealthConsent();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // --- Core state ---
  const { phase, setPhase } = useWorkoutPhase();
  const [goal, setGoal] = useState<WorkoutGoal | null>(null);

  // Idle goal setup state
  const [idleGoalType, setIdleGoalType] = useState<GoalType | null>(null);
  const [idleGoalInput, setIdleGoalInput] = useState('');
  const [idleDurMin, setIdleDurMin] = useState('');
  const [idleDurSec, setIdleDurSec] = useState('');

  // --- Hooks ---
  const { state: metricsState, refs, resetAll, hasProfileWeight } = useWorkoutMetrics(phase, bleMetrics, hrBpm);
  const {
    toastMsg, splits, goalReached, pulseAnim,
    avgWatts, avgSpm, avgSplit, isCountdown, paceZone,
    dismissToast, fetchPRs, resetGameState, prBaseline,
  } = useGoalProgress(phase, goal, metricsState, refs, user?.id);

  /**
   * De records die déze rit gebroken heeft, met de waarde die ze verving. Wordt één keer
   * gevuld bij het opslaan — uit de eindwaarden, niet uit een lopend gemiddelde — en
   * voedt zowel de samenvatting als `workouts.pr_metrics`.
   */
  const [prEntries, setPrEntries] = useState<PrEntry[]>([]);

  // Einde-van-rit guards: rit exact één keer opslaan, doel-einde exact één keer afhandelen.
  const savedRef = useRef(false);
  const goalEndedRef = useRef(false);

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
      Alert.alert(t.workout.notConnectedTitle, t.workout.notConnectedBody);
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
    setPrEntries([]);
    fetchPRs();
    savedRef.current = false;
    goalEndedRef.current = false;

    // Already connected — no startScan needed
    setPhase('active');
  }, [status, fetchPRs, resetAll, resetGameState, idleGoalType, idleDurMin, idleDurSec, idleGoalInput]);

  // Slaat de rit op de achtergrond op — exact één keer (savedRef). Een lege rit (geen
  // tick-data) wordt overgeslagen. Bij netwerkfout vangt de pendingWorkout-backstop +
  // home-focus-retry het op (security-audit P2-4); géén alert, want dit draait op de
  // achtergrond terwijl de gebruiker al richting de samenvatting is.
  const saveWorkout = useCallback(async () => {
    if (!user) return;
    if (savedRef.current) return;
    if (refs.tickCount.current === 0) return;
    savedRef.current = true;

    // Elk gemiddelde deelt door de teller die in dezelfde guard optelt als zijn som —
    // niet door tickCount. Die telt ook packets waarin het veld ontbrak (idle-nulling,
    // losse hr-update) en drukt het gemiddelde dan met de duty-cycle omlaag.
    const avgW = refs.wattsCount.current > 0
      ? Math.round(refs.wattsSum.current / refs.wattsCount.current)
      : null;

    // Exacte beste 2000m uit de {tijd, afstand}-tijdreeks (two-pointer + interpolatie).
    // null wanneer de sessie < 2000m was. Samples compact als [t, d]-tuples opgeslagen.
    const samples = refs.samplesRef.current;
    const best2k = bestTimeForDistance(samples, 2000);
    // Zonder toestemming voor gezondheidsgegevens gaat de hartslag er hier uit —
    // aan de bron, niet pas bij het tonen. Anders zou hij alsnog in de database
    // belanden en is de toestemming een schermpje zonder gevolg.
    const sampleTuples = samples.length > 0
      ? samples.map((s) => (healthGranted && s.hr != null ? [s.t, s.d, s.hr] : [s.t, s.d]))
      : null;

    const avgSplitFinal = refs.splitTickCount.current > 0
      ? Math.round(refs.splitSum.current / refs.splitTickCount.current)
      : null;
    const distanceFinal = Math.round(metricsState.distanceMeters);

    // Eén beoordeling, op de eindwaarden die de gebruiker ook in de samenvatting ziet.
    // `prBaseline` is de stand van vóór deze rit (opgehaald bij de start), dus een record
    // meet zich nooit tegen zichzelf.
    //
    // De tick-drempel komt van de vroegere live-check: een sprintje van een paar seconden
    // heeft een hoog gemiddeld vermogen en zou anders een onverslaanbaar record neerzetten
    // (de historiek bevat zulke ritten al — 34 m op 2026-07-16).
    const entries = refs.tickCount.current < MIN_PR_TICKS ? [] : buildPrEntries(
      {
        avg_watts: avgW,
        avg_split_seconds: avgSplitFinal,
        distance_meters: distanceFinal,
        best_2k_seconds: best2k,
      },
      prBaseline.current,
    );
    setPrEntries(entries);

    const row = {
      user_id: user.id,
      started_at: refs.startedAtRef.current?.toISOString() ?? new Date().toISOString(),
      // Alle waardes die in integer-kolommen landen worden afgerond — de rauwe
      // BLE-/max-waardes kunnen floats zijn (bv. max_spm 45.5) en Postgres weigert
      // die anders ("invalid input syntax for type integer").
      duration_seconds: Math.round(metricsState.seconds),
      distance_meters: distanceFinal,
      avg_watts: avgW,
      avg_spm: refs.spmCount.current > 0
        ? Math.round(refs.spmSum.current / refs.spmCount.current)
        : null,
      avg_split_seconds: avgSplitFinal,
      calories: Math.round(metricsState.calories),
      max_watts: refs.maxWattsRef.current > 0 ? Math.round(refs.maxWattsRef.current) : null,
      max_spm: refs.maxSpmRef.current > 0 ? Math.round(refs.maxSpmRef.current) : null,
      best_split: refs.bestSplitRef.current < Infinity ? Math.round(refs.bestSplitRef.current) : null,
      avg_heart_rate: healthGranted && refs.heartRateCount.current > 0
        ? Math.round(refs.heartRateSum.current / refs.heartRateCount.current)
        : null,
      max_heart_rate: healthGranted && refs.maxHeartRateRef.current > 0
        ? Math.round(refs.maxHeartRateRef.current)
        : null,
      resistance_level: metricsState.resistanceLevel != null ? Math.round(metricsState.resistanceLevel) : null,
      goal_type: goal?.type ?? null,
      goal_target: goal?.target ?? null,
      goal_reached: goal ? goalReached : null,
      splits: splits.length > 0 ? splits : null,
      // `is_pr` blijft de goedkope filter; `pr_metrics` draagt de reden. Ze komen uit
      // dezelfde lijst, dus ze kunnen niet uit elkaar lopen.
      is_pr: entries.length > 0 || null,
      pr_metrics: entries.length > 0 ? entries : null,
      samples: sampleTuples,
      best_2k_seconds: best2k,
      total_strokes: refs.totalStrokesRef.current > 0 ? refs.totalStrokesRef.current : null,
    };

    let { error } = await supabase.from('workouts').insert(row);

    // Overgangsmaatregel, bewust een patch: `pr_metrics` komt via een handmatige migratie
    // (supabase/migrations/add_workout_pr_metrics.sql). Draait deze app-versie vóór die
    // migratie, dan zou een ontbrekende kolom een échte rit kosten — en de reden van een
    // record weegt niet op tegen de rit zelf. Weg zodra de migratie overal gedraaid is.
    if (error?.code === UNDEFINED_COLUMN) {
      markPrMetricsMissing();
      const { pr_metrics: _pending, ...rowWithoutPrMetrics } = row;
      ({ error } = await supabase.from('workouts').insert(rowWithoutPrMetrics));
      // Alleen melden wanneer de tweede poging slaagde: bij een échte fout rapporteert de
      // tak hieronder al, en twee meldingen over hetzelfde voorval lezen als twee fouten.
      if (!error) {
        reportError(new Error('workouts.pr_metrics ontbreekt — rit opgeslagen zonder PR-detail'), {
          where: 'workout.save.prMetricsFallback',
        });
      }
    }

    if (error && error.code !== UNIQUE_VIOLATION) {
      await savePendingWorkout(row);
      reportError(error, { where: 'workout.save' });
    } else {
      // Identiteits-gebonden: raakt de slot alleen als hij déze rit bevat, zodat
      // een andere rit die nog op een nieuwe poging wacht blijft staan.
      await clearPendingWorkout(row);
    }
  }, [user, metricsState, goal, goalReached, splits, refs, prBaseline, healthGranted]);

  // Bij het openen van dit scherm verbinden met de toestellen van vorige keer.
  // Alleen in de idle-fase: tijdens een rit staat er al een verbinding, en op de
  // samenvatting hoort de app niets meer te zoeken. Bewust hier en niet bij
  // app-start — dan zou de app ook Bluetooth doen als je enkel je historiek bekijkt.
  useFocusEffect(
    useCallback(() => {
      // Op de samenvatting hoort de app niets meer te zoeken.
      if (phase === 'summary') return;
      // Zonder toestemming blijft de hartslagmeter buiten beeld — ook hier, niet
      // alleen achter de knop.
      if (phase === 'idle') autoConnect({ hr: healthGranted });

      // Terugkeren uit een andere app is het tweede moment waarop een toestel weg
      // kan zijn — en daar kwam niets langs dat het merkte: `useFocusEffect` vuurt
      // niet op een app-wissel, dus een verbinding die tijdens het wegkijken sneuvelde
      // bleef de rest van de rit weg. Bewust óók in de active-fase: juist dán kijk je
      // even weg. `autoConnect` slaat alles over wat al hangt, bezig is of door de
      // gebruiker zelf verbroken werd, dus in het normale geval kost dit niets.
      const sub = AppState.addEventListener('change', (next) => {
        if (next !== 'active') return;
        autoConnect({ hr: healthGranted });
      });
      return () => sub.remove();
    }, [phase, autoConnect, healthGranted]),
  );

  // Handmatig stoppen → rit opslaan (achtergrond) + BLE stoppen + naar de samenvatting.
  const handleStop = useCallback(() => {
    saveWorkout();
    // `auto`: het einde van een rit is geen keuze om niet meer te verbinden, dus
    // autoconnect blijft voor de volgende sessie gewoon aan staan.
    disconnect({ auto: true });
    stopHR({ auto: true });
    setPhase('summary');
  }, [saveWorkout, disconnect, stopHR]);

  // Samenvatting "Ga verder" → naar huis (de rit is al op de achtergrond opgeslagen).
  const handleContinue = useCallback(() => {
    setPhase('idle');
    router.replace('/(tabs)');
  }, [router]);

  // Celebration "Ga verder" → naar de samenvatting (rit al opgeslagen + BLE al gestopt).
  const handleCelebrationContinue = useCallback(() => {
    dismissToast();
    setPhase('summary');
  }, [dismissToast]);

  // Doel bereikt → rit meteen op de achtergrond opslaan + BLE stoppen (net als een
  // handmatige stop). De celebration (toastMsg uit useGoalProgress) verschijnt; "Ga
  // verder" leidt naar de samenvatting. Exact één keer via goalEndedRef.
  useEffect(() => {
    if (phase === 'active' && goalReached && !goalEndedRef.current) {
      goalEndedRef.current = true;
      saveWorkout();
      disconnect({ auto: true });
      // Ook de hartslagmeter loslaten, symmetrisch met de roeier. Bleef die hangen,
      // dan adverteerde de band niet meer en was hij bij de volgende rit onvindbaar
      // — de app hield zelf vast wat ze daarna zocht.
      stopHR({ auto: true });
    }
  }, [phase, goalReached, saveWorkout, disconnect, stopHR]);

  // --- Summary computed values ---
  const summaryMaxWatts = refs.maxWattsRef.current > 0 ? refs.maxWattsRef.current : null;
  const summaryBestSplit = refs.bestSplitRef.current < Infinity ? Math.round(refs.bestSplitRef.current) : null;
  const summaryAvgHr = refs.heartRateCount.current > 0
    ? Math.round(refs.heartRateSum.current / refs.heartRateCount.current)
    : null;
  const summaryMaxSpm = refs.maxSpmRef.current > 0 ? Math.round(refs.maxSpmRef.current) : null;
  const summaryMaxHr = refs.maxHeartRateRef.current > 0 ? refs.maxHeartRateRef.current : null;
  const summaryTotalStrokes = refs.totalStrokesRef.current > 0 ? refs.totalStrokesRef.current : null;

  // --- Render ---

  if (phase === 'idle') {
    return (
      <IdlePhase
        bleStatus={status}
        deviceName={deviceName}
        onConnect={startScan}
        onDisconnect={disconnect}
        hrStatus={hrStatus}
        hrDeviceName={hrDeviceName}
        hrError={healthGranted ? hrError : t.consent.hrBlocked}
        onHRConnect={healthGranted ? startHRScan : noop}
        onHRDisconnect={stopHR}
        devices={devices}
        picking={picking}
        onSelectDevice={selectDevice}
        onCancelSelection={cancelSelection}
        idleGoalType={idleGoalType}
        setIdleGoalType={setIdleGoalType}
        setIdleGoalInput={setIdleGoalInput}
        setIdleDurMin={setIdleDurMin}
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
      isCountdown={isCountdown}
      paceZone={paceZone}
      toastMsg={toastMsg}
      splits={splits}
      prEntries={prEntries}
      pulseAnim={pulseAnim}
      avgWatts={avgWatts}
      avgSpm={avgSpm}
      avgSplit={avgSplit}
      summaryMaxWatts={summaryMaxWatts}
      summaryBestSplit={summaryBestSplit}
      summaryAvgHr={summaryAvgHr}
      summaryMaxSpm={summaryMaxSpm}
      summaryMaxHr={summaryMaxHr}
      summaryTotalStrokes={summaryTotalStrokes}
      onStop={handleStop}
      onContinue={handleContinue}
      onGoalContinue={handleCelebrationContinue}
      hasProfileWeight={hasProfileWeight}
      hrStatus={hrStatus}
      hrBpm={hrBpm}
      startHRScan={startHRScan}
      insets={insets}
    />
  );
}
