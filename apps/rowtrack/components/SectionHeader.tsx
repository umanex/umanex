import { memo } from 'react';
import { Text, StyleSheet } from 'react-native';
import { text as textColors, label } from '@/constants';

export interface SectionHeaderProps {
  title: string;
}

export const SectionHeader = memo(function SectionHeader({ title }: SectionHeaderProps) {
  return <Text style={styles.title}>{title}</Text>;
});

const styles = StyleSheet.create({
  title: {
    ...label.caps,
    color: textColors.muted,
  },
});
