import { type ComponentProps, memo } from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import {
  buttonTokens,
  fg,
  typeStyles,
  body,
  space,
  radii,
} from '@/constants';
import { variantData } from '@/lib/variantData';

type IoniconsName = ComponentProps<typeof Ionicons>['name'];

export type ButtonProps = {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'destructive' | 'ghost' | 'outline';
  size?: 'md' | 'lg';
  icon?: IoniconsName;
  iconPosition?: 'leading' | 'trailing';
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

const variantStyles = {
  primary: {
    bg: buttonTokens.primary.background,
    text: buttonTokens.primary.text,
  },
  destructive: {
    bg: buttonTokens.destructive.background,
    text: buttonTokens.destructive.text,
  },
  ghost: {
    bg: 'transparent',
    text: fg.tertiary,
  },
  outline: {
    bg: buttonTokens.outline.background,
    text: buttonTokens.outline.text,
  },
} as const;

export const Button = memo(function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'lg',
  icon,
  iconPosition = 'leading',
  loading = false,
  disabled = false,
  style,
}: ButtonProps) {
  const colors = variantStyles[variant];
  const isDisabled = disabled || loading;
  const isPrimary = variant === 'primary';

  const iconEl = icon ? (
    <Ionicons name={icon} size={18} color={colors.text} />
  ) : null;

  return (
    <TouchableOpacity
      testID="Button"
      dataSet={variantData({ variant, size, loading, disabled })}
      style={[
        styles.base,
        size === 'lg' ? styles.sizeLg : styles.sizeMd,
        variant === 'destructive' && { backgroundColor: colors.bg },
        variant === 'outline' && { borderWidth: buttonTokens.outline.borderWidth, borderColor: buttonTokens.outline.border },
        isPrimary && !isDisabled && styles.primary,
        isDisabled && styles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.8}
      accessibilityRole="button"
      // Expliciet label i.p.v. de samengevoegde kindtekst: bij `loading` vervangt de
      // ActivityIndicator de Text en zou de knop naamloos zijn. `title` komt al uit t.*.
      accessibilityLabel={title}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
    >
      {isPrimary && (
        <LinearGradient
          colors={[buttonTokens.primary.gradientFrom, buttonTokens.primary.gradientTo]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[StyleSheet.absoluteFillObject, styles.gradient]}
        />
      )}
      {loading ? (
        <ActivityIndicator color={colors.text} />
      ) : (
        <>
          {iconPosition === 'leading' && iconEl}
          <Text
            // sizeLg heeft een vaste hoogte (space['44']) en de tekst is 18px: boven ~1.3×
            // Dynamic Type knipt het label af binnen de knop. Cap i.p.v. clip.
            maxFontSizeMultiplier={1.3}
            style={[
              variant === 'ghost'
                ? styles.ghostText
                : variant === 'outline'
                  ? styles.outlineText
                  : styles.text,
              { color: colors.text },
            ]}
          >
            {title}
          </Text>
          {iconPosition === 'trailing' && iconEl}
        </>
      )}
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space['10'],
    borderRadius: radii.full,
  },
  sizeLg: {
    height: space['44'],
    paddingHorizontal: buttonTokens.primary.paddingX,
  },
  sizeMd: {
    paddingVertical: space['12'],
    paddingHorizontal: space['24'],
  },
  primary: {
    // 1px accent-rand + 4-laags boxShadow uit de design-tokens (audit cluster 4).
    borderWidth: buttonTokens.primary.borderWidth,
    borderColor: buttonTokens.primary.border,
    boxShadow: [...buttonTokens.primary.shadow],
  },
  disabled: {
    opacity: 0.6,
  },
  gradient: {
    borderRadius: radii.full,
  },
  text: {
    ...typeStyles.buttonPrimary,
  },
  outlineText: {
    ...typeStyles.buttonOutline,
  },
  ghostText: {
    ...body.md,
    color: fg.tertiary,
  },
});
