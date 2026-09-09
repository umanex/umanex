import { memo } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { formatSplit } from '@/lib/formatters';
import { t } from '@/i18n';
import {
  bg,
  fg,
  accent,
  typeStyles,
  fontFamily,
  fontSize,
  space,
  componentRadius,
} from '@/constants';

export type SplitEntry = {
  distance: number;
  split: number;
  watts?: number;
};

export type SplitsListProps = {
  splits: SplitEntry[];
};

export const SplitsList = memo(function SplitsList({ splits }: SplitsListProps) {
  if (splits.length === 0) return null;

  return (
    <View testID="SplitsList" style={styles.container}>
      <Text style={styles.header}>{t.workout.splitsListHeader}</Text>
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
    gap: space['8'],
  },
  header: {
    ...typeStyles.labelGoalPrefix,
    color: fg.tertiary,
  },
  scroll: {
    gap: space['8'],
  },
  chip: {
    backgroundColor: bg.elevated,
    borderRadius: componentRadius.cardSm,
    paddingHorizontal: space['12'],
    paddingVertical: space['6'],
    alignItems: 'center',
    gap: 1,
  },
  distance: {
    ...typeStyles.labelGoalPrefix,
    color: accent.default,
  },
  split: {
    fontFamily: fontFamily.monoMedium,
    fontSize: fontSize['14'],
    color: fg.primary,
  },
});
