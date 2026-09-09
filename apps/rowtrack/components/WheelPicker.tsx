import { useCallback, useEffect, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  interpolate,
  Extrapolation,
  scrollTo,
  runOnUI,
  runOnJS,
  type SharedValue,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { bg, fg, border, fontFamily, fontSize, radii } from '@/constants';
import { wheelItemParts, type WheelItem } from '@/lib/formatters';

const ITEM_H = 50;
const PILL_H = 60;
const FADE_H = ITEM_H * 1.5;

// Fade + pill per context. De fade fadet naar de omringende achtergrond (anders een
// kleurrand); de pill contrasteert met die achtergrond + een border.strong-rand.
//   base   = op het scherm (bg.base)  → pill bg.raised (lichter, pops)
//   raised = in een sheet (bg.raised) → pill bg.base   (donkerder inset)
const SURFACE = {
  base:   { opaque: bg.base,   clear: 'rgba(21, 23, 28, 0)', pill: bg.raised }, // #15171C
  raised: { opaque: bg.raised, clear: 'rgba(33, 36, 44, 0)', pill: bg.base },   // #21242C
} as const;

export type WheelSurface = keyof typeof SURFACE;

function triggerHaptic() {
  Haptics.selectionAsync();
}

// --- Row: UI-thread cross-fade of a big (selected) and small (adjacent) layer ---

type WheelRowProps = {
  item: WheelItem;
  index: number;
  scrollY: SharedValue<number>;
};

function WheelRow({ item, index, scrollY }: WheelRowProps) {
  const { value, unit } = wheelItemParts(item);
  const centre = index * ITEM_H;

  const bigStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      scrollY.value,
      [centre - ITEM_H, centre, centre + ITEM_H],
      [0, 1, 0],
      Extrapolation.CLAMP,
    ),
  }));
  const smallStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      scrollY.value,
      [centre - 2 * ITEM_H, centre - ITEM_H, centre, centre + ITEM_H, centre + 2 * ITEM_H],
      [0.5, 0.75, 0, 0.75, 0.5],
      Extrapolation.CLAMP,
    ),
  }));

  return (
    <View style={styles.item}>
      <Animated.View dataSet={{ laag: 'smallLayer' }} style={[styles.layer, smallStyle]}>
        <View style={styles.valueRow}>
          <Text style={styles.smallValue}>{value}</Text>
          {unit ? <Text style={styles.smallUnit}>{unit}</Text> : null}
        </View>
      </Animated.View>
      <Animated.View dataSet={{ laag: 'bigLayer' }} style={[styles.layer, bigStyle]}>
        <View style={styles.valueRow}>
          <Text style={styles.bigValue}>{value}</Text>
          {unit ? <Text style={styles.bigUnit}>{unit}</Text> : null}
        </View>
      </Animated.View>
    </View>
  );
}

type WheelPickerProps = {
  items: WheelItem[];
  selectedIndex: number;
  onIndexChange: (index: number) => void;
  /** Aantal zichtbare rijen (oneven). Default 5 (goal-wheel); sheets gebruiken 3. */
  visibleRows?: number;
  /** Toon de eigen pill-achtergrond. Zet op false wanneer de parent één gedeelde band tekent (date-picker). */
  showPill?: boolean;
  /** Achtergrond-context voor de fade + pill. 'base' = scherm, 'elevated' = sheet. */
  surface?: WheelSurface;
}

