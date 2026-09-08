import { useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import type { EdgeInsets } from 'react-native-safe-area-context';
import type { ConnectionStatus, FoundDevice, HRStatus } from '@/lib/ble/types';
import { DeviceSelectionModal, type DeviceSelectionKind } from './DeviceSelectionModal';
import type { GoalType } from '@/lib/workout-goals';
import { buildGoalSuggestions } from '@/lib/workout-goals';
import {
  BleStatusBar,
  Button,
  HrStatusBar,
  GoalSegments,
  Chip,
  WheelPicker,
} from '@/components';
import type { GoalSegmentType } from '@/components';
import {
  buildDurItems,
  buildDistItems,
  buildSplitItems,
  buildWattItems,
  wheelItemParts,
} from '@/lib/formatters';
import {
  bg,
  fg,
  border,
  status,
  typeStyles,
  fontFamily,
  fontSize,
  radii,
  layout,
  space,
} from '@/constants';
import { useAuth } from '@/lib/auth-context';
import { useRecentGoals } from '@/lib/hooks/useRecentGoals';
import { t } from '@/i18n';

// --- Default picker indices (spec: 30 min, 5 km, 2:00, 180 W) ---

const DEFAULT_DUR_IDX   = 5;   // 30 min (step 5 min)
const DEFAULT_DIST_IDX  = 9;   // 5 km
const DEFAULT_SPLIT_IDX = 6;   // 2:00 /500m (step 5 s)
const DEFAULT_WATT_IDX  = 26;  // 180 W

// --- Props ---

type IdlePhaseProps = {
  bleStatus: ConnectionStatus;
  deviceName: string | null;
  onConnect: () => void;
  onDisconnect: () => void;
  hrStatus: HRStatus;
  hrDeviceName: string | null;
  hrError: string | null;
  onHRConnect: () => void;
  onHRDisconnect: () => void;
  devices: FoundDevice[];
  picking: DeviceSelectionKind | null;
  onSelectDevice: (deviceId: string) => void;
  onCancelSelection: () => void;
  idleGoalType: GoalType | null;
  setIdleGoalType: (type: GoalType | null) => void;
  idleGoalInput: string;
  setIdleGoalInput: (v: string) => void;
  idleDurMin: string;
  setIdleDurMin: (v: string) => void;
  idleDurSec: string;
  setIdleDurSec: (v: string) => void;
  onStart: () => void;
  insets: EdgeInsets;
}


// --- Component ---

export function IdlePhase({
  bleStatus,
  deviceName,
  onConnect,
  onDisconnect,
  hrStatus,
  hrDeviceName,
  hrError,
  onHRConnect,
  onHRDisconnect,
  devices,
  picking,
  onSelectDevice,
  onCancelSelection,
  idleGoalType,
  setIdleGoalType,
  setIdleGoalInput,
  setIdleDurMin,
  setIdleDurSec,
  onStart,
  insets,
}: IdlePhaseProps) {
  const { user } = useAuth();
  const recents = useRecentGoals(user?.id, idleGoalType);
  // Laatste toesteltype dat koos — de sheet blijft tijdens zijn sluit-animatie in
  // beeld terwijl `picking` al null is.
  const lastPicking = useRef<DeviceSelectionKind>('rower');
  if (picking) lastPicking.current = picking;
  const { width: screenWidth } = useWindowDimensions();

  const selectedSegment: GoalSegmentType = idleGoalType ?? 'none';

  const durItems   = useMemo(() => buildDurItems(), []);
  const distItems  = useMemo(() => buildDistItems(), []);
  const splitItems = useMemo(() => buildSplitItems(), []);
  const wattItems  = useMemo(() => buildWattItems(), []);

  const [durIdx,   setDurIdx]   = useState(DEFAULT_DUR_IDX);
  const [distIdx,  setDistIdx]  = useState(DEFAULT_DIST_IDX);
  const [splitIdx, setSplitIdx] = useState(DEFAULT_SPLIT_IDX);
  const [wattIdx,  setWattIdx]  = useState(DEFAULT_WATT_IDX);

  // A suggestion chip only reads as "active" once the user has actually chosen a
  // value. At the default (untouched) nothing highlights, so landing on any
  // segment looks the same whether or not its default happens to match a chip.
  const [goalTouched, setGoalTouched] = useState(false);

  // --- Sync helpers (wheel index → parent goal props) ---

  function syncDur(idx: number) {
    const totalSec = durItems[idx].value;
    setIdleDurMin(String(Math.floor(totalSec / 60)));
    setIdleDurSec(String(totalSec % 60));
  }

  function syncDist(idx: number) {
    setIdleGoalInput(String(distItems[idx].value));
  }

  function syncSplit(idx: number) {
    setIdleGoalInput(String(splitItems[idx].value));
  }

  function syncWatt(idx: number) {
    setIdleGoalInput(String(wattItems[idx].value));
  }

  // --- Mode config (unifies the 4 goal modes) ---

  function getModeConfig(goalType: GoalType) {
    switch (goalType) {
      case 'duration':
        return { items: durItems, idx: durIdx, setIdx: setDurIdx, sync: syncDur };
      case 'distance':
        return { items: distItems, idx: distIdx, setIdx: setDistIdx, sync: syncDist };
      case 'split':
        return { items: splitItems, idx: splitIdx, setIdx: setSplitIdx, sync: syncSplit };
      case 'watts':
        return { items: wattItems, idx: wattIdx, setIdx: setWattIdx, sync: syncWatt };
    }
  }

  // --- Segment change ---

  function handleSegmentChange(segment: GoalSegmentType) {
    const goalType: GoalType | null = segment === 'none' ? null : segment;
    setIdleGoalType(goalType);
    setGoalTouched(false);
    setDurIdx(DEFAULT_DUR_IDX);
    setDistIdx(DEFAULT_DIST_IDX);
    setSplitIdx(DEFAULT_SPLIT_IDX);
    setWattIdx(DEFAULT_WATT_IDX);
    if (goalType === 'duration') {
      syncDur(DEFAULT_DUR_IDX);
      setIdleGoalInput('');
    } else if (goalType === 'distance') {
      syncDist(DEFAULT_DIST_IDX);
      setIdleDurMin('');
      setIdleDurSec('');
    } else if (goalType === 'split') {
      syncSplit(DEFAULT_SPLIT_IDX);
      setIdleDurMin('');
      setIdleDurSec('');
    } else if (goalType === 'watts') {
      syncWatt(DEFAULT_WATT_IDX);
      setIdleDurMin('');
      setIdleDurSec('');
    } else {
      setIdleGoalInput('');
      setIdleDurMin('');
      setIdleDurSec('');
    }
  }

  // --- Goal input rendering ---

  function renderGoalInput() {
    if (selectedSegment === 'none') {
      return (
        <Text style={styles.geenText}>
          {t.workout.idle.freeTraining}
        </Text>
      );
    }

    const goalType = idleGoalType!;
    const { items, idx, setIdx, sync } = getModeConfig(goalType);
    const suggestions = buildGoalSuggestions(goalType, recents);

    return (
      <View style={styles.pickerArea}>
        {/* Suggestions — always 3 chips (recent picks padded with defaults) */}
        <View style={styles.chipRow}>
          {suggestions.map((chipIdx) => {
            const { value, unit } = wheelItemParts(items[chipIdx]);
            return (
              <Chip
                key={chipIdx}
                value={value}
                unit={unit}
                active={goalTouched && chipIdx === idx}
                onPress={() => {
                  setGoalTouched(true);
                  setIdx(chipIdx);
                  sync(chipIdx);
                }}
              />
            );
          })}
        </View>

        {/* Wheel picker — centred in the space below the chips so the selected
            value (pill) reads as the vertical anchor between chips and CTA. */}
        <View style={styles.wheelWrap}>
          <WheelPicker
            items={items}
            selectedIndex={idx}
            onIndexChange={(newIdx) => {
              setGoalTouched(true);
              setIdx(newIdx);
              sync(newIdx);
            }}
          />
        </View>
      </View>
    );
  }

  return (
    <View testID="IdlePhase" style={styles.screen}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 20 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Fixed top group: header, devices, goal segments */}
        <View style={styles.topGroup}>
          <View>
            <Text style={styles.header}>{t.workout.idle.title}</Text>
          </View>

          {/* Toestellen */}
          <View style={styles.toestelSection}>
            <Text style={styles.sectionLabel}>{t.workout.idle.devicesLabel}</Text>
            <View style={styles.deviceCard}>
              <BleStatusBar
                bleStatus={bleStatus}
                deviceName={deviceName}
                onConnect={onConnect}
                onDisconnect={onDisconnect}
              />
              <View style={styles.deviceDivider} />
              <HrStatusBar
                hrStatus={hrStatus}
                hrDeviceName={hrDeviceName}
                onConnect={onHRConnect}
                onDisconnect={onHRDisconnect}
              />
            </View>
            {/* Een mislukte hartslag-scan liet de rij gewoon terugvallen op "Verbinden",
                zonder één woord uitleg — niet te onderscheiden van een dode knop. */}
            {hrError ? <Text style={styles.deviceError}>{hrError}</Text> : null}
          </View>

          {/* Doel header + segments */}
          <View style={styles.doelHeader}>
            <Text style={styles.sectionLabel}>{t.workout.idle.goalLabel}</Text>
            {/* Full-bleed: definite screen width so the segments distribute evenly */}
            <View style={{ width: screenWidth, marginLeft: -layout.screenHorizontal }}>
              <GoalSegments selected={selectedSegment} onChange={handleSegmentChange} />
            </View>
          </View>
        </View>

        {/* Picker — vertically centred in the remaining space, responsive to
            height. "Geen" is a static line, so it hugs the top instead. */}
        <View style={[styles.pickerCenter, selectedSegment === 'none' && styles.pickerTop]}>
          {renderGoalInput()}
        </View>
      </ScrollView>

      {/* Fixed CTA */}
      <View style={styles.ctaArea}>
        <Button
          title={t.workout.idle.startButton}
          variant="primary"
          icon="arrow-forward"
          iconPosition="trailing"
          onPress={onStart}
        />
      </View>

      <DeviceSelectionModal
        visible={picking !== null}
        // Tijdens het wegschuiven is `picking` al null terwijl de sheet nog in beeld
        // is; zonder het laatste type te onthouden flitst de titel dan naar die van
        // het andere toestel.
        kind={picking ?? lastPicking.current}
        devices={devices}
        onSelect={onSelectDevice}
        onCancel={onCancelSelection}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: bg.base,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    gap: 20, // segments ↔ picker breathing room
    // No paddingBottom: the fixed CTA area below already provides the gap, and
    // reclaiming it lets the wheel centre instead of overflowing under the CTA.
  },
  // Natural-height top block; the picker below it fills the rest and centres.
  topGroup: {
    gap: 28,
  },
  // Picker sits in the space between the segments and the CTA, vertically
  // centred and elastic so it adapts to any screen height.
  pickerCenter: {
    flex: 1,
    justifyContent: 'center',
  },
  pickerTop: {
    justifyContent: 'flex-start',
  },

  header: {
    ...typeStyles.sectionValue,
    color: fg.primary,
  },

  toestelSection: {
    gap: 8,
  },
  // Grouped device card: one rounded container holding both rows, split by a
  // hairline divider. The rows themselves are transparent (DeviceRow).
  deviceCard: {
    backgroundColor: bg.elevated,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: border.default,
    overflow: 'hidden',
  },
  deviceDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: border.default,
  },
  sectionLabel: {
    ...typeStyles.labelGoalPrefix,
    color: fg.tertiary,
  },

  deviceError: {
    fontFamily: fontFamily.albertSansRegular,
    fontSize: fontSize['13'],
    color: status.error,
    marginTop: space['8'],
  },

  doelHeader: {
    gap: 8,
  },

  // Geen placeholder
  geenText: {
    ...typeStyles.kpiValue,
    color: fg.primary,
  },

  // Goal input area — chips pinned at the top, wheel centred in the space
  // below them. No fixed gap here: the wheel's flex centring supplies the
  // breathing room, so the 250pt wheel can float centred instead of being
  // pushed down against the CTA.
  pickerArea: {
    flex: 1,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
  },
  wheelWrap: {
    flex: 1,
    justifyContent: 'center',
  },

  // CTA
  ctaArea: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 20,
  },
});
