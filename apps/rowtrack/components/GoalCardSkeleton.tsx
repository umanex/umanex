import { View, StyleSheet } from 'react-native';
import { bg, border, space, radii } from '@/constants';

/**
 * Plaatshouder voor GoalProgressCard zolang `usePeriodGoal` laadt. Dezelfde card-chrome
 * en hetzelfde verticale ritme als de echte kaart, zodat de doel-sectie bij een cold
 * start niet in-popt (audit F6 en F9 — layout-shift).
 *
 * TODO: de balkkleur leent `border.strong` bij gebrek aan een placeholder-rol in de
 * tokens. Zodra er een echte skeleton-rol bestaat (zie openstaande vraag), hier omzetten.
 */
export function GoalCardSkeleton() {
  return (
    <View
      testID="GoalCardSkeleton"
      style={styles.card}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View style={styles.barSubtitle} />
      <View style={styles.barValue} />
      <View style={styles.track} />
      <View style={styles.barStatus} />
    </View>
  );
}

const styles = StyleSheet.create({
  // Spiegelt GoalProgressCard.card: bg.raised, top/bottom-border, padding 20.
  card: {
    backgroundColor: bg.raised,
    padding: space['20'],
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: border.default,
  },
  barSubtitle: {
    height: space['16'],
    width: '45%',
    borderRadius: radii.xs,
    backgroundColor: border.strong,
  },
  // Marges = paddingTop 20 / paddingBottom 16 van de echte valuesRow.
  barValue: {
    height: space['32'],
    width: '60%',
    marginTop: space['20'],
    marginBottom: space['16'],
    borderRadius: radii.xs,
    backgroundColor: border.strong,
  },
  // Full-bleed door de card-padding heen, net als de echte ProgressBar-track.
  track: {
    height: space['4'],
    marginHorizontal: -space['20'],
    borderRadius: radii.lg,
    backgroundColor: border.default,
  },
  barStatus: {
    height: space['14'],
    width: '70%',
    marginTop: space['16'],
    borderRadius: radii.xs,
    backgroundColor: border.strong,
  },
});