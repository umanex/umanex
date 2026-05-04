import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  LayoutAnimation,
  Modal,
  FlatList,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { EdgeInsets } from 'react-native-safe-area-context';
import type { ConnectionStatus, HRFoundDevice, HRStatus } from '@/lib/ble/types';
import type { GoalType } from '@/lib/workout-goals';
import {
  Button,
  BleStatusBar,
  HrStatusBar,
  GoalSegments,
  GoalInput,
  Chip,
} from '@/components';
import type { GoalSegmentType } from '@/components';
import {
  background,
  brand,
  status as statusColors,
  text as textColors,
  space,
  layout,
  fontFamily,
  fontSize,
  radii,
} from '@/constants';

// --- Goal type mapping ---

const SEGMENT_TO_GOAL: Record<GoalSegmentType, GoalType | null> = {
  'Geen': null,
  'Duur': 'duration',
  'Afstand': 'distance',
  'Split': 'split',
  'Watt': 'watts',
};

const GOAL_TO_SEGMENT: Record<string, GoalSegmentType> = {
  'duration': 'Duur',
  'distance': 'Afstand',
  'split': 'Split',
  'watts': 'Watt',
};

// --- Props ---

interface IdlePhaseProps {
  bleStatus: ConnectionStatus;
  deviceName: string | null;
  bleError: string | null;
  onConnect: () => void;
  onDisconnect: () => void;
  hrStatus: HRStatus;
  hrDeviceName: string | null;
  onHRConnect: () => void;
  onHRDisconnect: () => void;
  hrDevices: HRFoundDevice[];
  hrSelecting: boolean;
  onSelectHRDevice: (deviceId: string) => void;
  onCancelHRSelection: () => void;
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

// --- Signal strength ---

function rssiLabel(rssi: number): { text: string; color: string } {
  if (rssi > -60) return { text: 'Sterk', color: statusColors.success };
  if (rssi >= -80) return { text: 'Goed', color: brand.primary };
  return { text: 'Zwak', color: statusColors.error };
}

// --- HR Selection Modal ---

function HRSelectionModal({
  visible,
  devices,
  onSelect,
  onCancel,
}: {
  visible: boolean;
  devices: HRFoundDevice[];
  onSelect: (deviceId: string) => void;
  onCancel: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={modalStyles.backdrop}>
        <View style={modalStyles.sheet}>
          <Text style={modalStyles.title}>Kies hartslagmeter</Text>
          <FlatList
            data={devices}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => {
              const signal = rssiLabel(item.rssi);
              return (
                <TouchableOpacity onPress={() => onSelect(item.id)} style={modalStyles.deviceRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <Ionicons name="heart" size={18} color={brand.primary} />
                    <Text style={modalStyles.deviceName}>{item.name}</Text>
                  </View>
                  <Text style={[modalStyles.deviceSignal, { color: signal.color }]}>{signal.text}</Text>
                </TouchableOpacity>
              );
            }}
          />
          <TouchableOpacity onPress={onCancel} style={modalStyles.cancelBtn}>
            <Text style={modalStyles.cancelText}>Annuleer</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const modalStyles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { backgroundColor: background.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 24, paddingBottom: 40, paddingHorizontal: 20 },
  title: { color: textColors.primary, fontSize: 18, fontFamily: fontFamily.displayBold, marginBottom: 16, textAlign: 'center' },
  deviceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: background.elevated, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 8 },
  deviceName: { color: textColors.primary, fontSize: 15, fontFamily: fontFamily.bodyMedium },
  deviceSignal: { fontSize: 13, fontFamily: fontFamily.bodyMedium },
  cancelBtn: { marginTop: 8, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  cancelText: { color: textColors.muted, fontSize: 15, fontFamily: fontFamily.bodySemiBold },
});

// --- Distance chips ---

const DISTANCE_CHIPS = [
  { label: '500 m', km: '0', m: '500' },
  { label: '1 km', km: '1', m: '0' },
  { label: '2 km', km: '2', m: '0' },
  { label: '5 km', km: '5', m: '0' },
  { label: '10 km', km: '10', m: '0' },
];

const WATT_CHIPS = ['100 W', '150 W', '200 W', '250 W', '300 W'];

// --- Component ---

export function IdlePhase({
  bleStatus,
  deviceName,
  bleError,
  onConnect,
  onDisconnect,
  hrStatus,
  hrDeviceName,
  onHRConnect,
  onHRDisconnect,
  hrDevices,
  hrSelecting,
  onSelectHRDevice,
  onCancelHRSelection,
  idleGoalType,
  setIdleGoalType,
  idleGoalInput,
  setIdleGoalInput,
  idleDurMin,
  setIdleDurMin,
  idleDurSec,
  setIdleDurSec,
  onStart,
  insets,
}: IdlePhaseProps) {
  // Map between GoalSegmentType and GoalType
  const selectedSegment: GoalSegmentType = idleGoalType
    ? GOAL_TO_SEGMENT[idleGoalType] ?? 'Geen'
    : 'Geen';

  // Local state for new input fields
  const [distKm, setDistKm] = useState('0');
  const [distM, setDistM] = useState('0');
  const [splitMin, setSplitMin] = useState('2');
  const [splitSec, setSplitSec] = useState('00');
  const [activeDistChip, setActiveDistChip] = useState<string | null>(null);
  const [activeWattChip, setActiveWattChip] = useState<string | null>(null);

  // Sync local state → parent state
  useEffect(() => {
    if (idleGoalType === 'distance') {
      const totalMeters = parseInt(distKm || '0', 10) * 1000 + parseInt(distM || '0', 10);
      setIdleGoalInput(String(totalMeters));
    }
  }, [distKm, distM, idleGoalType]);

  useEffect(() => {
    if (idleGoalType === 'split') {
      const totalSec = parseInt(splitMin || '0', 10) * 60 + parseInt(splitSec || '0', 10);
      setIdleGoalInput(String(totalSec));
    }
  }, [splitMin, splitSec, idleGoalType]);

  function handleSegmentChange(segment: GoalSegmentType) {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const goalType = SEGMENT_TO_GOAL[segment];
    setIdleGoalType(goalType);
    setIdleGoalInput('');
    setIdleDurMin('');
    setIdleDurSec('');
    setDistKm('0');
    setDistM('0');
    setSplitMin('2');
    setSplitSec('00');
    setActiveDistChip(null);
    setActiveWattChip(null);
  }

  function renderGoalInput() {
    switch (selectedSegment) {
      case 'Geen':
        return null;

      case 'Duur':
        return (
          <View style={styles.inputRow}>
            <GoalInput value={idleDurMin} onChangeText={setIdleDurMin} unit="minuten" placeholder="30" />
            <GoalInput value={idleDurSec} onChangeText={setIdleDurSec} unit="seconden" placeholder="00" />
          </View>
        );

      case 'Afstand':
        return (
          <View style={styles.inputArea}>
            <View style={styles.inputRow}>
              <GoalInput value={distKm} onChangeText={setDistKm} unit="kilometer" placeholder="0" />
              <GoalInput value={distM} onChangeText={setDistM} unit="meter" placeholder="0" />
            </View>
            <View style={styles.chipRow}>
              {DISTANCE_CHIPS.map((chip) => (
                <Chip
                  key={chip.label}
                  label={chip.label}
                  active={activeDistChip === chip.label}
                  onPress={() => {
                    setActiveDistChip(chip.label);
                    setDistKm(chip.km);
                    setDistM(chip.m);
                  }}
                />
              ))}
            </View>
          </View>
        );

      case 'Split':
        return (
          <View style={styles.inputRow}>
            <GoalInput value={splitMin} onChangeText={setSplitMin} unit="minuten" placeholder="2" />
            <GoalInput value={splitSec} onChangeText={setSplitSec} unit="seconden" placeholder="00" />
          </View>
        );

      case 'Watt':
        return (
          <View style={styles.inputArea}>
            <View style={styles.inputRow}>
              <GoalInput value={idleGoalInput} onChangeText={setIdleGoalInput} unit="watt" placeholder="150" />
            </View>
            <View style={styles.chipRow}>
              {WATT_CHIPS.map((chip) => (
                <Chip
                  key={chip}
                  label={chip}
                  active={activeWattChip === chip}
                  onPress={() => {
                    setActiveWattChip(chip);
                    setIdleGoalInput(chip.replace(' W', ''));
                  }}
                />
              ))}
            </View>
          </View>
        );
    }
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.content}>
        {/* Header */}
        <Text style={styles.header}>Training</Text>

        {/* Toestellen */}
        <Text style={styles.sectionLabel}>TOESTELLEN</Text>
        <BleStatusBar
          bleStatus={bleStatus}
          deviceName={deviceName}
          bleError={bleError}
          onConnect={onConnect}
          onDisconnect={onDisconnect}
        />
        <View style={{ height: 8 }} />
        <HrStatusBar
          hrStatus={hrStatus}
          hrDeviceName={hrDeviceName}
          onConnect={onHRConnect}
          onDisconnect={onHRDisconnect}
        />

        {/* Divider */}
        <View style={styles.divider} />

        {/* Doel */}
        <Text style={styles.sectionLabel}>DOEL</Text>
        <GoalSegments selected={selectedSegment} onChange={handleSegmentChange} />

        {/* Goal input */}
        {renderGoalInput()}
      </View>

      {/* Start button pinned to bottom */}
      <View style={[styles.startWrap, { paddingBottom: insets.bottom + space[4] }]}>
        <Button title="Start training" icon="play" size="lg" onPress={onStart} />
      </View>

      {/* HR device selection modal */}
      <HRSelectionModal
        visible={hrSelecting}
        devices={hrDevices}
        onSelect={onSelectHRDevice}
        onCancel={onCancelHRSelection}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: background.base,
    paddingHorizontal: layout.screenHorizontal,
  },
  content: {
    flex: 1,
  },
  header: {
    fontFamily: fontFamily.displayBold,
    fontSize: fontSize['28'],
    color: textColors.primary,
    paddingTop: space[6],
    marginBottom: space[4],
  },
  sectionLabel: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize['12'],
    color: textColors.secondary,
    letterSpacing: 0.8,
    marginBottom: space[2],
    marginTop: space[2],
  },
  divider: {
    height: 1,
    backgroundColor: textColors.secondary,
    opacity: 0.2,
    marginVertical: space[4],
  },
  inputArea: {
    gap: 8,
    marginTop: space[4],
  },
  inputRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: space[4],
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
  },
  startWrap: {
    paddingBottom: space[4],
  },
});
