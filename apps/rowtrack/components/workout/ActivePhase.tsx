import { type ReactNode, useMemo, useState } from 'react';
import {
  View,
  Text,
  Modal,
  ActivityIndicator,
  Animated,
  TouchableOpacity,
  useWindowDimensions,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import type { EdgeInsets } from 'react-native-safe-area-context';
import type { ConnectionStatus, HRStatus } from '@/lib/ble/types';
import type { WorkoutGoal } from '@/lib/workout-goals';
import { Button, KpiSingle } from '@/components';
import { MotivationalToast } from '@/components/workout';
import type { PaceZoneLevel, SplitEntry } from '@/components/workout';
import { formatTimer, formatTimerFull, formatSplit, formatDistanceDynamic, formatInt, formatDecimal, correctSpm } from '@/lib/formatters';
import { useSpmHalved } from '@/lib/hooks/useSpmHalved';
import type { PrEntry } from '@/lib/personalRecords';
import { prMetricLabel, formatPrValue, formatPrPrevious, prEntrySpoken } from '@/lib/prDisplay';
import { t } from '@/i18n';
import { bg, fg, accent, achievement, body, border, progressBar, buttonTokens, fontFamily, space, radii, componentRadius, fontSize, typeStyles, layout } from '@/constants';
import type { WorkoutMetricsState } from '@/lib/hooks/useWorkoutMetrics';
import { styles } from './workout.styles';

// --- Types ---
type Phase = 'active' | 'summary';

// --- Props ---
type ActivePhaseProps = {
  phase: Phase;
  metricsState: WorkoutMetricsState;
  bleStatus: ConnectionStatus;
  deviceName: string | null;
  bleError: string | null;
  startScan: () => void;
  goal: WorkoutGoal | null;
  isCountdown: boolean;
  paceZone: PaceZoneLevel | null;
  toastMsg: string | null;
  splits: SplitEntry[];
  /** De records die deze rit brak, met de waarde die ze vervingen. Leeg = geen record. */
  prEntries: readonly PrEntry[];
  pulseAnim: Animated.Value;
  avgWatts: number;
  avgSpm: number;
  avgSplit: number;
  summaryMaxWatts: number | null;
  summaryBestSplit: number | null;
  summaryAvgHr: number | null;
  summaryMaxSpm: number | null;
  summaryMaxHr: number | null;
  summaryTotalStrokes: number | null;
  onStop: () => void;
  onContinue: () => void;
  onGoalContinue: () => void;
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
  bleError,
  startScan,
  goal,
  toastMsg,
  splits,
  prEntries,
  avgWatts,
  avgSpm,
  avgSplit,
  summaryMaxWatts,
  summaryBestSplit,
  summaryAvgHr,
  summaryMaxSpm,
  summaryMaxHr,
  summaryTotalStrokes,
  onStop,
  onContinue,
  onGoalContinue,
  hasProfileWeight,
  hrStatus,
  hrBpm,
  startHRScan,
  insets,
}: ActivePhaseProps) {
  const { seconds, distanceMeters, calories } = metricsState;
  // Live weergave: gesmoothe huidige metingen (EMA), niet de sessie-gemiddelden.
  // De rauwe watts/spm/splitSeconds in metricsState blijven de opslag-/doel-bron.
  const wattsDisplay = metricsState.wattsSmoothed;
  const spmDisplay = metricsState.spmSmoothed;
  const splitDisplay = metricsState.splitSmoothed;

  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const spmHalved = useSpmHalved();

  // Landscape 50/50: measure the row and hand each column an explicit half-width.
  // A definite width can't be content-sized by the engine, so the split holds on
  // any RN version/architecture (old arch resolves `flex:1` → flexBasis 'auto',
  // which lets the wide KPI column starve the metric column — hero wraps).
  const [landColWidth, setLandColWidth] = useState<number | null>(null);
  const landColStyle = landColWidth != null
    ? { width: landColWidth, flexGrow: 0, flexShrink: 0 }
    : landscapeStyles.colGrow;

  const isConnecting = useMemo(
    () => phase === 'active' && bleStatus !== 'connected',
    [phase, bleStatus],
  );

  const formattedTimer = useMemo((): string => formatTimer(seconds), [seconds]);
  const formattedDistance = useMemo(() => formatDistanceDynamic(distanceMeters), [distanceMeters]);

  const summaryDateLabel = useMemo(() => {
    if (phase !== 'summary') return '';
    const now = new Date();
    const h = String(now.getHours());
    const m = String(now.getMinutes()).padStart(2, '0');
    return t.workout.summary.todayAt(`${h}:${m}`);
  }, [phase]);

  // --- DOEL-pill waarde (nieuw compact/lowercase design) ---
  // Alle doeltypes volgen {waarde} {eenheid} met spatie: "Geen" / "20 min" /
  // "10 km" / "2:20 split" / "180 W". Split neemt de frame-copy over; watts houdt
  // bewust de spatie (Figma toont "180W", 2026-07-14 gelijkgetrokken op het patroon).
  // Doel-pill: waarde en eenheid gesplitst — waarde bold, eenheid ernaast in italic
  // (Figma header 290:2873, bv. "180" + "W"). "Geen" heeft geen eenheid.
  function goalPillParts(): { value: string; unit: string | null } {
    if (!goal) return { value: t.workout.active.goalNone, unit: null };
    switch (goal.type) {
      case 'duration': {
        const m = Math.floor(goal.target / 60);
        const s = goal.target % 60;
        return { value: s === 0 ? `${m}` : `${m}:${String(s).padStart(2, '0')}`, unit: 'min' };
      }
      case 'distance': {
        if (goal.target >= 1000) {
          const km = goal.target / 1000;
          return { value: Number.isInteger(km) ? formatInt(km) : formatDecimal(km, 1), unit: 'km' };
        }
        return { value: formatInt(goal.target), unit: 'm' };
      }
      case 'split':
        return { value: formatSplit(goal.target, true), unit: t.workout.active.goalUnitSplit };
      case 'watts':
        return { value: `${goal.target}`, unit: 'W' };
    }
  }

  // --- Hero-getal + subtitle + progress-fill per doeltype (gedeeld portrait/landscape) ---
  type FillKind = 'none' | 'gradient' | 'success' | 'warning';
  function computeGoalView(): { heroLabel: string | null; heroText: string; subLabel: string | null; subtitle: ReactNode; fillPct: number; fillKind: FillKind } {
    const goalType = goal?.type ?? null;
    // Eyebrow-labels maken het hero-getal ondubbelzinnig: bij een doel telt de hero
    // AF (resterend), zonder label leest dat verkeerd (audit F3). Defaults = geen doel.
    let heroLabel: string | null = t.workout.active.totalTime;
    let heroText = formattedTimer;
    let subLabel: string | null = t.workout.active.totalDistance;
    let subtitle: ReactNode = null;
    let fillPct = 0;
    let fillKind: FillKind = 'none';

    // Subtitle-rij voor duration/distance: verstreken waarde · divider · "{n}%" (floor).
    // Twee gelijk-brede kolommen (flex:1) met de linkerwaarde rechts- en de rechter-
    // waarde links-uitgelijnd, zodat de cijfers naar buiten groeien en de 2px-divider
    // statisch gecentreerd blijft bij wisselende live-cijfers (Figma 391:2436).
    const progressRow = (left: string, p: number) => (
      <View style={activeStyles.subtitleRow}>
        <Text style={[activeStyles.subtitleText, activeStyles.subtitleValueLeft]}>{left}</Text>
        <View style={activeStyles.subtitleDivider} />
        <Text style={[activeStyles.subtitleText, activeStyles.subtitleValueRight]}>{`${Math.floor(p * 100)}%`}</Text>
      </View>
    );

    switch (goalType) {
      case 'duration': {
        const target = goal!.target;
        fillPct = target > 0 ? Math.min(1, seconds / target) : 0;
        fillKind = 'gradient';
        heroLabel = t.workout.active.remainingTime;
        heroText = formatTimer(Math.max(0, target - seconds));
        subLabel = t.workout.active.covered;
        subtitle = progressRow(formatTimer(seconds), fillPct);
        break;
      }
      case 'distance': {
        const target = goal!.target;
        fillPct = target > 0 ? Math.min(1, distanceMeters / target) : 0;
        fillKind = 'gradient';
        heroLabel = t.workout.active.remainingDistance;
        heroText = formatInt(Math.max(0, target - distanceMeters));
        subLabel = t.workout.active.covered;
        subtitle = progressRow(`${formatInt(distanceMeters)} m`, fillPct);
        break;
      }
      case 'split': {
        heroLabel = t.workout.active.currentSplit;
        subLabel = null;
        // Rond de gesmoothe split één keer af naar heel-seconde en gebruik díe waarde
        // voor weergave, fill-tint én coaching. Zo kan het getoonde getal (heel-seconde)
        // nooit tegenspreken met de kleur/tekst (die anders de ongeronde float vergeleek),
        // en toont een fractie net onder een minuut geen "1:60".
        const split = Math.round(splitDisplay);
        heroText = formatSplit(split, true);
        fillPct = 1;
        fillKind = split > 0 && split <= goal!.target ? 'success' : 'warning';
        let sub = t.workout.active.startRowing;
        if (split > 0) {
          const diff = goal!.target - split;
          const absDiff = Math.abs(diff);
          // diff 0 is exact doeltempo — "Je bent 0 seconden sneller" leest als een fout (audit F5).
          sub = diff === 0
            ? t.workout.active.splitOnTarget
            : diff > 0
              ? t.workout.active.splitFaster(absDiff)
              : t.workout.active.splitSlower(absDiff);
        }
        subtitle = <Text style={[activeStyles.subtitleText, activeStyles.subtitleSentence]}>{sub}</Text>;
        break;
      }
      case 'watts': {
        heroLabel = t.workout.active.currentPower;
        subLabel = null;
        // Idem watts: één keer afronden, dan weergave/tint/coaching op dezelfde waarde.
        const w = Math.round(wattsDisplay);
        heroText = `${w} W`;
        fillPct = 1;
        fillKind = w >= goal!.target ? 'success' : 'warning';
        let sub = t.workout.active.startRowing;
        if (w > 0) {
          const diff = w - goal!.target;
          const absDiff = Math.abs(diff);
          // diff 0 is exact op vermogen — "Je levert 0 W meer" leest als een fout (audit F5).
          sub = diff === 0
            ? t.workout.active.wattsOnTarget
            : diff > 0
              ? t.workout.active.wattsMore(absDiff)
              : t.workout.active.wattsLess(absDiff);
        }
        subtitle = <Text style={[activeStyles.subtitleText, activeStyles.subtitleSentence]}>{sub}</Text>;
        break;
      }
      default:
        // Geen doel: hero = verstreken tijd, subtitle = verstreken afstand.
        heroText = formattedTimer;
        subtitle = <Text style={activeStyles.subtitleText}>{`${formatInt(distanceMeters)} m`}</Text>;
    }
    return { heroLabel, heroText, subLabel, subtitle, fillPct, fillKind };
  }

  // --- Hero-content: eyebrow-label + hero-getal, dan eyebrow-label + subtitle.
  // Gedeeld portrait/landscape (Figma Main KPI: gap 40 tussen groepen, gap 8 binnen).
  // Split/watts hebben geen subtitle-eyebrow (subLabel = null) → enkel coaching-tekst. ---
  function renderHeroContent(gv: ReturnType<typeof computeGoalView>): ReactNode {
    return (
      <>
        <View style={activeStyles.heroGroup}>
          {gv.heroLabel != null && <Text style={activeStyles.heroLabel}>{gv.heroLabel}</Text>}
          <Text style={activeStyles.heroText}>{gv.heroText}</Text>
        </View>
        <View style={activeStyles.heroGroup}>
          {gv.subLabel != null && <Text style={activeStyles.heroLabel}>{gv.subLabel}</Text>}
          {gv.subtitle}
        </View>
      </>
    );
  }

  // --- Header-inhoud: DOEL-pill + compacte Stop-knop (gedeeld) ---
  // De accent-tint zit op de DOEL-pill zelf (subtiele fill + border, Figma 290:2873);
  // de band is bg.base. Gedeeld portrait + landscape.
  function headerChildren(): ReactNode {
    const goalParts = goalPillParts();
    return (
      <>
        <View style={activeStyles.doelPill}>
          <Text style={activeStyles.doelPillLabel}>{t.workout.active.goalPillLabel}</Text>
          <View style={activeStyles.doelPillDivider} />
          <View style={activeStyles.doelPillValueRow}>
            <Text style={activeStyles.doelPillValue}>{goalParts.value}</Text>
            {goalParts.unit != null && (
              <Text style={activeStyles.doelPillUnit}>{goalParts.unit}</Text>
            )}
          </View>
        </View>
        <Button
          title={t.workout.active.stopButton}
          variant="primary"
          size="md"
          icon="arrow-forward"
          iconPosition="trailing"
          onPress={onStop}
        />
      </>
    );
  }

  // --- Progress-fill: gradient (duration/distance) of solid success/warning (split/watts) ---
  function barFillInner(fillKind: FillKind, vertical: boolean): ReactNode {
    if (fillKind === 'gradient') {
      return (
        <LinearGradient
          colors={[buttonTokens.primary.gradientFrom, buttonTokens.primary.gradientTo]}
          start={vertical ? { x: 0, y: 1 } : { x: 0, y: 0 }}
          end={vertical ? { x: 0, y: 0 } : { x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      );
    }
    const color = fillKind === 'success' ? progressBar.successFill : progressBar.warningFill;
    return <View style={[StyleSheet.absoluteFill, { backgroundColor: color }]} />;
  }

  // --- Progress-bar horizontaal (portrait): full-bleed 4px tussen hero-paneel en KPI-lijst ---
  function renderProgressBarH(fillPct: number, fillKind: FillKind): ReactNode {
    return (
      <View style={activeStyles.barTrackH}>
        {fillKind !== 'none' && fillPct > 0 && (
          <View style={[activeStyles.barFillH, { width: `${Math.min(fillPct * 100, 100)}%` }]}>
            {barFillInner(fillKind, false)}
          </View>
        )}
      </View>
    );
  }

  // --- Progress-bar verticaal (landscape): 4px op de kolomscheiding, vult onder→boven ---
  function renderProgressBarV(fillPct: number, fillKind: FillKind): ReactNode {
    return (
      <View style={landscapeStyles.barTrackV}>
        {fillKind !== 'none' && fillPct > 0 && (
          <View style={[landscapeStyles.barFillV, { height: `${Math.min(fillPct * 100, 100)}%` }]}>
            {barFillInner(fillKind, true)}
          </View>
        )}
      </View>
    );
  }

  // --- KPI-lijst: flatte rijen met hairline-divider (gedeeld; fill=true → landscape) ---
  type KPIKey = 'SPLIT' | 'WATT' | 'SPM' | 'BPM' | 'AFSTAND' | 'TIJD' | 'KCAL';
  function renderKpiList(fill: boolean): ReactNode {
    const goalType = goal?.type ?? null;

    let kpiOrder: KPIKey[];
    switch (goalType) {
      case 'distance':
        kpiOrder = ['SPLIT', 'WATT', 'SPM', 'BPM', 'TIJD', 'KCAL'];
        break;
      case 'duration':
        kpiOrder = ['SPLIT', 'WATT', 'SPM', 'BPM', 'AFSTAND', 'KCAL'];
        break;
      case 'split':
        kpiOrder = ['WATT', 'TIJD', 'SPM', 'BPM', 'AFSTAND', 'KCAL'];
        break;
      case 'watts':
        kpiOrder = ['SPLIT', 'TIJD', 'SPM', 'BPM', 'AFSTAND', 'KCAL'];
        break;
      default:
        // Geen doel: totale afstand staat al als hero-subtitle → niet dubbel in de lijst.
        kpiOrder = ['SPLIT', 'WATT', 'SPM', 'BPM', 'KCAL'];
    }

    // Natuurlijke casing (design): labels niet uppercase; SPM/BPM blijven acroniemen.
    function kpiLabel(key: KPIKey): string {
      switch (key) {
        case 'SPLIT': return t.workout.active.kpiSplit;
        case 'WATT': return t.workout.active.kpiWatt;
        case 'SPM': return t.workout.active.kpiSpm;
        case 'BPM': return t.workout.active.kpiBpm;
        case 'AFSTAND': return t.workout.active.kpiDistance;
        case 'TIJD': return t.workout.active.kpiTime;
        case 'KCAL': return t.workout.active.kpiKcal;
      }
    }

    // Waarden zonder redundante unit (het label draagt de eenheid); Afstand houdt "m".
    function kpiValue(key: KPIKey): string {
      switch (key) {
        // Huidige (gesmoothe) waarde tijdens de rit — niet het sessie-gemiddelde.
        case 'SPLIT': return formatSplit(Math.round(splitDisplay), true);
        case 'WATT': return `${Math.round(wattsDisplay)}`;
        case 'SPM': return `${correctSpm(spmDisplay, spmHalved)}`;
        case 'BPM': return hrBpm != null && hrBpm > 0 ? `${hrBpm}` : '—';
        case 'AFSTAND': return `${formatInt(distanceMeters)} m`;
        case 'TIJD': return formattedTimer;
        case 'KCAL': return `${formatInt(calories)}${hasProfileWeight ? '' : '*'}`;
      }
    }

    return (
      <>
        {kpiOrder.map((key, i) => {
          const rowStyle = [
            activeStyles.kpiRow,
            fill ? activeStyles.kpiRowFill : activeStyles.kpiRowFixed,
            i < kpiOrder.length - 1 && activeStyles.kpiRowDivider,
          ];
          if (key === 'BPM') {
            // Alleen tikbaar zolang er géén band hangt. Tikken tijdens een verbinding
            // startte een scan die het eigen toestel niet kan vinden (iOS geeft een
            // verbonden peripheral nooit terug in scanresultaten), waarna de rij op
            // "Verbinden" bleef staan zonder weg terug.
            return (
              <TouchableOpacity
                key="BPM"
                style={rowStyle}
                onPress={startHRScan}
                disabled={hrStatus === 'connected' || hrStatus === 'scanning' || hrStatus === 'waiting'}
                activeOpacity={0.8}
              >
                <Text style={activeStyles.kpiLabel}>{t.workout.active.kpiBpm}</Text>
                {hrStatus === 'scanning' ? (
                  <ActivityIndicator size="small" color={fg.secondary} />
                ) : (
                  <Text style={activeStyles.kpiValue}>{kpiValue('BPM')}</Text>
                )}
              </TouchableOpacity>
            );
          }
          return (
            <View key={key} style={rowStyle}>
              <Text style={activeStyles.kpiLabel}>{kpiLabel(key)}</Text>
              <Text style={activeStyles.kpiValue}>{kpiValue(key)}</Text>
            </View>
          );
        })}
      </>
    );
  }

  // --- Portrait layout ---
  function renderPortrait(): ReactNode {
    const gv = computeGoalView();
    return (
      <View style={portraitStyles.root}>
        {/* Header: DOEL-pill links, compacte Stop-knop rechts */}
        <View
          style={[
            activeStyles.header,
            {
              // Band-padding 20 (Figma 297:2227); paddingTop respecteert de notch.
              paddingTop: Math.max(space['20'], insets.top),
              paddingBottom: space['20'],
              paddingHorizontal: padH,
            },
          ]}
        >
          {headerChildren()}
        </View>

        {/* Hero-paneel (bg.elevated), vult de vrije ruimte, content gecentreerd */}
        <View style={[activeStyles.heroPanel, portraitStyles.heroPanel]}>
          {renderHeroContent(gv)}
        </View>

        {/* Progress-bar: full-bleed 4px tussen paneel en KPI-lijst */}
        {renderProgressBarH(gv.fillPct, gv.fillKind)}

        {/* KPI-lijst: flatte rijen */}
        <View
          style={[
            portraitStyles.kpiGrid,
            { paddingHorizontal: padH, paddingBottom: Math.max(space['8'], insets.bottom) },
          ]}
        >
          {renderKpiList(false)}
        </View>
      </View>
    );
  }

  // Full-bleed secties: de container draagt geen horizontale padding meer. Elke
  // sectie (header, KPI-grid) regelt zelf zijn padding + safe-area, zodat het
  // hero-paneel (bg.elevated) en de progress-bar tot de schermrand lopen.
  // padH is symmetrisch (max van beide insets) zodat het 50/50-blok gecentreerd
  // blijft i.p.v. weggeduwd door de notch aan één kant.
  const padH = Math.max(layout.screenHorizontal, insets.left, insets.right);

  return (
    <View testID="ActivePhase" style={[styles.container, { paddingHorizontal: 0 }]}>
      {/* Connection status overlay */}
      {isConnecting && (
        <View style={[styles.connectionOverlay, { paddingHorizontal: padH }]}>
          {bleStatus !== 'error' ? (
            <>
              <ActivityIndicator color={accent.default} size="large" />
              <Text style={styles.connectionText}>
                {(bleStatus === 'idle' || bleStatus === 'scanning') && t.workout.connection.searching}
                {bleStatus === 'connecting' && t.workout.connection.connecting}
                {bleStatus === 'discovering' && t.workout.connection.discovering}
                {bleStatus === 'reconnecting' && t.workout.connection.reconnecting}
                {bleStatus === 'disconnecting' && t.workout.connection.disconnecting}
              </Text>
            </>
          ) : (
            <>
              <Ionicons name="warning-outline" size={40} color={fg.secondary} />
              <Text style={styles.connectionText}>{bleError}</Text>
              <Button title={t.common.retry} onPress={startScan} size="md" variant="ghost" />
            </>
          )}
          {/* Uitgang tijdens reconnect/error: de overlay verbergt de header-Stop en de
              tabbar is al verborgen — zonder deze knop zit de roeier vast (audit P0-F2). */}
          <Text style={styles.connectionElapsed}>{t.workout.connection.elapsed(formattedTimer)}</Text>
          <Button title={t.workout.connection.stopButton} onPress={onStop} size="md" />
        </View>
      )}

      {!isConnecting && isLandscape ? (
        /* ===== LANDSCAPE LAYOUT ===== */
        <View
          style={landscapeStyles.root}
          onLayout={e => {
            // Twee gelijke kolommen met een 4px verticale progress-bar ertussen.
            const next = (e.nativeEvent.layout.width - 4) / 2;
            setLandColWidth(prev => (prev != null && Math.abs(prev - next) < 0.5 ? prev : next));
          }}
        >
          {(() => {
            const gv = computeGoalView();
            return (
              <>
                {/* Links: header (pill + Stop) boven de KPI-lijst (Figma 290:2746) */}
                <View style={[landscapeStyles.metricsCol, landColStyle]}>
                  <View
                    style={[
                      activeStyles.header,
                      {
                        paddingTop: Math.max(space['20'], insets.top),
                        paddingBottom: space['20'],
                        paddingLeft: Math.max(space['20'], insets.left),
                        // Binnenrand naar de progress-bar: 40 (design 290:2746) — geeft de bar ruimte.
                        paddingRight: space['40'],
                      },
                    ]}
                  >
                    {headerChildren()}
                  </View>
                  <View
                    style={[
                      landscapeStyles.kpiList,
                      {
                        paddingLeft: Math.max(space['20'], insets.left),
                        paddingBottom: Math.max(space['8'], insets.bottom),
                      },
                    ]}
                  >
                    {renderKpiList(true)}
                  </View>
                </View>

                {/* Verticale progress-bar op de kolomscheiding */}
                {renderProgressBarV(gv.fillPct, gv.fillKind)}

                {/* Rechts: hero-paneel (bg.elevated) */}
                <View style={[activeStyles.heroPanel, landColStyle, { paddingLeft: space['40'], paddingRight: Math.max(space['20'], insets.right) }]}>
                  {renderHeroContent(gv)}
                </View>
              </>
            );
          })()}
        </View>
      ) : !isConnecting ? (
        /* ===== PORTRAIT LAYOUT ===== */
        renderPortrait()
      ) : null}

      {/* Summary Modal — volle-breedte secties (Figma 43-8278) */}
      <Modal visible={phase === 'summary'} transparent animationType="fade" statusBarTranslucent>
        <View style={summaryStyles.screen}>
          {/* Top: titel + datum + PR-banner */}
          <View style={summaryStyles.topSection}>
            <View style={[summaryStyles.titleBlock, { paddingTop: Math.max(space['28'], insets.top) }]}>
              <Text style={summaryStyles.title}>{t.workout.summary.title}</Text>
              <Text style={summaryStyles.dateText}>{summaryDateLabel}</Text>
            </View>
            {prEntries.length > 0 && (
              <View style={summaryStyles.prWrapper}>
                <View style={summaryStyles.prBanner}>
                  <View style={summaryStyles.prBannerTop}>
                    <Text style={summaryStyles.prEmoji}>🏅</Text>
                    <Text style={summaryStyles.prText}>
                      {prEntries.length === 1
                        ? t.pr.bannerTitleOne
                        : t.pr.bannerTitleMany(prEntries.length)}
                    </Text>
                  </View>
                  {/* Eén regel per record: "Vermogen · 143 W" met daaronder wat het verving.
                      Eerder stond hier één generieke zin, waardoor je wél las dát je een
                      record brak maar niet waarop. */}
                  {prEntries.map((entry) => (
                    <View
                      key={entry.metric}
                      accessible
                      accessibilityLabel={prEntrySpoken(entry)}
                      style={summaryStyles.prEntryRow}
                    >
                      <Text style={summaryStyles.prEntryMetric}>
                        {prMetricLabel(entry.metric)}
                      </Text>
                      <View style={summaryStyles.prEntryValues}>
                        <Text style={summaryStyles.prEntryValue}>
                          {formatPrValue(entry.metric, entry.value)}
                        </Text>
                        <Text style={summaryStyles.prEntryPrevious}>
                          {formatPrPrevious(entry)}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </View>

          {/* KPI-metrics — volle-breedte bg.raised band */}
          <View style={summaryStyles.kpiBand}>
            <View style={summaryStyles.kpiRow}>
              <KpiSingle
                value={formattedDistance.value}
                unit={formattedDistance.unit}
                label={t.workout.summary.kpiDistance}
                style={summaryStyles.kpiCell}
              />
              <KpiSingle
                value={formatTimerFull(seconds)}
                label={t.workout.summary.kpiDuration}
                style={summaryStyles.kpiCell}
              />
            </View>
            <View style={summaryStyles.kpiBandDivider} />
            <View style={summaryStyles.kpiRow}>
              <KpiSingle
                value={`${formatInt(calories)}${hasProfileWeight ? '' : '*'}`}
                unit="kcal"
                label={t.workout.summary.kpiEnergy}
                style={summaryStyles.kpiCell}
              />
              <KpiSingle
                value={summaryTotalStrokes != null ? formatInt(correctSpm(summaryTotalStrokes, spmHalved)) : '—'}
                label={t.workout.summary.kpiStrokes}
                style={summaryStyles.kpiCell}
              />
            </View>
          </View>

          {/* Stats-sectie */}
          <View style={summaryStyles.statsSection}>
            <View style={summaryStyles.statsHeader}>
              <View style={summaryStyles.statsLabelCol} />
              <Text style={summaryStyles.statsColLabel}>{t.detail.colAvg}</Text>
              <Text style={summaryStyles.statsColLabel}>{t.detail.colPeak}</Text>
            </View>
            <View style={summaryStyles.statsTable}>
              {[
                { label: t.workout.summary.statSplit, gem: formatSplit(avgSplit), piek: summaryBestSplit != null ? formatSplit(summaryBestSplit) : '—' },
                { label: t.workout.summary.statWatt, gem: `${avgWatts}`, piek: summaryMaxWatts != null ? `${summaryMaxWatts}` : '—' },
                { label: t.workout.summary.statSpm, gem: `${correctSpm(avgSpm, spmHalved)}`, piek: summaryMaxSpm != null ? `${correctSpm(summaryMaxSpm, spmHalved)}` : '—' },
                { label: t.workout.summary.statBpm, gem: summaryAvgHr != null ? `${summaryAvgHr}` : '—', piek: summaryMaxHr != null ? `${summaryMaxHr}` : '—' },
              ].map((row, i, arr) => (
                <View key={row.label}>
                  <View style={summaryStyles.statsRow}>
                    <Text style={summaryStyles.statsRowLabel}>{row.label}</Text>
                    <Text style={summaryStyles.statsRowValue}>{row.gem}</Text>
                    <Text style={summaryStyles.statsRowValue}>{row.piek}</Text>
                  </View>
                  {i < arr.length - 1 && <View style={summaryStyles.statsRowDivider} />}
                </View>
              ))}
            </View>
          </View>

          {/* Knoppen — onderaan */}
          <View style={[summaryStyles.buttonsArea, { paddingBottom: Math.max(space['28'], insets.bottom) }]}>
            <Button title={t.common.continue} onPress={onContinue} size="lg" icon="arrow-forward" iconPosition="trailing" />
          </View>
        </View>
      </Modal>

      {/* Goal-reached viering → "Ga verder" leidt naar de samenvatting */}
      <MotivationalToast message={toastMsg} onDismiss={onGoalContinue} />
    </View>
  );
}

const activeStyles = StyleSheet.create({
  // Header: DOEL-pill links, compacte Stop-knop rechts (top-uitgelijnd).
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: space['16'],
    // Header-band met accent-tint + sterke onderrand (Figma 297:2227). De tint zit op de
    // band zelf; de DOEL-pill is plat (geen fill/border). Gedeeld portrait + landscape.
    // TODO: token accent.muted = 0.12; Figma-band = 0.10 (verschil verwaarloosbaar, geen 0.10-token).
    backgroundColor: accent.muted,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: border.strong,
  },
  // DOEL: plat inline (label · divider · waarde) — geen fill/border meer, de tint zit op
  // de band (Figma 297:2227). Hoogte 48 (lijnt met de Stop-knop), px 0, gap 16.
  doelPill: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    gap: space['16'],
  },
  doelPillLabel: {
    fontFamily: fontFamily.albertSansSemiBold,
    fontSize: fontSize['14'],
    letterSpacing: 2.8, // 20% van 14
    color: fg.onAccent,
  },
  doelPillDivider: {
    width: 1,
    height: 16,
    borderRadius: 8,
    backgroundColor: fg.secondary,
  },
  // Waarde + eenheid beide bold, strak naast elkaar (gap 2) — "180W" (Figma 297:2227).
  doelPillValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  doelPillValue: {
    fontFamily: fontFamily.albertSansBold,
    fontSize: fontSize['18'],
    letterSpacing: -0.45, // -2.5% van 18
    color: accent.default,
  },
  doelPillUnit: {
    fontFamily: fontFamily.albertSansBold,
    fontSize: fontSize['16'],
    color: accent.default,
  },
  // Hero-paneel (bg.elevated); flex/stretch worden per oriëntatie toegevoegd.
  heroPanel: {
    backgroundColor: bg.elevated,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space['40'],
  },
  // Hero- en subtitle-groep: eyebrow-label boven zijn waarde (Figma Frame 130/132, gap 8).
  heroGroup: {
    alignSelf: 'stretch', // vult het hero-paneel → subtitle-rij kan gelijk-brede kolommen maken
    alignItems: 'center',
    gap: space['8'],
  },
  // Eyebrow-label boven hero-getal én subtitle: Albert Sans SemiBold 16, 20% tracking, UPPER.
  heroLabel: {
    fontFamily: fontFamily.albertSansSemiBold,
    fontSize: fontSize['16'],
    letterSpacing: 3.2, // 20% van 16
    textTransform: 'uppercase',
    color: fg.onAccent,
  },
  heroText: {
    // Hero-cijfer via de heroNumeric-typeStyle (Albert Sans Bold 114, ls -5.13).
    // Token herbestemd in Tokens Studio 2026-07-14 (was Source Serif 96).
    ...typeStyles.heroNumeric,
    color: fg.onAccent,
  },
  subtitleText: {
    fontFamily: fontFamily.albertSansLight,
    fontSize: fontSize['36'],
    letterSpacing: -0.9, // -2.5% van 36
    color: fg.primary,
  },
  // Coaching-zin (split/watt-doel) alléén. Niet op `heroPanel`: dat paneel draagt het
  // 114px hero-getal, en een symmetrische inset van 40 knijpt "120:45" tot wrappen/krimpen.
  // Ook niet op `subtitleText` zelf: die stijl draagt óók de twee kolommen van de
  // progress-rij (duration/distance), waar padding de statische divider zou wegduwen.
  subtitleSentence: {
    paddingHorizontal: space['20'],
    textAlign: 'center',
  },
  subtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    gap: space['20'],
  },
  // Linkerwaarde rechts-uitgelijnd, rechterwaarde links-uitgelijnd; elk flex:1 (gelijke
  // kolommen) zodat de divider ertussen statisch blijft bij wisselende cijfers.
  subtitleValueLeft: {
    flex: 1,
    textAlign: 'right',
  },
  subtitleValueRight: {
    flex: 1,
    textAlign: 'left',
  },
  subtitleDivider: {
    width: 2,
    height: 36,
    borderRadius: 8,
    backgroundColor: fg.tertiary,
  },
  // Progress-bar horizontaal (portrait): full-bleed 4px.
  barTrackH: {
    alignSelf: 'stretch',
    height: 4,
    backgroundColor: progressBar.trackColor,
    overflow: 'hidden',
  },
  barFillH: {
    height: 4,
  },
  // KPI flat-rijen (gedeeld portrait/landscape).
  kpiRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  kpiRowFixed: {
    height: 56,
  },
  kpiRowFill: {
    flex: 1,
    minHeight: 44,
  },
  kpiRowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: border.default,
  },
  kpiLabel: {
    fontFamily: fontFamily.albertSansLight,
    fontSize: fontSize['22'],
    letterSpacing: 1.1, // 5% van 22
    color: fg.secondary,
  },
  kpiValue: {
    fontFamily: fontFamily.albertSansMedium,
    fontSize: fontSize['28'],
    letterSpacing: -0.7, // -2.5% van 28
    color: fg.primary,
  },
});

const portraitStyles = StyleSheet.create({
  root: {
    flex: 1,
  },
  // Hero-paneel vult de vrije verticale ruimte en spant de volle breedte.
  heroPanel: {
    flex: 1,
    alignSelf: 'stretch',
  },
  kpiGrid: {
    paddingTop: space['8'],
  },
});

const landscapeStyles = StyleSheet.create({
  root: {
    flex: 1,
    flexDirection: 'row',
  },
  // Eerste-frame fallback vóór de breedte-meting (zie landColStyle in de component):
  // een definitieve, gemeten kolombreedte die geen enkele engine content-kan-sizen.
  colGrow: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
  },
  // Metrics-kolom (header + KPI-lijst) — links (Figma 290:2746).
  metricsCol: {
    minWidth: 0,
  },
  kpiList: {
    flex: 1,
    // paddingLeft (buitenrand) + paddingBottom worden inline safe-area-aware gezet: de
    // Dynamic Island/notch zit in landscape aan de zijkant, de home-indicator onderaan.
    // paddingRight grenst aan de progress-bar (midden) → 40 (design 290:2746), geeft de bar ruimte.
    paddingRight: space['40'],
  },
  // Verticale progress-bar op de kolomscheiding; fill onderaan verankerd (onder→boven).
  barTrackV: {
    width: 4,
    alignSelf: 'stretch',
    backgroundColor: progressBar.trackColor,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  barFillV: {
    width: 4,
  },
});

const summaryStyles = StyleSheet.create({
  // Volle-breedte scherm; secties dragen hun eigen padding (Figma 43-8278).
  screen: {
    flex: 1,
    backgroundColor: bg.base,
  },
  // Top: titel + datum + PR-banner (Frame 108)
  topSection: {
    paddingBottom: space['28'],
    gap: space['20'],
  },
  titleBlock: {
    paddingHorizontal: space['20'],
    // paddingTop wordt inline gezet (safe-area top)
  },
  title: {
    ...typeStyles.sectionValue,
    color: fg.primary,
  },
  dateText: {
    ...typeStyles.labelGoalPrefix,
    color: fg.secondary,
    textTransform: 'uppercase',
  },
  prWrapper: {
    paddingHorizontal: space['20'],
  },
  prBanner: {
    // Was een rauwe rgba-amber — een hardcoded waarde zonder token. Nu de raised-rol met
    // een achievement-rand: dezelfde betekenis, dezelfde markering als het PR-blok op het
    // detailscherm, en geen nieuwe kleur nodig.
    backgroundColor: bg.raised,
    // Een volledige rand en niet alleen links: `bg.raised` is ook het vlak van de KPI-band
    // eronder, dus zonder eigen omtrek leest het vieringsmoment als een gewone sectie.
    // TODO: geen borderWidth-token in constants/; een `achievement.surface`-rol zou hier
    // beter passen dan een rand — bespreken vóór er een derde plek bij komt.
    borderWidth: 2,
    borderColor: achievement.muted,
    borderRadius: componentRadius.highlightRow,
    padding: space['20'],
    gap: space['12'],
  },
  prBannerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space['8'],
  },
  prEmoji: {
    fontSize: fontSize['14'],
  },
  prText: {
    ...typeStyles.kpiUnit,
    color: achievement.default,
  },
  prEntryRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: space['12'],
  },
  prEntryMetric: {
    ...typeStyles.labelMicro,
    color: fg.secondary,
    paddingTop: space['4'],
    flexShrink: 1,
  },
  prEntryValues: {
    alignItems: 'flex-end',
    gap: space['2'],
    // Zie het PR-blok op het detailscherm: zonder shrink loopt de vorige-waarde-regel
    // buiten de banner, en wrappen kan hij niet.
    flexShrink: 1,
  },
  prEntryValue: {
    ...typeStyles.kpiValue,
    color: achievement.default,
  },
  prEntryPrevious: {
    // Volzin, dus body.xs — labelMicro kapitaliseerde de eenheden ('12,5 KM').
    ...body.xs,
    color: fg.tertiary,
    textAlign: 'right',
  },
  // KPI-metrics — volle-breedte bg.raised band (KPI Row-frame)
  kpiBand: {
    backgroundColor: bg.raised,
    paddingHorizontal: space['20'],
  },
  kpiRow: {
    flexDirection: 'row',
    paddingVertical: space['20'],
    gap: space['20'],
  },
  kpiCell: {
    flex: 1,
  },
  kpiBandDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: border.strong,
  },
  // Stats-sectie (Frame 42 + 49)
  statsSection: {
    paddingHorizontal: space['20'],
    paddingVertical: space['28'],
    gap: space['8'],
  },
  statsHeader: {
    flexDirection: 'row',
    paddingHorizontal: space['16'],
  },
  statsLabelCol: {
    width: 165,
  },
  statsColLabel: {
    flex: 1,
    ...typeStyles.labelGoalPrefix,
    color: fg.tertiary,
  },
  statsTable: {
    backgroundColor: bg.raised,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: border.default,
    overflow: 'hidden',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space['16'],
    paddingVertical: space['16'],
  },
  statsRowLabel: {
    width: 165,
    ...typeStyles.labelGoalPrefix,
    color: fg.secondary,
  },
  statsRowValue: {
    flex: 1,
    ...typeStyles.kpiValue,
    color: fg.primary,
  },
  statsRowDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: border.default,
  },
  // Knoppen — onderaan (Frame 41)
  buttonsArea: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: space['20'],
    paddingTop: space['28'],
    gap: space['8'],
    // paddingBottom wordt inline gezet (safe-area bottom)
  },
});
