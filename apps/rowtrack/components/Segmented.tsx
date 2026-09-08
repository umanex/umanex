import { View, Text, TouchableOpacity, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { bg, fg, accent, border, space, radii, typeStyles } from '@/constants';

export type SegmentedOption<T extends string> = { value: T; label: string };

/**
 * `filled` = zelf-bevattende bg.base-track met border rondom (sheets: PERIODE/TYPE, Geslacht).
 * `band`   = volle-breedte bg.elevated-band met enkel top/bottom-divider (scherm-tabs:
 *            detail Overzicht/Splits/Hartslag, historiek-filter). De parent geeft de
 *            positionering (bv. marginTop) via `style`.
 */
export type SegmentedVariant = 'filled' | 'band';

export type SegmentedProps<T extends string> = {
  options: readonly SegmentedOption<T>[];
  value: T | null;
  onChange: (value: T) => void;
  variant?: SegmentedVariant;
  style?: StyleProp<ViewStyle>;
};

/**
 * Gedeeld segmented control. Eén bron voor de sheet-segmenten (Geslacht, PERIODE/TYPE)
 * én de scherm-tabs (detail, historiek-filter), zodat ze niet kunnen driften. Actief =
 * 0.20 accent-pill + border + SemiBold accent-tekst; de `variant` bepaalt enkel de
 * container (zelf-bevattende box vs. volle-breedte band).
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  variant = 'filled',
  style,
}: SegmentedProps<T>) {
  return (
    <View testID="Segmented" style={[variant === 'band' ? styles.band : styles.filled, style]}>
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <TouchableOpacity
            key={opt.value}
            style={[styles.btn, active && styles.btnActive]}
            onPress={() => onChange(opt.value)}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Text
              style={active ? styles.btnTextActive : styles.btnText}
              numberOfLines={1}
              maxFontSizeMultiplier={1.3}
            >
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  // Track: bg.base + border.strong rondom, 4px padding (Figma 52:9155).
  filled: {
    flexDirection: 'row',
    backgroundColor: bg.base,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: border.strong,
    padding: space['4'],
  },
  // Band: bg.elevated, enkel top/bottom 1px (geen zijranden), 4px padding — full-bleed
  // edge-to-edge tegen de schermrand (Figma Segments/WorkoutDetail + /Historiek w=402).
  band: {
    flexDirection: 'row',
    backgroundColor: bg.elevated,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: border.strong,
    padding: space['4'],
  },
  btn: {
    flex: 1,
    height: space['44'],
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.sm,
  },
  btnActive: {
    // TODO: accent.selected-token (0.20) ontbreekt nog — zelfde hardcode als Chip/GoalSegments.
    backgroundColor: 'rgba(240, 84, 84, 0.20)',
    borderWidth: 1,
    borderColor: accent.default,
    borderRadius: radii.xs, // 4 = track-radius (8) − padding (4): pill nest exact.
  },
  btnText: {
    ...typeStyles.segmentInactive,
    color: fg.tertiary,
  },
  btnTextActive: {
    ...typeStyles.segmentActive,
    color: accent.default,
  },
});
