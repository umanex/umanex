import { View, Text, StyleSheet } from 'react-native';
import { fg, fontFamily, fontSize, space } from '@/constants';

export type SubtitleProgressProps = {
  /** De verstreken waarde, links van de divider — "18:44" of "1 450 m". */
  left: string;
  /** Voortgang 0–1. Wordt naar beneden afgerond weergegeven als hele procenten. */
  pct: number;
};

/**
 * De subtitle-rij onder het hero-getal bij een duur- of afstandsdoel: verstreken waarde ·
 * divider · percentage.
 *
 * Twee gelijk-brede kolommen (`flex: 1`) met de linkerwaarde rechts- en de rechterwaarde
 * links-uitgelijnd. Zo groeien de cijfers naar buiten en blijft de 2px-divider statisch
 * gecentreerd terwijl de live-cijfers wisselen (Figma 391:2436). Zonder die spiegeling
 * schuift de divider mee met elke seconde.
 *
 * Het percentage rondt naar BENEDEN af: 99,7% mag geen "100%" tonen zolang het doel niet
 * gehaald is.
 */
export function SubtitleProgress({ left, pct }: SubtitleProgressProps) {
  return (
    <View testID="SubtitleProgress" style={styles.subtitleRow}>
      <Text style={[styles.subtitleText, styles.subtitleValueLeft]}>{left}</Text>
      <View style={styles.subtitleDivider} />
      <Text style={[styles.subtitleText, styles.subtitleValueRight]}>{`${Math.floor(pct * 100)}%`}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  subtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    gap: space['20'],
  },
  subtitleText: {
    fontFamily: fontFamily.albertSansLight,
    fontSize: fontSize['36'],
    letterSpacing: -0.9, // -2.5% van 36
    color: fg.primary,
  },
  // Linkerwaarde rechts-uitgelijnd, rechterwaarde links-uitgelijnd; elk flex:1 (gelijke
  // kolommen) zodat de divider ertussen statisch blijft bij wisselende cijfers.
  subtitleValueLeft: {
    flex: 1,
    textAlign: 'right',
  },
  subtitleValueRight: {
    flex: 1,
    textAlign: 'left',
  },
  subtitleDivider: {
    width: 2,
    height: 36,
    borderRadius: 8,
    backgroundColor: fg.tertiary,
  },
});
