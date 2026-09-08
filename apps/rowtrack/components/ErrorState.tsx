import { type ComponentProps, memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fg, display, body, space } from '@/constants';
import { t } from '@/i18n';
import { Button } from './Button';

type IoniconsName = ComponentProps<typeof Ionicons>['name'];

export type ErrorStateProps = {
  title?: string;
  subtitle?: string;
  onRetry?: () => void;
  retryLabel?: string;
  icon?: IoniconsName;
  size?: 'sm' | 'lg';
};

/**
 * Distincte fout-staat voor mislukte reads — bewust apart van EmptyState, zodat
 * een netwerk-/backendfout niet als "geen data" leest (security-audit P2-2).
 */
export const ErrorState = memo(function ErrorState({
  title = t.states.errorTitle,
  subtitle = t.states.errorSubtitle,
  onRetry,
  retryLabel = t.common.retry,
  icon = 'cloud-offline-outline',
  size = 'sm',
}: ErrorStateProps) {
  return (
    <View testID="ErrorState" style={size === 'lg' ? styles.containerLg : styles.containerSm}>
      <Ionicons name={icon} size={size === 'lg' ? 64 : 48} color={fg.tertiary} />
      <Text style={size === 'lg' ? styles.titleLg : styles.titleSm}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      {onRetry ? (
        <Button
          title={retryLabel}
          onPress={onRetry}
          variant="outline"
          size="md"
          style={styles.btn}
        />
      ) : null}
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
    color: fg.tertiary,
    textAlign: 'center',
  },
  titleLg: {
    ...display.sm,
    color: fg.primary,
    textAlign: 'center',
  },
  subtitle: {
    ...body.md,
    color: fg.secondary,
    textAlign: 'center',
  },
  btn: {
    marginTop: space[8],
  },
});
