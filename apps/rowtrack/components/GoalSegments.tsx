import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { background, brand, text as textColors, fontFamily, fontSize, radii, space } from '@/constants';

export type GoalSegmentType = 'Geen' | 'Duur' | 'Afstand' | 'Split' | 'Watt';
const GOAL_TYPES: GoalSegmentType[] = ['Geen', 'Duur', 'Afstand', 'Split', 'Watt'];

interface GoalSegmentsProps {
  selected: GoalSegmentType;
  onChange: (type: GoalSegmentType) => void;
}

export function GoalSegments({ selected, onChange }: GoalSegmentsProps) {
  return (
    <View style={styles.container}>
      {GOAL_TYPES.map((type) => {
        const isActive = selected === type;
        return (
          <TouchableOpacity
            key={type}
            style={[styles.segment, isActive && styles.segmentActive]}
            onPress={() => onChange(type)}
            activeOpacity={0.8}
          >
            <Text style={[styles.label, isActive ? styles.labelActive : styles.labelDefault]}>
              {type}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: background.surface,
    borderRadius: 12,
    padding: 4,
    height: 52,
    alignItems: 'center',
  },
  segment: {
    flex: 1,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.sm,
  },
  segmentActive: {
    backgroundColor: brand.primary,
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
