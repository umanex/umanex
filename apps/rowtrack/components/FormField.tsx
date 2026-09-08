import { memo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  type TextInputProps as RNTextInputProps,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { t } from '@/i18n';
import {
  bg,
  fg,
  accent,
  border,
  fontFamily,
  fontSize,
  space,
  componentRadius,
  typeStyles,
} from '@/constants';

export type FormFieldProps = {
  label?: string;
  value: string;
  onChangeText?: (text: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: RNTextInputProps['keyboardType'];
  autoCapitalize?: RNTextInputProps['autoCapitalize'];
  autoComplete?: RNTextInputProps['autoComplete'];
  autoCorrect?: boolean;
  error?: string | null;
  onBlur?: () => void;
}

export const FormField = memo(function FormField({
  label: fieldLabel,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  keyboardType,
  autoCapitalize,
  autoComplete,
  autoCorrect,
  error,
  onBlur,
}: FormFieldProps) {
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);

  const hasError = !!error;
  const isPassword = !!secureTextEntry;

  return (
    <View testID="FormField" style={styles.wrap}>
      {fieldLabel && <Text style={styles.label}>{fieldLabel}</Text>}

      <View
        style={[
          styles.inputWrap,
          focused && styles.inputWrapFocused,
          hasError && styles.inputWrapError,
        ]}
      >
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={fg.tertiary}
          secureTextEntry={isPassword && !revealed}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoComplete={autoComplete}
          autoCorrect={autoCorrect}
          selectionColor={accent.default}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            onBlur?.();
          }}
        />
        {isPassword && (
          <TouchableOpacity
            onPress={() => setRevealed((r) => !r)}
            // 20pt glyph + 12 rondom = 44pt. Met de vorige 8 was het 36 — net te klein.
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={revealed ? t.a11y.hidePassword : t.a11y.showPassword}
          >
            <Ionicons
              name={revealed ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color={fg.tertiary}
            />
          </TouchableOpacity>
        )}
      </View>

      {hasError && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    gap: space['8'],
  },
  label: {
    ...typeStyles.labelGoalPrefix,
    color: fg.tertiary,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space['8'],
    backgroundColor: bg.elevated,
    borderWidth: 1,
    borderColor: border.default,
    borderRadius: componentRadius.input,
    paddingHorizontal: space['16'],
  },
  inputWrapFocused: {
    borderColor: accent.default,
    borderWidth: 2,
  },
  inputWrapError: {
    borderColor: accent.default,
    backgroundColor: accent.subtle,
  },
  input: {
    flex: 1,
    fontFamily: fontFamily.sourceSerifRegular,
    fontSize: fontSize['16'],
    letterSpacing: -0.24,
    color: fg.primary,
    paddingVertical: space['12'],
  },
  errorText: {
    ...typeStyles.textLink,
    color: accent.default,
  },
});
