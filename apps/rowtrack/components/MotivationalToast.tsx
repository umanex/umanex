import { memo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  StatusBar,
  TouchableOpacity,
  Animated,
  StyleSheet,
  Dimensions,
} from 'react-native';
import {
  fontFamily,
  status as statusColors,
} from '@/constants';

const GOAL_COLOR = statusColors.success; // #22C55E
const CONFETTI_COLORS = ['#F05454', '#00E5FF', GOAL_COLOR, '#FFD700', '#FF69B4', '#FFFFFF'];
const PARTICLE_COUNT = 60;
const SCREEN_HEIGHT = Dimensions.get('window').height;
const SCREEN_WIDTH = Dimensions.get('window').width;

export interface MotivationalToastProps {
  message: string | null;
  onDismiss: () => void;
  isGoalComplete?: boolean;
}

// --- Confetti ---

interface Particle {
  anim: Animated.Value;
  x: number;
  color: string;
  duration: number;
  size: number;
  rotation: number;
}

function useConfetti(active: boolean): Particle[] {
  const particlesRef = useRef<Particle[]>(
    Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
      anim: new Animated.Value(0),
      x: Math.random() * SCREEN_WIDTH,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      duration: 1400 + Math.random() * 1200,
      size: 6 + Math.random() * 8,
      rotation: Math.random() * 360,
    })),
  );

  useEffect(() => {
    const particles = particlesRef.current;
    if (!active) {
      particles.forEach((p) => p.anim.setValue(0));
      return;
    }

    // Reset all before starting
    particles.forEach((p) => p.anim.setValue(0));

    const animations = particles.map((p) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(p.anim, {
            toValue: 1,
            duration: p.duration,
            useNativeDriver: true,
          }),
          Animated.timing(p.anim, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
      ),
    );

    const composite = Animated.stagger(25, animations);
    composite.start();
    return () => composite.stop();
  }, [active]);

  return particlesRef.current;
}

function Confetti({ visible, particles }: { visible: boolean; particles: Particle[] }) {
  if (!visible) return null;

  return (
    <>
      {particles.map((p, i) => {
        const translateY = p.anim.interpolate({
          inputRange: [0, 1],
          outputRange: [-20, SCREEN_HEIGHT + 20],
        });

        return (
          <Animated.View
            key={i}
            style={{
              position: 'absolute',
              left: p.x,
              top: 0,
              width: p.size,
              height: p.size,
              borderRadius: p.size / 2,
              backgroundColor: p.color,
              transform: [
                { translateY },
                { rotate: `${p.rotation}deg` },
              ],
            }}
          />
        );
      })}
    </>
  );
}

// --- Toast ---

export const MotivationalToast = memo(function MotivationalToast({
  message,
  onDismiss,
  isGoalComplete,
}: MotivationalToastProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.8)).current;
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  const visible = !!message;
  const showConfetti = !!isGoalComplete && visible;
  const confettiParticles = useConfetti(showConfetti);

  if (__DEV__) {
    console.log('[MotivationalToast] visible:', visible, 'isGoalComplete:', isGoalComplete);
  }

  useEffect(() => {
    if (!message) return;

    opacity.setValue(0);
    scale.setValue(0.8);

    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();

    const timer = setTimeout(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }).start(() => onDismissRef.current());
    }, 3000);

    return () => clearTimeout(timer);
  }, [message]); // opacity, scale are stable refs

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={() => onDismissRef.current()}
    >
      <StatusBar backgroundColor="rgba(0,0,0,0.85)" barStyle="light-content" />
      <View style={styles.overlay}>
        <Confetti visible={showConfetti} particles={confettiParticles} />

        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={() => onDismissRef.current()}
        />

        <Animated.View style={[styles.content, { opacity, transform: [{ scale }] }]}>
          <Text style={styles.emoji}>
            {isGoalComplete ? '🏆' : '💪'}
          </Text>
          <Text style={[styles.text, isGoalComplete && styles.textGoal]}>
            {message}
          </Text>
        </Animated.View>
      </View>
    </Modal>
  );
});

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  text: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 28,
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 36,
  },
  textGoal: {
    color: statusColors.success,
    fontSize: 32,
    lineHeight: 40,
  },
});
