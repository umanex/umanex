import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { brand, text as textColors, fontFamily, fontSize } from '@/constants';

interface SegmentProps {
  label: string;
  active: boolean;
  onPress: () => void;
}

export function Segment({ label, active, onPress }: SegmentProps) {
  return (
    <TouchableOpacity
      style={[styles.base, active && styles.active]}
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
  base: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  active: {
    backgroundColor: brand.primary,
    borderRadius: 8,
  },
  label: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize['13'],
  },
  labelActive: {
    color: textColors.inverse,
  },
  labelDefault: {
    color: textColors.secondary,
  },
});
