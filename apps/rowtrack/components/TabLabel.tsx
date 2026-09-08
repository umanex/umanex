import { Text, StyleSheet } from 'react-native';
import { typeStyles } from '@/constants';

type TabLabelProps = {
  label: string;
  focused: boolean;
  color: string;
};

// Design: Albert Sans SemiBold 11px voor actief én inactief — enkel de kleur
// verschilt, en die komt via de `color`-prop van de tab-navigator.
export function TabLabel({ label, color }: TabLabelProps) {
  return (
    <Text testID="TabLabel" style={[styles.label, { color }]} maxFontSizeMultiplier={1.2}>
      {label}
    </Text>
  );
}

const styles = StyleSheet.create({
  label: {
    ...typeStyles.labelGoalPrefix,
  },
});
