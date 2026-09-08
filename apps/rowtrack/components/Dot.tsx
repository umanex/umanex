import { View, StyleSheet } from 'react-native';
import { fg, space } from '@/constants';

type DotProps = {
  color?: string;
};

export function Dot({ color }: DotProps) {
  return (
    <View testID="Dot" style={[styles.dot, color !== undefined ? { backgroundColor: color } : undefined]} />
  );
}

const styles = StyleSheet.create({
  dot: {
    width: space['4'],
    height: space['4'],
    borderRadius: space['4'] / 2,
    backgroundColor: fg.tertiary,
  },
});
