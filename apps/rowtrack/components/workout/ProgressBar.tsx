import { memo, useEffect, useRef, useState } from 'react';
import { View, Text, Animated, StyleSheet, type LayoutChangeEvent } from 'react-native';
import {
  background,
  brand,
  fontFamily,
  space,
  status as statusColors,
} from '@/constants';
import { formatDistanceDynamic } from '@/lib/formatters';

const BORDER_RADIUS = 20;
const STROKE = 8;
const CYAN = brand.primary;
const GOAL_COLOR = statusColors.success; // #22C55E

function blendColors(c1: string, c2: string, t: number): string {
  const p = (hex: string, o: number) => parseInt(hex.slice(o, o + 2), 16);
  const r = Math.round(p(c1, 1) + (p(c2, 1) - p(c1, 1)) * t);
  const g = Math.round(p(c1, 3) + (p(c2, 3) - p(c1, 3)) * t);
  const b = Math.round(p(c1, 5) + (p(c2, 5) - p(c1, 5)) * t);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1).toUpperCase()}`;
}

export interface ProgressBarProps {
  progress: number;
  timerDisplay: string;
  isCountdown: boolean;
  goalType?: string;
  currentDistance?: number;
  goalTarget?: number;
}

function segInterpolate(
  anim: Animated.Value,
  segStart: number,
  segEnd: number,
  maxLen: number,
): Animated.AnimatedInterpolation<number> {
  const EPS = 0.0001;
  const a = Math.max(0, segStart - EPS);
  const b = segStart;
  const c = Math.max(segEnd, b + EPS);
  const d = Math.min(1, c + EPS);
  return anim.interpolate({
    inputRange: [a, b, c, d],
    outputRange: [0, 0, maxLen, maxLen],
    extrapolate: 'clamp',
  });
}

function cornerInterpolate(
  anim: Animated.Value,
  segStart: number,
  segEnd: number,
): Animated.AnimatedInterpolation<number> {
  const EPS = 0.0001;
  const a = Math.max(0, segStart);
  const b = Math.max(segEnd, a + EPS);
  return anim.interpolate({
    inputRange: [a, b],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
}

export const ProgressBar = memo(function ProgressBar({
  progress,
  timerDisplay,
  isCountdown,
  goalType,
  currentDistance,
  goalTarget,
}: ProgressBarProps) {
  const pct = Math.min(Math.max(progress, 0), 1);
  const [dims, setDims] = useState({ width: 0, height: 0 });
  const animValue = useRef(new Animated.Value(0)).current;

  const handleLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setDims({ width, height });
  };

  useEffect(() => {
    Animated.timing(animValue, {
      toValue: pct,
      duration: 500,
      useNativeDriver: false,
    }).start();
  }, [pct]); // animValue is a stable ref

  // Border color: cyan → green in last 25%
  const strokeColor = pct >= 0.75
    ? blendColors(CYAN, GOAL_COLOR, (pct - 0.75) / 0.25)
    : CYAN;

  const { width: W, height: H } = dims;
  const topLen = Math.max(0, W - 2 * BORDER_RADIUS);
  const rightLen = Math.max(0, H - 2 * BORDER_RADIUS);
  const bottomLen = topLen;
  const leftLen = rightLen;

  // Determine display value based on goal type
  const isDistanceGoal = goalType === 'distance';
  const remaining = Math.max(0, (goalTarget ?? 0) - (currentDistance ?? 0));
  const distFmt = isDistanceGoal ? formatDistanceDynamic(remaining) : null;
  const displayValue = isDistanceGoal ? `${distFmt!.value}${distFmt!.unit}` : timerDisplay;

  // Dynamic font size: 75% of container width, clamped 40–96
  const timerFontSize = W > 0
    ? Math.min(96, Math.max(40, (W * 0.75) / (displayValue.length * 0.6)))
    : 48;

  return (
    <View style={styles.container} onLayout={handleLayout}>
      {/* Background */}
      <View style={styles.bg} />

      {/* Animated border — 4 edges + 4 corners */}
      {W > 0 && (
        <>
          <Animated.View
            style={[styles.segHorizontal, {
              top: 0, left: BORDER_RADIUS, height: STROKE,
              backgroundColor: strokeColor,
              width: segInterpolate(animValue, 0, 0.25, topLen),
            }]}
          />
          <Animated.View
            style={[styles.segCorner, {
              top: 0, right: 0, width: BORDER_RADIUS, height: BORDER_RADIUS,
              borderTopRightRadius: BORDER_RADIUS,
              borderTopWidth: STROKE, borderRightWidth: STROKE,
              borderColor: strokeColor,
              opacity: cornerInterpolate(animValue, 0.20, 0.25),
            }]}
          />
          <Animated.View
            style={[styles.segVertical, {
              top: BORDER_RADIUS, right: 0, width: STROKE,
              backgroundColor: strokeColor,
              height: segInterpolate(animValue, 0.25, 0.50, rightLen),
            }]}
          />
          <Animated.View
            style={[styles.segCorner, {
              bottom: 0, right: 0, width: BORDER_RADIUS, height: BORDER_RADIUS,
              borderBottomRightRadius: BORDER_RADIUS,
              borderBottomWidth: STROKE, borderRightWidth: STROKE,
              borderColor: strokeColor,
              opacity: cornerInterpolate(animValue, 0.45, 0.50),
            }]}
          />
          <Animated.View
            style={[styles.segHorizontal, {
              bottom: 0, right: BORDER_RADIUS, height: STROKE,
              backgroundColor: strokeColor,
              width: segInterpolate(animValue, 0.50, 0.75, bottomLen),
            }]}
          />
          <Animated.View
            style={[styles.segCorner, {
              bottom: 0, left: 0, width: BORDER_RADIUS, height: BORDER_RADIUS,
              borderBottomLeftRadius: BORDER_RADIUS,
              borderBottomWidth: STROKE, borderLeftWidth: STROKE,
              borderColor: strokeColor,
              opacity: cornerInterpolate(animValue, 0.70, 0.75),
            }]}
          />
          <Animated.View
            style={[styles.segVertical, {
              bottom: BORDER_RADIUS, left: 0, width: STROKE,
              backgroundColor: strokeColor,
              height: segInterpolate(animValue, 0.75, 1.0, leftLen),
            }]}
          />
          <Animated.View
            style={[styles.segCorner, {
              top: 0, left: 0, width: BORDER_RADIUS, height: BORDER_RADIUS,
              borderTopLeftRadius: BORDER_RADIUS,
              borderTopWidth: STROKE, borderLeftWidth: STROKE,
              borderColor: strokeColor,
              opacity: cornerInterpolate(animValue, 0.95, 1.0),
            }]}
          />
        </>
      )}

      {/* Content — vertically centered column */}
      <View style={styles.content} pointerEvents="none">
        {goalType != null && (
          <Text style={styles.pctLabel}>{Math.round(pct * 100)}% voldaan</Text>
        )}
        <Text style={[styles.timer, { fontSize: timerFontSize, lineHeight: timerFontSize * 1.1, letterSpacing: 0, color: strokeColor }]}>
          {isDistanceGoal ? (
            <>
              {distFmt!.value}
              <Text style={{ fontSize: timerFontSize * 0.6, letterSpacing: 0 }}>
                {distFmt!.unit}
              </Text>
            </>
          ) : displayValue}
        </Text>
        <Text style={styles.label}>
          {isDistanceGoal
            ? 'NOG TE ROEIEN'
            : isCountdown ? 'RESTERENDE TIJD' : 'VERSTREKEN TIJD'}
        </Text>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignSelf: 'stretch',
    borderRadius: BORDER_RADIUS,
    overflow: 'hidden',
  },
  bg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: background.surface,
    borderRadius: BORDER_RADIUS,
  },
  segHorizontal: {
    position: 'absolute',
    backgroundColor: brand.primary,
  },
  segVertical: {
    position: 'absolute',
    backgroundColor: brand.primary,
  },
  segCorner: {
    position: 'absolute',
    borderColor: brand.primary,
  },
  content: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[4],
  },
  pctLabel: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: 13,
    color: '#FFFFFF',
    opacity: 0.6,
  },
  timer: {
    fontFamily: fontFamily.monoMedium,
    color: brand.primary,
  },
  label: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 13,
    color: '#FFFFFF',
    opacity: 0.6,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
});
