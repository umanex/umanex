import { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { accent, typeStyles, space, componentRadius } from '@/constants';

export type ErrorMessageProps = {
  message?: string | null;
}

export const ErrorMessage = memo(function ErrorMessage({ message }: ErrorMessageProps) {
  if (!message) return null;

  return (
    <View testID="ErrorMessage" style={styles.banner} accessibilityRole="alert">
      <Ionicons name="alert-circle" size={18} color={accent.default} />
      <Text style={styles.text}>{message}</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space['8'],
    // status.error (#EF4444) heeft geen Figma-var → accent (audit cluster 8):
    // subtiele rode banner, accent-rand + accent.subtle fill.
    backgroundColor: accent.subtle,
    borderWidth: 1,
    borderColor: accent.default,
    borderRadius: componentRadius.input,
    paddingHorizontal: space['12'],
    paddingVertical: space['12'],
  },
  text: {
    ...typeStyles.textLink,
    color: accent.default,
    flex: 1,
  },
});
