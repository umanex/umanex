import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { bg } from '@/constants';

// bg.base opaque → transparent — hetzelfde type fade als de WheelPicker bij de
// doelselectie. FADE_CLEAR is bg.base op 0 alpha (rgba omdat een 8-digit hex met
// alpha niet overal betrouwbaar rendert in de gradient).
const FADE_OPAQUE = bg.base;
const FADE_CLEAR = 'rgba(21, 23, 28, 0)'; // bg.base (#15171C) @ 0 alpha

type BottomFadeProps = {
  /** Hoogte van de fade in px (default 64). */
  height?: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * Overlay-gradient onderaan een scrollbare lijst/tabel: laat de content vervagen
 * richting de onderrand (tabbar-navigatie / vaste knop) i.p.v. hard af te kappen.
 * Plaats als laatste kind van een `position: relative` container; niet-interactief.
 */
export function BottomFade({ height = 64, style }: BottomFadeProps) {
  return (
    <LinearGradient
      testID="BottomFade"
      colors={[FADE_CLEAR, FADE_OPAQUE]}
      style={[styles.fade, { height }, style]}
      pointerEvents="none"
    />
  );
}

const styles = StyleSheet.create({
  fade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
});
