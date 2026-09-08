import { memo } from 'react';
import { Text, StyleSheet } from 'react-native';
import { fg, label } from '@/constants';

export type SectionHeaderProps = {
  title: string;
}

export const SectionHeader = memo(function SectionHeader({ title }: SectionHeaderProps) {
  return <Text testID="SectionHeader" style={styles.title}>{title}</Text>;
});

const styles = StyleSheet.create({
  title: {
    ...label.caps,
    color: fg.tertiary,
  },
});
