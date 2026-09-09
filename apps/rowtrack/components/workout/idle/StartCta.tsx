import { View, StyleSheet } from 'react-native';
import { Button } from '@/components/Button';
import { t } from '@/i18n';

export type StartCtaProps = {
  onStart: () => void;
};

/**
 * De vaste startknop onderaan het startscherm.
 *
 * Hij staat BUITEN de ScrollView: de knop moet bereikbaar blijven terwijl de picker scrollt.
 * De paddings zijn daarom van de zone en niet van de scroll-inhoud.
 */
export function StartCta({ onStart }: StartCtaProps) {
  return (
    <View testID="StartCta" style={styles.ctaArea}>
      <Button
        title={t.workout.idle.startButton}
        variant="primary"
        icon="arrow-forward"
        iconPosition="trailing"
        onPress={onStart}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  ctaArea: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 20,
  },
});
