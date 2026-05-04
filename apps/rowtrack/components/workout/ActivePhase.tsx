import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  useWindowDimensions,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { EdgeInsets } from 'react-native-safe-area-context';
import type { ConnectionStatus, HRStatus } from '@/lib/ble/types';
import type { WorkoutGoal } from '@/lib/workout-goals';
import type { GoalProgress } from '@/lib/workout-goals';
import { GOAL_TYPES } from '@/lib/workout-goals';
import { Button, Card, MetricDisplay, SummaryRow } from '@/components';
import {
  GoalSetupModal,
  ProgressBar,
  PaceZone,
  MotivationalToast,
  MilestoneOverlay,
  SplitsList,
} from '@/components/workout';
import type { PaceZoneLevel, SplitEntry } from '@/components/workout';
import { formatTimer, formatSplit, formatDistanceDynamic } from '@/lib/formatters';
import { brand, status as statusColors, text as textColors, border, fontFamily, fontSize, space, layout } from '@/constants';
import type { WorkoutMetricsState } from '@/lib/hooks/useWorkoutMetrics';
import { styles } from './workout.styles';

// --- Props ---

type Phase = 'active' | 'summary';

interface ActivePhaseProps {
  phase: Phase;
  metricsState: WorkoutMetricsState;
  // BLE
  bleStatus: ConnectionStatus;
  deviceName: string | null;
  bleError: string | null;
  startScan: () => void;
  // Goal
  goal: WorkoutGoal | null;
  goalProgress: GoalProgress | null;
  goalReached: boolean;
  isCountdown: boolean;
  paceZone: PaceZoneLevel | null;
  // Gamification
  milestoneMsg: string | null;
  toastMsg: string | null;
  dismissMilestone: () => void;
  dismissToast: () => void;
  splits: SplitEntry[];
  prFlags: { watts: boolean; split: boolean; distance: boolean };
  hasPR: boolean;
  pulseAnim: Animated.Value;
  // Computed averages
  avgWatts: number;
  avgSpm: number;
  avgSplit: number;
  // Summary
  summaryMaxWatts: number | null;
  summaryBestSplit: number | null;
  summaryAvgHr: number | null;
  // Actions
  onStop: () => void;
  onSave: () => void;
  onDiscard: () => void;
  onSetGoal: (g: WorkoutGoal) => void;
  onClearGoal: () => void;
  saving: boolean;
  hasProfileWeight: boolean;
  hrStatus: HRStatus;
  hrBpm: number | null;
  startHRScan: () => void;
  insets: EdgeInsets;
}

// --- Component ---

