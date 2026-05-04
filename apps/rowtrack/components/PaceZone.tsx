import { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import {
  status,
  brand,
  text as textColors,
  fontFamily,
  fontSize,
  space,
  radii,
} from '@/constants';

export type PaceZoneLevel = 'on_pace' | 'slightly_off' | 'off_pace';

export interface PaceZoneProps {
  zone: PaceZoneLevel;
}

const ZONE_CONFIG: Record<PaceZoneLevel, { color: string; label: string }> = {
  on_pace: { color: status.success, label: 'OP KOERS' },
  slightly_off: { color: status.warning, label: 'IETS TRAGER' },
  off_pace: { color: status.error, label: 'TE TRAAG' },
};

export function getPaceZone(current: number, target: number, lowerIsBetter: boolean): PaceZoneLevel {
  const ratio = lowerIsBetter ? current / target : target / current;
  // ratio > 1 means worse than target
  if (ratio <= 1.05) return 'on_pace';
  if (ratio <= 1.15) return 'slightly_off';
  return 'off_pace';
}

export const PaceZone = memo(function PaceZone({ zone }: PaceZoneProps) {
  const config = ZONE_CONFIG[zone];

  return (
    <View style={styles.container}>
      <View style={[styles.dot, { backgroundColor: config.color }]} />
      <Text style={[styles.label, { color: config.color }]}>{config.label}</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[1],
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: radii.full,
  },
  label: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize['10'],
    letterSpacing: 0.5,
  },
});
