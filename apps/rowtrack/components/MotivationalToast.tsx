import { memo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  StatusBar,
  TouchableOpacity,
  Animated,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { Button } from '@/components/Button';   // direct, geen barrel — zie workout/IdlePhase.tsx
import { t } from '@/i18n';
import { bg, fg, fontFamily, fontSize, componentRadius, space } from '@/constants';

const CONFETTI_COLORS = ['#F05454', '#3B82F6', '#22C55E', '#FFD700', '#FF69B4', '#FFFFFF'];
const PARTICLE_COUNT = 60;

export type MotivationalToastProps = {
  message: string | null;
  onDismiss: () => void;
};

// --- Confetti ---
// Positie als fractie (0..1) van de schermbreedte i.p.v. absolute px, zodat de
// confetti ook in landscape het volledige scherm dekt — de animatie zelf blijft
// exact zoals voorheen (val, rotatie, timing, stagger).

type Particle = {
  anim: Animated.Value;
  xFrac: number;
  color: string;
  duration: number;
  size: number;
  rotation: number;
};

function useConfetti(active: boolean): Particle[] {
  const particlesRef = useRef<Particle[]>(
    Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
      anim: new Animated.Value(0),
      xFrac: Math.random(),
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

function Confetti({ visible, particles, width, height }: { visible: boolean; particles: Particle[]; width: number; height: number }) {
  if (!visible) return null;

  return (
    <>
      {particles.map((p, i) => {
        const translateY = p.anim.interpolate({
          inputRange: [0, 1],
          outputRange: [-20, height + 20],
        });

        return (
          <Animated.View
            key={i}
            style={{
              position: 'absolute',
              left: p.xFrac * width,
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

// --- Goal-reached celebration ---

export const MotivationalToast = memo(function MotivationalToast({
  message,
  onDismiss,
}: MotivationalToastProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.8)).current;
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  const { width, height } = useWindowDimensions();
  const visible = !!message;
  const confettiParticles = useConfetti(visible);

  useEffect(() => {
    if (!message) return;

    opacity.setValue(0);
    scale.setValue(0.8);

    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();
    // Viering: geen auto-dismiss — de gebruiker gaat verder met de knop.
  }, [message]); // opacity, scale are stable refs

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      supportedOrientations={['portrait', 'landscape']}
      onRequestClose={() => onDismissRef.current()}
    >
      <StatusBar backgroundColor="rgba(0,0,0,0.85)" barStyle="light-content" />
      <View testID="MotivationalToast" style={styles.overlay}>
        <Confetti visible={visible} particles={confettiParticles} width={width} height={height} />

        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={() => onDismissRef.current()}
        />

        <Animated.View style={[styles.card, { opacity, transform: [{ scale }] }]}>
          <Text style={styles.trophy}>🏆</Text>
          <Text style={styles.title}>{t.workout.celebration.title}</Text>
          {message && <Text style={styles.body}>{message}</Text>}
          <Button
            title={t.workout.celebration.viewSummary}
            variant="primary"
            size="md"
            icon="arrow-forward"
            iconPosition="trailing"
            onPress={() => onDismissRef.current()}
          />
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
    paddingHorizontal: space['20'],
  },
  // Card: translucente bg.raised (Figma Toast Card, 75%), radius 16, gecentreerd.
  // width 100% met maxWidth 362 → vult de breedte in portrait, blijft gecentreerd
  // en smal in landscape.
  card: {
    // TODO: token voor bg.raised @ 75% ontbreekt — rgba van bg.raised (#21242C).
    backgroundColor: 'rgba(33, 36, 44, 0.75)',
    borderRadius: componentRadius.card,
    padding: space['32'],
    gap: space['28'],
    alignItems: 'center',
    width: '100%',
    maxWidth: 362,
  },
  trophy: {
    fontSize: fontSize['48'],
  },
  title: {
    fontFamily: fontFamily.albertSansBold,
    fontSize: fontSize['34'],
    color: fg.primary,
    textAlign: 'center',
  },
  body: {
    fontFamily: fontFamily.albertSansRegular,
    fontSize: fontSize['18'],
    color: fg.secondary,
    textAlign: 'center',
    lineHeight: 26,
  },
});
