import { View, Text, TextInput, StyleSheet } from 'react-native';
import { background, text as textColors, brand, fontFamily, fontSize } from '@/constants';

interface GoalInputProps {
  value: string;
  onChangeText: (v: string) => void;
  unit: string;
  placeholder?: string;
}

export function GoalInput({ value, onChangeText, unit, placeholder = '0' }: GoalInputProps) {
  return (
    <View style={styles.box}>
      <TextInput
        style={styles.value}
        value={value}
        onChangeText={onChangeText}
        keyboardType="numeric"
        selectTextOnFocus
        placeholder={placeholder}
        placeholderTextColor={textColors.muted}
        selectionColor={brand.primary}
      />
      <Text style={styles.unit}>{unit}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flex: 1,
    backgroundColor: background.surface,
    borderRadius: 12,
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    justifyContent: 'space-between',
  },
  value: {
    fontSize: fontSize['36'],
    fontFamily: fontFamily.displayBold,
    color: textColors.primary,
    flex: 1,
  },
  unit: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: fontSize['14'],
    color: textColors.secondary,
  },
});
