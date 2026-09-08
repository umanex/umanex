import { View, Text, ActivityIndicator, TouchableOpacity, StyleSheet } from 'react-native';
import { bg, fg, accent, border, typeStyles, radii, space } from '@/constants';

type KPIProps = {
  label: string;
  value: string;
  highlighted?: boolean;
  compact?: boolean;
  /** Flex to fill the parent column height (landscape stack) instead of a fixed height. */
  fill?: boolean;
  onPress?: () => void;
  loading?: boolean;
};

export function KPI({ label, value, highlighted = false, compact = false, fill = false, onPress, loading = false }: KPIProps) {
  const content = (
    <>
      <Text style={[styles.label, compact && styles.labelCompact]}>{label}</Text>
      {loading ? (
        <ActivityIndicator size="small" color={fg.secondary} />
      ) : (
        <Text style={[styles.value, highlighted && styles.valueHighlighted, compact && styles.valueCompact]}>{value}</Text>
      )}
    </>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        testID="KPI"
        style={[styles.container, fill ? styles.containerFill : compact ? styles.containerCompact : styles.containerFixed]}
        onPress={onPress}
        activeOpacity={0.8}
      >
        {content}
      </TouchableOpacity>
    );
  }

  return (
    <View testID="KPI" style={[styles.container, compact && styles.containerCompact]}>
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: bg.elevated,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: border.default,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space['18'],
    paddingVertical: 12,
  },
  // Height variants are mutually exclusive (fixed vs compact vs fill) so a fill
  // card carries NO fixed height and can genuinely flex to fill its column.
  containerFixed: {
    height: 58,
  },
  containerCompact: {
    height: 54,
    paddingVertical: 10,
  },
  // Flex to fill the column height (Figma landscape stack). minHeight guards
  // very short screens; content stays vertically centred via alignItems.
  containerFill: {
    flex: 1,
    minHeight: 36,
  },
  label: {
    ...typeStyles.labelGoalPrefix,
    color: fg.tertiary,
  },
  labelCompact: {
    color: fg.secondary,
  },
  value: {
    ...typeStyles.sectionValue,
    color: fg.primary,
  },
  valueCompact: {
    ...typeStyles.kpiValue,
  },
  valueHighlighted: {
    color: accent.default,
  },
});
