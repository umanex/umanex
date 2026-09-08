import { View, Text, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { fg, space, typeStyles } from '@/constants';

type KpiSingleProps = {
  value: string;
  unit?: string;
  label: string;
  style?: StyleProp<ViewStyle>;
};

export function KpiSingle({ value, unit, label, style }: KpiSingleProps) {
  return (
    <View testID="KpiSingle" style={[styles.container, style]}>
      <View style={styles.valueRow}>
        <Text style={styles.value}>{value}</Text>
        {unit ? <Text style={styles.unit}>{unit}</Text> : null}
      </View>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: space['0'],
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 3,
  },
  value: {
    ...typeStyles.sectionValue,
    color: fg.primary,
  },
  unit: {
    ...typeStyles.kpiUnit,
    color: fg.tertiary,
  },
  label: {
    ...typeStyles.labelGoalPrefix,
    color: fg.tertiary,
  },
});
