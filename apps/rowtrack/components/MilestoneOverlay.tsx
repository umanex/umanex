import { memo, useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import {
  background,
  text as textColors,
  fontFamily,
  fontSize,
  space,
  radii,
} from '@/constants';

export interface MilestoneOverlayProps {
  message: string | null;
  onDismiss: () => void;
}

export const MilestoneOverlay = memo(function MilestoneOverlay({ message, onDismiss }: MilestoneOverlayProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.8)).current;
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  useEffect(() => {
    if (!message) return;

    opacity.setValue(0);
    scale.setValue(0.8);

    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        friction: 6,
        useNativeDriver: true,
      }),
    ]).start();

    const timer = setTimeout(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => onDismissRef.current());
    }, 1500);

    return () => clearTimeout(timer);
  }, [message]); // opacity, scale are stable Animated.Value refs

  if (!message) return null;

  return (
    <View style={styles.overlay} pointerEvents="none">
      <Animated.View
        style={[
          styles.card,
          { opacity, transform: [{ scale }] },
        ]}
      >
        <Text style={styles.text}>{message}</Text>
      </Animated.View>
    </View>
  );
});

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  card: {
    backgroundColor: background.elevated,
    paddingHorizontal: space[8],
    paddingVertical: space[6],
    borderRadius: radii.xl,
  },
  text: {
    fontFamily: fontFamily.displayBold,
    fontSize: fontSize['24'],
    color: textColors.primary,
    textAlign: 'center',
  },
});
