import { type ComponentProps, memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { text as textColors, display, body, space } from '@/constants';

type IoniconsName = ComponentProps<typeof Ionicons>['name'];

export interface EmptyStateProps {
  icon: IoniconsName;
  title: string;
  subtitle?: string;
  iconSize?: number;
  size?: 'sm' | 'lg';
}

export const EmptyState = memo(function EmptyState({
  icon,
  title,
  subtitle,
  iconSize,
  size = 'sm',
}: EmptyStateProps) {
  const resolvedIconSize = iconSize ?? (size === 'lg' ? 64 : 48);

  return (
    <View style={size === 'lg' ? styles.containerLg : styles.containerSm}>
      <Ionicons name={icon} size={resolvedIconSize} color={textColors.muted} />
      <Text style={size === 'lg' ? styles.titleLg : styles.titleSm}>
        {title}
      </Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
    </View>
  );
});

const styles = StyleSheet.create({
  containerSm: {
    alignItems: 'center',
    paddingVertical: space[12],
    gap: space[3],
  },
  containerLg: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[3],
  },
  titleSm: {
    ...body.md,
    color: textColors.muted,
    textAlign: 'center',
  },
  titleLg: {
    ...display.sm,
    color: textColors.primary,
    textAlign: 'center',
  },
  subtitle: {
    ...body.md,
    color: textColors.secondary,
    textAlign: 'center',
  },
});
