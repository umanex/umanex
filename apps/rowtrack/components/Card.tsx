import { memo } from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { background, space, componentRadius } from '@/constants';

export interface CardProps {
  children: React.ReactNode;
  padding?: number;
  style?: StyleProp<ViewStyle>;
}

export const Card = memo(function Card({ children, padding = space[4], style }: CardProps) {
  return (
    <View style={[styles.card, { padding }, style]}>
      {children}
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: background.surface,
    borderRadius: componentRadius.cardSm,
    gap: space[3],
  },
});
