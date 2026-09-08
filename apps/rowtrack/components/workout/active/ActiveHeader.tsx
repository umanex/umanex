import { View, StyleSheet } from 'react-native';
import type { WorkoutGoal } from '@/lib/workout-goals';
import { Button } from '@/components/Button';
import { t } from '@/i18n';
import { accent, border, space } from '@/constants';
import { GoalPill } from './GoalPill';

export type ActiveHeaderProps = {
  goal: WorkoutGoal | null;
  onStop: () => void;
  /**
   * Alle VIER de paddings apart, niet twee.
   *
   * Portrait geeft links en rechts dezelfde symmetrische waarde (het 50/50-blok blijft dan
   * gecentreerd in plaats van weggeduwd door de notch aan één kant), maar landscape geeft
   * links de safe-area en rechts een vaste 40 — de binnenrand naar de progress-bar
   * (design 290:2746). Een `paddingHorizontal`-prop kan dat verschil niet uitdrukken.
   */
  paddings: { top: number; bottom: number; left: number; right: number };
};

/**
 * De headerband van het active-scherm: DOEL-pill links, compacte Stop-knop rechts.
 *
 * De accent-tint zit op de BAND (Figma 297:2227), niet op de pill — die is plat, zonder fill
 * of border. Gedeeld portrait/landscape; alleen de paddings verschillen.
 */
export function ActiveHeader({ goal, onStop, paddings }: ActiveHeaderProps) {
  return (
    <View
      testID="ActiveHeader"
      style={[
        styles.header,
        {
          paddingTop: paddings.top,
          paddingBottom: paddings.bottom,
          paddingLeft: paddings.left,
          paddingRight: paddings.right,
        },
      ]}
    >
      <GoalPill goal={goal} />
      <Button
        title={t.workout.active.stopButton}
        variant="primary"
        size="md"
        icon="arrow-forward"
        iconPosition="trailing"
        onPress={onStop}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: space['16'],
    // Header-band met accent-tint + sterke onderrand (Figma 297:2227). De tint zit op de
    // band zelf; de DOEL-pill is plat (geen fill/border). Gedeeld portrait + landscape.
    // TODO: token accent.muted = 0.12; Figma-band = 0.10 (verschil verwaarloosbaar, geen 0.10-token).
    backgroundColor: accent.muted,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: border.strong,
  },
});
