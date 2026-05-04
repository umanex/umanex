import { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { text as textColors, border, body, mono, space } from '@/constants';

export interface SummaryRowProps {
  label: string;
  value: string;
}

export const SummaryRow = memo(function SummaryRow({ label, value }: SummaryRowProps) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: space[1],
    borderBottomWidth: 1,
    borderBottomColor: border.subtle,
  },
  label: {
    ...body.md,
    color: textColors.secondary,
  },
  value: {
    ...mono.lg,
    color: textColors.primary,
  },
});
