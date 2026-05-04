import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { background, brand, text as textColors, fontFamily, fontSize, radii } from '@/constants';

interface ChipProps {
  label: string;
  active: boolean;
  onPress: () => void;
}

export function Chip({ label, active, onPress }: ChipProps) {
  return (
    <TouchableOpacity
      style={[styles.chip, active ? styles.active : styles.default]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Text style={[styles.label, active ? styles.labelActive : styles.labelDefault]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: {
    flex: 1,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.sm,
  },
  active: {
    backgroundColor: brand.primary,
  },
  default: {
    backgroundColor: background.surface,
  },
  label: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize['13'],
  },
  labelActive: {
    color: textColors.inverse,
  },
  labelDefault: {
    color: textColors.secondary,
  },
});
