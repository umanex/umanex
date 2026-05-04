import { memo } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  type TextInputProps as RNTextInputProps,
} from 'react-native';
import {
  background,
  text as textColors,
  border,
  label,
  fontFamily,
  fontSize,
  space,
  componentRadius,
} from '@/constants';

export interface FormFieldProps {
  label?: string;
  value: string;
  onChangeText?: (text: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: RNTextInputProps['keyboardType'];
  autoCapitalize?: RNTextInputProps['autoCapitalize'];
  autoComplete?: RNTextInputProps['autoComplete'];
  autoCorrect?: boolean;
  readOnly?: boolean;
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
  readOnly = false,
}: FormFieldProps) {
  return (
    <View style={fieldLabel ? styles.fieldWithLabel : undefined}>
      {fieldLabel && <Text style={styles.label}>{fieldLabel}</Text>}

      {readOnly ? (
        <View style={styles.readOnlyInput}>
          <Text style={styles.readOnlyText}>{value}</Text>
        </View>
      ) : (
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={textColors.muted}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoComplete={autoComplete}
          autoCorrect={autoCorrect}
        />
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  fieldWithLabel: {
    gap: space[2],
  },
  label: {
    ...label.caps,
    color: textColors.muted,
  },
  input: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: fontSize['16'],
    color: textColors.primary,
    backgroundColor: background.surface,
    borderWidth: 1,
    borderColor: border.default,
    borderRadius: componentRadius.input,
    paddingHorizontal: space[4],
    paddingVertical: space[3],
  },
  readOnlyInput: {
    backgroundColor: background.surface,
    borderRadius: componentRadius.input,
    paddingHorizontal: space[4],
    paddingVertical: space[3],
  },
  readOnlyText: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: fontSize['16'],
    color: textColors.secondary,
  },
});
