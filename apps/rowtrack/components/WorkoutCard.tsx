import { memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Card } from './Card';
import { MetricDisplay } from './MetricDisplay';
import { formatDate, formatDuration, formatDistanceDynamic, formatSplit } from '@/lib/formatters';
import { body, fontFamily, space, text as textColors } from '@/constants';
import type { WorkoutSummary } from '@/types/workout';

export interface WorkoutCardProps {
  workout: WorkoutSummary;
  onPress: (id: string) => void;
  showExtras?: boolean;
}

export const WorkoutCard = memo(function WorkoutCard({
  workout: w,
  onPress,
  showExtras = false,
}: WorkoutCardProps) {
  return (
    <TouchableOpacity activeOpacity={0.7} onPress={() => onPress(w.id)}>
      <Card>
        <Text style={styles.date}>{formatDate(w.started_at)}</Text>
        <View style={styles.metrics}>
          <MetricDisplay
            value={formatDuration(w.duration_seconds)}
            label="DUUR"
          />
          <MetricDisplay
            value={formatDistanceDynamic(w.distance_meters).value}
            label="AFSTAND"
            unit={formatDistanceDynamic(w.distance_meters).unit}
          />
          {w.avg_watts != null && (
            <MetricDisplay value={`${w.avg_watts} W`} label="WATT" />
          )}
        </View>
        {showExtras && (w.avg_spm != null || w.avg_split_seconds != null) && (
          <View style={styles.metrics}>
            {w.avg_spm != null && (
              <MetricDisplay value={w.avg_spm} label="SPM" />
            )}
            {w.avg_split_seconds != null && (
              <MetricDisplay
                value={formatSplit(w.avg_split_seconds)}
                label="SPLIT /500M"
              />
            )}
          </View>
        )}
      </Card>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  date: {
    ...body.sm,
    fontFamily: fontFamily.bodySemiBold,
    color: textColors.secondary,
  },
  metrics: {
    flexDirection: 'row',
    gap: space[6],
  },
});
