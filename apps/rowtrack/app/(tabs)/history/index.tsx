import { useCallback, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { reportError } from '@/lib/monitoring';
import { BottomFade, EmptyState, ErrorState, KpiSingle, Segmented, WorkoutCard } from '@/components';
import { formatTimerFull, formatDistanceDynamic, formatInt } from '@/lib/formatters';
import { periodStart, type Period } from '@/lib/period';
import { t } from '@/i18n';
import {
  bg,
  fg,
  accent,
  border,
  space,
  typeStyles,
} from '@/constants';
import type { WorkoutSummary } from '@/types/workout';
import { usePrHistory } from '@/lib/hooks/usePrHistory';
import { selectWithPrMetrics } from '@/lib/prColumn';

type HistoryFilter = Period;

/** Waarde in de KPI-band zolang de totalen niet die van het gekozen filter zijn. */
const NO_VALUE = '—';

const FILTERS: { value: HistoryFilter; label: string }[] = [
  { value: 'week',  label: t.history.filterWeek  },
  { value: 'month', label: t.history.filterMonth },
  { value: 'year',  label: t.history.filterYear  },
  { value: 'all',   label: t.history.filterAll   },
];

export default function HistoryScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Op de id afhangen, niet op het user-object: de auth-context levert bij elk
  // auth-event een nieuwe referentie, wat anders een extra fetch de race in stuurt.
  const userId = user?.id;
  // Zegt per rij welke records hij brak — uit `pr_metrics`, of afgeleid voor oudere ritten.
  const { entriesFor, refresh: refreshPrHistory } = usePrHistory(userId);

  const [filter, setFilter] = useState<HistoryFilter>('week');
  const [workouts, setWorkouts] = useState<WorkoutSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  // Volgnummer per verzoek. Zonder dit wint bij snel wisselen van filter het
  // laatst binnenkomende antwoord i.p.v. het laatst gekozen filter, en blijft de
  // lijst op een andere periode hangen dan de actieve pill toont.
  const requestSeq = useRef(0);

  const fetchWorkouts = useCallback(async ({ silent = false } = {}) => {
    if (!userId) {
      setLoading(false);
      return;
    }
    const seq = ++requestSeq.current;
    if (!silent) setLoading(true);

    // user_id expliciet meegeven, net als elke andere workouts-query in de app;
    // RLS dekt dit al af, maar de intentie hoort in de query te staan.
    // `pr_metrics` gaat via selectWithPrMetrics: zolang die kolom niet gemigreerd is, zou
    // hij deze hele lijst op een ErrorState zetten in plaats van op één badge minder.
    const { data, error: queryError } = await selectWithPrMetrics<WorkoutSummary[]>((prColumn) => {
      // Als `string` getypeerd en niet als template-literal: de select-parser van
      // postgrest-js leest de kolomlijst op typeniveau en struikelt over een dynamische
      // staart. De rij-vorm wordt hieronder toch al met een cast vastgelegd.
      const columns: string = `id, started_at, duration_seconds, distance_meters, avg_watts, avg_spm, avg_split_seconds, calories, is_pr${prColumn}`;
      let query = supabase
        .from('workouts')
        .select(columns)
        .eq('user_id', userId)
        .order('started_at', { ascending: false });

      const from = periodStart(filter);
      if (from) query = query.gte('started_at', from.toISOString());
      return query;
    });

    // Alleen het nieuwste verzoek mag schrijven — een traag antwoord van een vorig
    // filter (of van een scherm dat intussen verlaten is) wordt genegeerd.
    if (seq !== requestSeq.current) return;

    // Leesfout onderscheiden van "geen data": een netwerk-/backendfout mag niet
    // als lege lijst renderen (security-audit P2-2). De rijen van de vorige
    // periode moeten wél weg, anders verbergt de lijst de ErrorState — die rendert
    // enkel via ListEmptyComponent — en presenteert hij oude data als vers.
    if (queryError) {
      reportError(queryError, { where: 'history.fetchWorkouts', filter });
      setError(true);
      setWorkouts([]);
    } else {
      setError(false);
      setWorkouts((data ?? []) as WorkoutSummary[]);
    }
    setLoading(false);
  }, [userId, filter]);

  // Refetch bij focus (ook bij terugkeer uit de detail na een delete), zodat een
  // verwijderde workout niet stale in de lijst blijft staan. De cleanup maakt het
  // lopende antwoord ongeldig bij blur, unmount of filterwissel.
  useFocusEffect(
    useCallback(() => {
      fetchWorkouts();
      // De afgeleide records mee bijwerken: zonder dit draagt een net gereden PR-rit
      // wél zijn badge (uit pr_metrics) maar blijven oudere rijen op de vorige stand.
      void refreshPrHistory();
      return () => {
        requestSeq.current += 1;
      };
    }, [fetchWorkouts, refreshPrHistory]),
  );

  const handleFilterChange = useCallback((next: HistoryFilter) => {
    if (next === filter) return;
    setFilter(next);
    // De rijen van de vorige periode meteen loslaten: blijven ze staan, dan toont
    // de lijst tijdens het laden nog de oude periode én onderdrukt hij de spinner
    // (die hangt aan ListEmptyComponent) — precies het beeld van "filter doet niets".
    setWorkouts([]);
    setError(false);
    setLoading(true);
  }, [filter]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    // silent: de RefreshControl draait al; `loading` erbij zetten zou de lijst-body
    // op een tweede spinner zetten en de empty/error-state laten wegflikkeren.
    await fetchWorkouts({ silent: true });
    setRefreshing(false);
  }, [fetchWorkouts]);

  const handleWorkoutPress = useCallback((id: string) => {
    router.push(`/(tabs)/history/${id}`);
  }, [router]);

  const totals = useMemo(() => {
    let durSec = 0;
    let distM = 0;
    let calories = 0;
    for (const w of workouts) {
      durSec += w.duration_seconds;
      distM += w.distance_meters;
      calories += w.calories ?? 0;
    }
    return { count: workouts.length, durSec, distM, calories };
  }, [workouts]);

  // De totalen worden client-side over de opgehaalde rijen gesommeerd. Zolang een
  // fetch loopt of gefaald is, hóórt er geen cijfer te staan: dat zou de vorige
  // periode zijn (filterwissel) of een nul die als echt totaal leest.
  const totalsReady = !loading && !error;
  const totalDistFormatted = formatDistanceDynamic(totals.distM);

  // Header: titel + segment-filter + KPI-band. Als ListHeaderComponent van de
  // FlatList, zodat de lijst gevirtualiseerd rendert (P2-5) i.p.v. alle rijen
  // tegelijk in een ScrollView.
  const listHeader = (
    <>
      <Text style={styles.title} accessibilityRole="header">{t.history.title}</Text>

      {/* Segment filter */}
      <Segmented
        variant="band"
        style={styles.segmentContainer}
        options={FILTERS}
        value={filter}
        onChange={handleFilterChange}
      />

      {/* KPI container — full width, bg.raised, border top+bottom */}
      <View style={styles.kpiContainer}>
        <View style={[styles.kpiGridRow, styles.kpiGridRowBordered]}>
          <KpiSingle
            value={totalsReady ? formatTimerFull(totals.durSec) : NO_VALUE}
            label={t.kpi.totalDuration}
            style={styles.kpiCell}
          />
          <KpiSingle
            value={totalsReady ? totalDistFormatted.value : NO_VALUE}
            unit={totalsReady ? totalDistFormatted.unit : ''}
            label={t.kpi.totalDistance}
            style={styles.kpiCell}
          />
        </View>
        <View style={styles.kpiGridRow}>
          <KpiSingle
            value={totalsReady ? formatInt(totals.calories) : NO_VALUE}
            unit={totalsReady ? 'kcal' : ''}
            label={t.kpi.totalEnergy}
            style={styles.kpiCell}
          />
          <KpiSingle
            value={totalsReady ? `${totals.count}` : NO_VALUE}
            unit=""
            label={t.kpi.totalWorkouts}
            style={styles.kpiCell}
          />
        </View>
      </View>
    </>
  );

  const listEmpty = loading ? (
    <ActivityIndicator color={accent.default} style={styles.loader} />
  ) : error ? (
    <ErrorState onRetry={fetchWorkouts} />
  ) : (
    <EmptyState icon="time-outline" title={t.history.emptyTitle} />
  );

  return (
    <View testID="HistoryScreen" style={styles.screen}>
      <FlatList
        style={[styles.container, { paddingTop: insets.top }]}
        contentContainerStyle={styles.content}
        data={workouts}
        keyExtractor={(w) => w.id}
        renderItem={({ item, index }) => (
          <WorkoutCard
            workout={item}
            onPress={handleWorkoutPress}
            index={index}
            prEntries={entriesFor(item)}
          />
        )}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={listEmpty}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={accent.default}
          />
        }
      />
      <BottomFade />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: bg.base,
  },
  container: {
    flex: 1,
    backgroundColor: bg.base,
  },
  // Sectie-afstanden via marginBottom/marginTop per blok (segments 28 onder de titel,
  // KPI-band flush eronder) i.p.v. een uniforme gap — spiegelt de detail-flow.
  content: {
    paddingTop: space['20'],
    paddingBottom: space['40'],
  },
  title: {
    ...typeStyles.sectionValue,
    color: fg.primary,
    paddingHorizontal: space['20'],
    paddingTop: space['8'],
  },

  // Segment filter — positionering; de band-visual (bg.elevated, top/bottom-divider,
  // full-bleed) zit in Segmented variant="band". 28 boven, flush tegen de KPI-band eronder.
  segmentContainer: {
    marginTop: space['28'],
  },

  // KPI container — full-width bg.raised stripe, flush onder de segments. Bottom-only
  // border (Figma KPI Row sides [0,1,0,0]); de segments-onderrand vormt de bovenlijn.
  kpiContainer: {
    backgroundColor: bg.raised,
    borderBottomWidth: 1,
    borderColor: border.default,
    paddingHorizontal: space['20'],
    marginBottom: space['16'],
  },
  kpiGridRow: {
    flexDirection: 'row',
    paddingVertical: space['16'],
    gap: space['20'],
  },
  kpiGridRowBordered: {
    borderBottomWidth: 1,
    borderBottomColor: border.strong,
  },
  kpiCell: {
    flex: 1,
  },

  loader: {
    paddingVertical: space['40'],
  },
});