export function ActivePhase({
  phase,
  metricsState,
  bleStatus,
  deviceName,
  bleError,
  startScan,
  goal,
  goalProgress,
  goalReached,
  isCountdown,
  paceZone,
  milestoneMsg,
  toastMsg,
  dismissMilestone,
  dismissToast,
  splits,
  prFlags,
  hasPR,
  pulseAnim,
  avgWatts,
  avgSpm,
  avgSplit,
  summaryMaxWatts,
  summaryBestSplit,
  summaryAvgHr,
  onStop,
  onSave,
  onDiscard,
  onSetGoal,
  onClearGoal,
  saving,
  hasProfileWeight,
  hrStatus,
  hrBpm,
  startHRScan,
  insets,
}: ActivePhaseProps) {
  const { seconds, watts, spm, splitSeconds, distanceMeters, calories } = metricsState;

  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  // Card width: (screenWidth - 2*horizontalPadding - gap) / 2
  const tileWidth = (width - 2 * layout.screenHorizontal - 12) / 2;

  // Current time clock (HH:mm)
  const [clockTime, setClockTime] = useState(() => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  });

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setClockTime(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);
    };
    const id = setInterval(update, 60_000);
    return () => clearInterval(id);
  }, []);

  const [showGoalModal, setShowGoalModal] = useState(false);

  const isConnecting = useMemo(
    () => phase === 'active' && bleStatus !== 'connected',
    [phase, bleStatus],
  );

  const formattedTimer = useMemo((): string => formatTimer(seconds), [seconds]);
  const formattedSplit = useMemo((): string => formatSplit(splitSeconds), [splitSeconds]);
  const formattedDistance = useMemo(() => formatDistanceDynamic(distanceMeters), [distanceMeters]);

  const handleSetGoal = useCallback((g: WorkoutGoal) => {
    onSetGoal(g);
    setShowGoalModal(false);
  }, [onSetGoal]);

  const handleClearGoal = useCallback(() => {
    onClearGoal();
    setShowGoalModal(false);
  }, [onClearGoal]);

  const handleOpenGoalModal = useCallback(() => setShowGoalModal(true), []);
  const handleCloseGoalModal = useCallback(() => setShowGoalModal(false), []);

  // Goal type for KPI deduplication
  const goalType = goal?.type ?? null;

  // --- Dynamic focus metric ---
  function renderFocusHero() {
    if (!goal || goal.type === 'duration' || goal.type === 'distance') return null;

    if (goal.type === 'split') {
      const onTarget = avgSplit <= goal.target;
      return (
        <View style={styles.focusHero}>
          <Text
            style={[
              styles.focusValue,
              { color: onTarget ? statusColors.success : statusColors.error },
            ]}
          >
            {formatSplit(avgSplit)}
          </Text>
          <Text style={styles.focusLabel}>
            GEM. SPLIT  ·  DOEL {formatSplit(goal.target)}
          </Text>
        </View>
      );
    }

    if (goal.type === 'watts') {
      const onTarget = avgWatts >= goal.target;
      return (
        <View style={styles.focusHero}>
          <Text
            style={[
              styles.focusValue,
              { color: onTarget ? statusColors.success : statusColors.error },
            ]}
          >
            {avgWatts}W
          </Text>
          <Text style={styles.focusLabel}>
            GEM. WATT  ·  DOEL {goal.target}W
          </Text>
        </View>
      );
    }

    return null;
  }

  // --- Countdown remaining text ---
  function getCountdownText(): string | null {
    if (!goal || !isCountdown) return null;
    if (goal.type === 'duration') {
      const remaining = Math.max(0, goal.target - seconds);
      const m = Math.floor(remaining / 60);
      const s = remaining % 60;
      return `NOG ${m}:${String(Math.round(s)).padStart(2, '0')}!`;
    }
    return null;
  }

  const countdownText = getCountdownText();

  const hrConnected = hrStatus === 'connected' && hrBpm != null && hrBpm > 0;
  const hrScanning = hrStatus === 'scanning';

  function renderHRCardContent(size: 'sm' | 'md' | 'lg') {
    if (hrConnected) {
      return <MetricDisplay value={hrBpm!} label="HARTSLAG bpm" size={size} />;
    }
    return (
      <View style={{ alignItems: 'center', gap: space[1] }}>
        {hrScanning ? (
          <ActivityIndicator color={brand.primary} size="small" />
        ) : (
          <View style={{ opacity: 0.4 }}><Ionicons name="heart" size={size === 'lg' ? 36 : 20} color={textColors.muted} /></View>
        )}
        <Text style={hrCardStyles.hint}>
          {hrScanning ? 'Verbinden...' : 'Tik om te verbinden'}
        </Text>
        <Text style={hrCardStyles.label}>HARTSLAG</Text>
      </View>
    );
  }

  // Tile style with computed width and fixed borderRadius/padding
  const tileStyle = { width: tileWidth, borderRadius: 12 };
  const landscapeTileStyle = { borderRadius: 12 };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 8 }]}>
      {/* Milestone overlay */}
      <MilestoneOverlay message={milestoneMsg} onDismiss={dismissMilestone} />

      {/* Connection status overlay */}
      {isConnecting && (
        <View style={styles.connectionOverlay}>
          {bleStatus !== 'error' ? (
            <>
              <ActivityIndicator color={brand.primary} size="large" />
              <Text style={styles.connectionText}>
                {(bleStatus === 'idle' || bleStatus === 'scanning') && 'Zoeken naar roeier...'}
                {bleStatus === 'connecting' && 'Verbinden...'}
                {bleStatus === 'discovering' && 'Services ontdekken...'}
                {bleStatus === 'reconnecting' && 'Opnieuw verbinden...'}
                {bleStatus === 'disconnecting' && 'Verbinding verbreken...'}
              </Text>
            </>
          ) : (
            <>
              <Ionicons name="warning-outline" size={40} color={textColors.secondary} />
              <Text style={styles.connectionText}>{bleError}</Text>
              <Button title="Opnieuw proberen" onPress={startScan} size="md" variant="ghost" />
            </>
          )}
        </View>
      )}

      {!isConnecting && isLandscape ? (
        /* ===== LANDSCAPE LAYOUT ===== */
        <View style={landscapeStyles.root}>
          {/* Left column: timer + primary goal metric */}
          <View style={landscapeStyles.leftCol}>
            {/* Timer */}
            <View style={{ alignItems: 'center' }}>
              <View style={styles.timerRow}>
                <Text style={styles.timerLabel}>TIJD</Text>
                {bleStatus === 'connected' && (
                  <View style={styles.connectedBadge}>
                    <Ionicons name="bluetooth" size={12} color={brand.primary} />
                    <Text style={styles.connectedText}>{deviceName}</Text>
                  </View>
                )}
              </View>
              {goal?.type === 'duration' && isCountdown ? (
                <Animated.Text style={[styles.timer, { color: statusColors.error, opacity: pulseAnim }]}>
                  {countdownText}
                </Animated.Text>
              ) : (
                <Text style={styles.timer}>{formattedTimer}</Text>
              )}
            </View>

            {/* Primary goal metric */}
            {goal?.type === 'duration' && isCountdown ? (
              <Card style={landscapeStyles.bigTile}>
                <Animated.Text
                  style={[
                    styles.focusValue,
                    { color: statusColors.error, opacity: pulseAnim },
                  ]}
                >
                  {countdownText}
                </Animated.Text>
                <Text style={styles.focusLabel}>RESTERENDE TIJD</Text>
              </Card>
            ) : goal?.type === 'watts' ? (
              <Card style={landscapeStyles.bigTile}>
                <Text
                  style={[
                    styles.focusValue,
                    { color: avgWatts >= goal.target ? statusColors.success : statusColors.error },
                  ]}
                >
                  {avgWatts}W
                </Text>
                <Text style={styles.focusLabel}>
                  GEM. WATT  ·  DOEL {goal.target}W
                </Text>
              </Card>
            ) : goal?.type === 'split' ? (
              <Card style={landscapeStyles.bigTile}>
                <Text
                  style={[
                    styles.focusValue,
                    { color: avgSplit <= goal.target ? statusColors.success : statusColors.error },
                  ]}
                >
                  {formatSplit(avgSplit)}
                </Text>
                <Text style={styles.focusLabel}>
                  GEM. SPLIT  ·  DOEL {formatSplit(goal.target)}
                </Text>
              </Card>
            ) : (
              /* No goal → show distance as primary */
              <Card style={landscapeStyles.bigTile}>
                <MetricDisplay
                  value={formattedDistance.value}
                  label={`AFSTAND (${formattedDistance.unit})`}
                  size="lg"
                />
                {prFlags.distance && <Text style={styles.prBadge}>{'PR! \u{1F3C6}'}</Text>}
              </Card>
            )}

            {/* Pace Zone */}
            {paceZone && <PaceZone zone={paceZone} />}
            {!hasProfileWeight && (
              <Text style={landscapeStyles.kcalHint}>
                * Vul gewicht in je profiel in voor nauwkeurige kcal
              </Text>
            )}

            {/* Spacer pushes stop button to bottom */}
            <View style={{ flex: 1 }} />

            {/* Stop button */}
            <Button
              title="Stop"
              icon="stop"
              variant="destructive"
              size="md"
              onPress={onStop}
              style={{ width: '100%', minHeight: 48 }}
            />
          </View>

          {/* Right column: remaining KPIs in 2-column grid */}
          <ScrollView style={landscapeStyles.rightCol} contentContainerStyle={landscapeStyles.rightColContent} showsVerticalScrollIndicator={false}>
            <View style={landscapeStyles.rightGrid}>
              {goalType !== 'watts' && (
                <Card style={[landscapeStyles.gridTile, landscapeTileStyle]}>
                  <MetricDisplay value={watts} label="WATT" size="md" />
                  {prFlags.watts && <Text style={styles.prBadge}>{'PR! \u{1F3C6}'}</Text>}
                </Card>
              )}
              <Card style={[landscapeStyles.gridTile, landscapeTileStyle]}>
                <MetricDisplay value={spm} label="SPM" size="md" />
              </Card>
              <Card style={[landscapeStyles.gridTile, landscapeTileStyle]}>
                <MetricDisplay value={formattedSplit} label="SPLIT /500m" size="md" />
                {prFlags.split && <Text style={styles.prBadge}>{'PR! \u{1F3C6}'}</Text>}
              </Card>
              <Card style={[landscapeStyles.gridTile, landscapeTileStyle]}>
                <MetricDisplay
                  value={formattedDistance.value}
                  label={`AFSTAND (${formattedDistance.unit})`}
                  size="md"
                />
                {prFlags.distance && <Text style={styles.prBadge}>{'PR! \u{1F3C6}'}</Text>}
              </Card>
              <Card style={[landscapeStyles.gridTile, landscapeTileStyle]}>
                <MetricDisplay
                  value={`${Math.round(calories)}${hasProfileWeight ? '' : '*'}`}
                  label="KCAL"
                  size="md"
                />
              </Card>
              <TouchableOpacity
                activeOpacity={hrConnected ? 1 : 0.7}
                onPress={hrConnected ? undefined : startHRScan}
                disabled={hrConnected}
                style={[landscapeStyles.gridTile, landscapeTileStyle]}
              >
                <Card style={[{ width: '100%' }, !hrConnected && hrCardStyles.inactive]}>
                  {renderHRCardContent('md')}
                </Card>
              </TouchableOpacity>
              {goalType !== 'duration' && goalType !== 'distance' && (
                <Card style={[landscapeStyles.gridTile, landscapeTileStyle]}>
                  <MetricDisplay value={clockTime} label="TIJD" size="md" />
                </Card>
              )}
            </View>
          </ScrollView>
        </View>
      ) : !isConnecting ? (
        /* ===== PORTRAIT LAYOUT — fixed, no scroll ===== */
        (() => {
          const STOP_BTN_HEIGHT = 56;
          const GAP = 16;
          const topSectionHeight = height * 0.40;
          const cardWidth = (width - 32 - GAP) / 2;
          const kpiAreaHeight = height - topSectionHeight - STOP_BTN_HEIGHT - (insets.bottom + 8) - (insets.top + 16) - GAP * 2;
          const cardHeight = (kpiAreaHeight - GAP * 2) / 3;

          // Build visible KPI list — always exactly 6
          type KpiItem = { key: string; isHR?: boolean };
          const allKpis: KpiItem[] = [];
          if (goalType !== 'watts') allKpis.push({ key: 'watts' });
          allKpis.push({ key: 'spm' });
          allKpis.push({ key: 'split' });
          allKpis.push({ key: 'distance' });
          allKpis.push({ key: 'kcal' });
          allKpis.push({ key: 'hr', isHR: true });
          if (goalType !== 'duration' && goalType !== 'distance' && goalType !== null) allKpis.push({ key: 'tijd' });
          const visibleKpis = allKpis.slice(0, 6);

          function renderKpi(item: KpiItem) {
            switch (item.key) {
              case 'watts':
                return (
                  <>
                    <MetricDisplay value={watts} label="WATT" size="lg" />
                    {prFlags.watts && <Text style={styles.prBadge}>{'PR! \u{1F3C6}'}</Text>}
                  </>
                );
              case 'spm':
                return <MetricDisplay value={spm} label="SPM" size="lg" />;
              case 'split':
                return (
                  <>
                    <MetricDisplay value={formattedSplit} label="SPLIT /500m" size="lg" />
                    {prFlags.split && <Text style={styles.prBadge}>{'PR! \u{1F3C6}'}</Text>}
                  </>
                );
              case 'distance':
                return (
                  <>
                    <MetricDisplay
                      value={formattedDistance.value}
                      label={`AFSTAND (${formattedDistance.unit})`}
                      size="lg"
                    />
                    {prFlags.distance && <Text style={styles.prBadge}>{'PR! \u{1F3C6}'}</Text>}
                  </>
                );
              case 'kcal':
                return (
                  <MetricDisplay
                    value={`${Math.round(calories)}${hasProfileWeight ? '' : '*'}`}
                    label="KCAL"
                    size="lg"
                  />
                );
              case 'hr':
                return renderHRCardContent('lg');
              case 'tijd':
                return <MetricDisplay value={clockTime} label="TIJD" size="lg" />;
              default:
                return null;
            }
          }

          // Group into rows of 2
          const rows = [
            visibleKpis.slice(0, 2),
            visibleKpis.slice(2, 4),
            visibleKpis.slice(4, 6),
          ];

          return (
            <View style={{ flex: 1, overflow: 'hidden' as const }}>
              {/* Top section: timer/progress + goal */}
              <View style={{ height: topSectionHeight, justifyContent: 'center', alignItems: 'center', gap: space[3] }}>
                {/* BLE badge */}
                {bleStatus === 'connected' && (
                  <View style={styles.connectedBadge}>
                    <Ionicons name="bluetooth" size={12} color={brand.primary} />
                    <Text style={styles.connectedText}>{deviceName}</Text>
                  </View>
                )}

                {/* Timer / ProgressBar */}
                {goal ? (
                  <TouchableOpacity activeOpacity={0.7} onPress={handleOpenGoalModal} style={{ width: '100%', flex: 1 }}>
                    <ProgressBar
                      progress={goalProgress ? goalProgress.percentage / 100 : 0}
                      timerDisplay={
                        goal.type === 'duration'
                          ? formatTimer(Math.max(0, goal.target - seconds))
                          : formattedTimer
                      }
                      isCountdown={goal.type === 'duration'}
                      goalType={goal.type}
                      currentDistance={distanceMeters}
                      goalTarget={goal.target}
                    />
                  </TouchableOpacity>
                ) : (
                  <View style={{ alignItems: 'center' }}>
                    <Text style={styles.timerLabel}>TIJD</Text>
                    <Text style={styles.timer}>{formattedTimer}</Text>
                  </View>
                )}

                {renderFocusHero()}
                {paceZone && <PaceZone zone={paceZone} />}
              </View>

              {/* KPI grid — 2 columns, 3 rows, fixed height */}
              <View style={{ height: kpiAreaHeight, marginTop: GAP }}>
                {rows.map((row, ri) => (
                  <View key={ri} style={{ flexDirection: 'row', gap: GAP, height: cardHeight, marginTop: ri > 0 ? GAP : 0 }}>
                    {row.map((item) =>
                      item.isHR ? (
                        <TouchableOpacity
                          key={item.key}
                          activeOpacity={hrConnected ? 1 : 0.7}
                          onPress={hrConnected ? undefined : startHRScan}
                          disabled={hrConnected}
                          style={{ width: cardWidth, height: cardHeight }}
                        >
                          <Card style={[portraitStyles.kpiCard, !hrConnected && hrCardStyles.inactive]}>
                            {renderKpi(item)}
                          </Card>
                        </TouchableOpacity>
                      ) : (
                        <Card key={item.key} style={[portraitStyles.kpiCard, { width: cardWidth, height: cardHeight }]}>
                          {renderKpi(item)}
                        </Card>
                      ),
                    )}
                  </View>
                ))}
              </View>

              {/* Stop button */}
              <View style={{ height: STOP_BTN_HEIGHT, marginTop: GAP }}>
                <Button
                  title="Stop & Sla op"
                  icon="stop"
                  variant="destructive"
                  size="lg"
                  onPress={onStop}
                />
              </View>
            </View>
          );
        })()
      ) : null}

      {/* Goal setup (mid-workout) */}
      <GoalSetupModal
        visible={showGoalModal}
        currentGoal={goal}
        onSetGoal={handleSetGoal}
        onClearGoal={handleClearGoal}
        onClose={handleCloseGoalModal}
      />

      {/* Summary Modal */}
      <Modal
        visible={phase === 'summary'}
        transparent
        animationType="fade"
      >
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.modalScrollContent}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Workout samenvatting</Text>

              {hasPR && (
                <View style={styles.prBanner}>
                  <Text style={styles.prBannerText}>{'Nieuw persoonlijk record! \u{1F3C6}'}</Text>
                </View>
              )}

              <View style={styles.summaryGrid}>
                <SummaryRow label="Duur" value={formattedTimer} />
                <SummaryRow label="Afstand" value={`${formattedDistance.value} ${formattedDistance.unit}`} />
                <SummaryRow label="Gem. watt" value={`${avgWatts} W`} />
                {summaryMaxWatts != null && (
                  <SummaryRow label="Max watt" value={`${summaryMaxWatts} W`} />
                )}
                <SummaryRow label="Gem. SPM" value={`${avgSpm}`} />
                <SummaryRow label="Gem. split" value={`${formatSplit(avgSplit)}/500m`} />
                {summaryBestSplit != null && (
                  <SummaryRow label="Beste split" value={`${formatSplit(summaryBestSplit)}/500m`} />
                )}
                <SummaryRow label="Calorieën" value={`${Math.round(calories)} kcal`} />
                {summaryAvgHr != null && (
                  <SummaryRow label="Gem. hartslag" value={`${summaryAvgHr} bpm`} />
                )}
                {goal && (
                  <SummaryRow
                    label="Doel"
                    value={`${GOAL_TYPES[goal.type].formatTarget(goal.target)} ${goalReached ? '\u2705' : '\u274C'}`}
                  />
                )}
              </View>

              {splits.length > 0 && (
                <View style={styles.summarySplits}>
                  <Text style={styles.summarySplitsTitle}>500M SPLITS</Text>
                  {splits.map((s, i) => (
                    <SummaryRow
                      key={i}
                      label={`${formatDistanceDynamic(s.distance).value} ${formatDistanceDynamic(s.distance).unit}`}
                      value={formatSplit(s.split)}
                    />
                  ))}
                </View>
              )}

              <Button
                title="Opslaan"
                onPress={onSave}
                loading={saving}
                size="md"
              />

              <Button
                title="Annuleren"
                onPress={onDiscard}
                variant="ghost"
                disabled={saving}
                size="md"
              />
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Motivational toast — rendered last to overlay everything */}
      <MotivationalToast message={toastMsg} onDismiss={dismissToast} isGoalComplete={goalReached} />
    </View>
  );
}

const landscapeStyles = StyleSheet.create({
  root: {
    flex: 1,
    flexDirection: 'row',
    gap: space[4],
    paddingVertical: space[2],
  },
  leftCol: {
    flex: 1.2,
    alignItems: 'center',
    gap: space[4],
  },
  rightCol: {
    flex: 1,
  },
  rightColContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  rightGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  gridTile: {
    width: '48%',
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bigTile: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  kcalHint: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 11,
    color: textColors.secondary,
    opacity: 0.5,
    textAlign: 'center',
  },
});

const portraitStyles = StyleSheet.create({
  kpiCard: {
    flex: 1,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
});

const hrCardStyles = StyleSheet.create({
  inactive: {
    opacity: 0.6,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: border.default,
  },
  hint: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: fontSize['10'],
    color: textColors.secondary,
    opacity: 0.5,
  },
  label: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize['10'],
    color: textColors.muted,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
});
