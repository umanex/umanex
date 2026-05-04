import { memo } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { formatSplit } from '@/lib/formatters';
import {
  background,
  brand,
  text as textColors,
  fontFamily,
  fontSize,
  space,
  radii,
} from '@/constants';

export interface SplitEntry {
  distance: number;
  split: number;
}

export interface SplitsListProps {
  splits: SplitEntry[];
}

export const SplitsList = memo(function SplitsList({ splits }: SplitsListProps) {
  if (splits.length === 0) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.header}>SPLITS</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {splits.map((s, i) => (
          <View key={i} style={styles.chip}>
            <Text style={styles.distance}>{s.distance}m</Text>
            <Text style={styles.split}>{formatSplit(s.split)}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    gap: space[2],
  },
  header: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize['10'],
    color: textColors.muted,
    letterSpacing: 0.5,
  },
  scroll: {
    gap: space[2],
  },
  chip: {
    backgroundColor: background.surface,
    borderRadius: radii.md,
    paddingHorizontal: space[3],
    paddingVertical: space[2],
    alignItems: 'center',
    gap: space.px,
  },
  distance: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize['10'],
    color: brand.primary,
  },
  split: {
    fontFamily: fontFamily.monoMedium,
    fontSize: fontSize['14'],
    color: textColors.primary,
  },
});
