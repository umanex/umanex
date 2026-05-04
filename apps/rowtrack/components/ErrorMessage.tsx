import { memo } from 'react';
import { Text, StyleSheet } from 'react-native';
import { status, body } from '@/constants';

export interface ErrorMessageProps {
  message?: string | null;
}

export const ErrorMessage = memo(function ErrorMessage({ message }: ErrorMessageProps) {
  if (!message) return null;

  return <Text style={styles.error}>{message}</Text>;
});

const styles = StyleSheet.create({
  error: {
    ...body.sm,
    color: status.error,
    textAlign: 'center',
  },
});
