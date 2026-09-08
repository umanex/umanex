import { View, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, { withTiming, Easing } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import type { GoalType } from '@/lib/workout-goals';
import { t } from '@/i18n';
import { bg, fg, accent, border, radii, space, typeStyles } from '@/constants';

// Custom enter: the pill + label fade and spring-pop in on the (remounted)
// active segment — a UI-thread, buttery version of the pop-in. The segment
// LAYOUT is kept correct by the remount (Fabric reclaims the de-activated
// label's width there); animating the width instead — RN LayoutAnimation or
// Reanimated LinearTransition — reintroduces the stale-width clipping, so we
// animate the appearance, not the width.
function pillEnter() {
  'worklet';
  return {
    initialValues: { opacity: 0, transform: [{ scale: 0.9 }] },
    animations: {
      opacity: withTiming(1, { duration: 150 }),
      transform: [{ scale: withTiming(1, { duration: 220, easing: Easing.out(Easing.back(1.3)) }) }],
    },
  };
}

/** Segment-waarde = doeltype of 'none' (geen doel). Labels komen uit de i18n-laag. */
export type GoalSegmentType = GoalType | 'none';
type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

const GOAL_ICONS: Record<GoalSegmentType, IoniconsName> = {
  none:     'infinite-outline',
  duration: 'time-outline',
  distance: 'location-outline',
  split:    'stopwatch-outline',
  watts:    'flash-outline',
};

const SEGMENT_LABELS: Record<GoalSegmentType, string> = {
  none:     t.goals.segmentNone,
  duration: t.goals.segmentDuration,
  distance: t.goals.segmentDistance,
  split:    t.goals.segmentSplit,
  watts:    t.goals.segmentWatts,
};

const ACCESSIBILITY_LABELS: Record<GoalSegmentType, string> = {
  none:     t.goals.segmentNoneA11y,
  duration: t.goals.segmentDurationA11y,
  distance: t.goals.segmentDistanceA11y,
  split:    t.goals.segmentSplitA11y,
  watts:    t.goals.segmentWattsA11y,
};

const GOAL_TYPES: GoalSegmentType[] = ['none', 'duration', 'distance', 'split', 'watts'];

// --- Per-segment button with its own label animation lifecycle ---

type SegmentButtonProps = {
  type: GoalSegmentType;
  isActive: boolean;
  onPress: () => void;
};

function SegmentButton({ type, isActive, onPress }: SegmentButtonProps) {
  return (
    <TouchableOpacity
      style={[styles.segment, isActive ? styles.segmentActive : styles.segmentInactive]}
      onPress={onPress}
      activeOpacity={1}
      accessibilityRole="button"
      accessibilityLabel={ACCESSIBILITY_LABELS[type]}
      accessibilityState={{ selected: isActive }}
    >
      {isActive && (
        <Animated.View entering={pillEnter} style={styles.activePill} pointerEvents="none" />
      )}
      <Ionicons
        name={GOAL_ICONS[type]}
        size={16}
        color={isActive ? accent.default : fg.tertiary}
      />
      {isActive && (
        <Animated.Text
          entering={pillEnter}
          style={styles.activeLabel}
          numberOfLines={1}
          maxFontSizeMultiplier={1.3}
        >
          {SEGMENT_LABELS[type]}
        </Animated.Text>
      )}
    </TouchableOpacity>
  );
}

// --- Segmented control ---

type GoalSegmentsProps = {
  selected: GoalSegmentType;
  onChange: (type: GoalSegmentType) => void;
};

export function GoalSegments({ selected, onChange }: GoalSegmentsProps) {
  function handlePress(type: GoalSegmentType) {
    if (type === selected) return;
    Haptics.selectionAsync();
    onChange(type);
  }

  // Fills its parent's width (definite in every context) so the flex:1 inactive
  // segments compress evenly. Full-bleed is the parent's job — IdlePhase wraps
  // this in a screen-width bleed container; the modal card sizes it to the card.
  return (
    <View testID="GoalSegments" style={styles.container}>
      {GOAL_TYPES.map((type) => (
        // Key on active-state: a de-activated segment remounts fresh (icon only,
        // flex:1) so Fabric reclaims its old label width — otherwise a later
        // active segment (Split/Watt) runs off-screen.
        <SegmentButton
          key={`${type}-${selected === type}`}
          type={type}
          isActive={selected === type}
          onPress={() => handlePress(type)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  // Band with only top/bottom dividers (no rounded box). Fills the parent width;
  // the parent decides whether that is full-bleed (IdlePhase) or card-width (modal).
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space['4'],
    paddingVertical: space['4'],
    backgroundColor: bg.elevated,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: border.strong,
  },
  segment: {
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: space['6'],
  },
  // Inactieve segmenten verdelen de resterende ruimte gelijk; het actieve
  // segment is hug-content (icon + label) — conform Figma (inactief ~71, actief ~99).
  segmentInactive: {
    flex: 1,
  },
  segmentActive: {
    paddingHorizontal: space['20'],
  },
  // Pill visuals live on an absolute layer so they can animate (opacity + scale)
  // independently of the segment's layout width.
  activePill: {
    ...StyleSheet.absoluteFillObject,
    // TODO: token voor de 0.20 accent-selectie-fill ontbreekt (accent.muted = 0.12).
    backgroundColor: 'rgba(240, 84, 84, 0.20)',
    borderWidth: 1,
    borderColor: accent.default,
    borderRadius: radii.xs,
  },
  activeLabel: {
    ...typeStyles.segmentActive,
    color: accent.default,
  },
});