export function WheelPicker({
  items,
  selectedIndex,
  onIndexChange,
  visibleRows = 5,
  showPill = true,
  surface = 'base',
}: WheelPickerProps) {
  const half = (visibleRows - 1) / 2;
  const padding = ITEM_H * half;        // centreert de geselecteerde rij
  const pickerH = ITEM_H * visibleRows;
  const pillTop = (pickerH - PILL_H) / 2;
  const fadeColors = SURFACE[surface];

  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollY = useSharedValue(selectedIndex * ITEM_H);
  const lastHaptic = useSharedValue(selectedIndex);
  const syncedIdx = useSharedValue(selectedIndex);
  const initialized = useSharedValue(false);
  // Suppress the per-row haptic while the wheel is moving under program control
  // (chip tap / goal switch); a finger touch re-arms it.
  const suppress = useSharedValue(false);
  const count = items.length;
  // Mount-time scroll offset, captured once so `contentOffset` stays stable and
  // never fights the re-sync effect below.
  const initialY = useRef(selectedIndex * ITEM_H).current;

  const commit = useCallback((idx: number) => {
    if (idx !== selectedIndex) onIndexChange(idx);
  }, [selectedIndex, onIndexChange]);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollY.value = e.contentOffset.y;
      const idx = Math.round(e.contentOffset.y / ITEM_H);
      if (idx !== lastHaptic.value) {
        lastHaptic.value = idx;
        if (!suppress.value && idx >= 0 && idx < count) {
          runOnJS(triggerHaptic)();
        }
      }
    },
    onBeginDrag: () => {
      suppress.value = false;
    },
    onMomentumEnd: (e) => {
      const raw = Math.round(e.contentOffset.y / ITEM_H);
      const idx = Math.min(Math.max(raw, 0), count - 1);
      syncedIdx.value = idx;
      runOnJS(commit)(idx);
    },
  }, [count, commit]);

  // Re-sync to the parent's selectedIndex (chip tap / goal switch).
  useEffect(() => {
    if (syncedIdx.value === selectedIndex) return;
    syncedIdx.value = selectedIndex;
    suppress.value = true;
    const y = selectedIndex * ITEM_H;
    runOnUI(() => {
      scrollTo(scrollRef, 0, y, true);
    })();
  }, [selectedIndex, scrollRef, scrollY, suppress, syncedIdx]);

  // Land on the selected row once the content has actually been measured.
  // onLayout fires before the children are sized, so scrollTo there clamps to 0
  // on a fresh mount — onContentSizeChange is the first point where the offset is valid.
  const onContentSizeChange = useCallback(() => {
    if (initialized.value) return;
    initialized.value = true;
    const y = selectedIndex * ITEM_H;
    scrollY.value = y;
    runOnUI(() => {
      scrollTo(scrollRef, 0, y, false);
    })();
  }, [initialized, scrollRef, scrollY, selectedIndex]);

  return (
    <View testID="WheelPicker" style={[styles.container, { height: pickerH }]}>
      {showPill ? (
        <View style={[styles.pill, { top: pillTop, backgroundColor: fadeColors.pill }]} pointerEvents="none" />
      ) : null}
      <Animated.ScrollView
        ref={scrollRef}
        contentContainerStyle={{ paddingVertical: padding }}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_H}
        decelerationRate="fast"
        contentOffset={{ x: 0, y: initialY }}
        onContentSizeChange={onContentSizeChange}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        nestedScrollEnabled
      >
        {items.map((item, index) => (
          <WheelRow key={index} item={item} index={index} scrollY={scrollY} />
        ))}
      </Animated.ScrollView>
      <LinearGradient
        colors={[fadeColors.opaque, fadeColors.clear]}
        style={[styles.fade, styles.fadeTop]}
        pointerEvents="none"
      />
      <LinearGradient
        colors={[fadeColors.clear, fadeColors.opaque]}
        style={[styles.fade, styles.fadeBottom]}
        pointerEvents="none"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  pill: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: PILL_H,
    // backgroundColor per surface (inline): bg.raised op het scherm, bg.base in een sheet.
    borderWidth: 1,
    borderColor: border.strong,
    borderRadius: radii.sm,
  },
  fade: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: FADE_H,
  },
  fadeTop: {
    top: 0,
  },
  fadeBottom: {
    bottom: 0,
  },
  item: {
    height: ITEM_H,
  },
  layer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  bigValue: {
    fontFamily: fontFamily.albertSansBold,
    fontSize: fontSize['34'],
    letterSpacing: -1.02,
    color: fg.primary,
  },
  bigUnit: {
    fontFamily: fontFamily.albertSansRegular,
    fontSize: fontSize['16'],
    color: fg.primary,
  },
  smallValue: {
    fontFamily: fontFamily.albertSansRegular,
    fontSize: fontSize['20'],
    letterSpacing: -0.4,
    color: fg.secondary,
  },
  smallUnit: {
    fontFamily: fontFamily.albertSansRegular,
    fontSize: fontSize['14'],
    color: fg.secondary,
  },
});
