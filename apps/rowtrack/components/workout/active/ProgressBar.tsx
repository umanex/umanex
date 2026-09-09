import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { buttonTokens, progressBar } from '@/constants';
import { variantData } from '@/lib/variantData';

/**
 * Hoe de fill getekend wordt. Duur- en afstandsdoelen vullen geleidelijk (gradient); split- en
 * wattdoelen zijn een momentopname en vullen vol in groen of oranje. `none` = geen doel, dan
 * staat er alleen de track.
 */
export type FillKind = 'none' | 'gradient' | 'success' | 'warning';

export type ProgressBarProps = {
  /** Voortgang 0–1. Boven 1 wordt geklemd; op 0 wordt er niets getekend. */
  fillPct: number;
  fillKind: FillKind;
  /** `h` = portrait, full-bleed tussen paneel en KPI-lijst. `v` = landscape, op de kolomscheiding. */
  richting: 'h' | 'v';
};

/**
 * De 4px voortgangsbalk van het active-scherm.
 *
 * Verticaal vult hij van ONDER naar boven (`justifyContent: 'flex-end'` op de track), zoals een
 * peilglas — bovenaan beginnen leest als leeglopen.
 *
 * De gradient krijgt zijn richting mee: horizontaal links→rechts, verticaal onder→boven, zodat
 * de donkere kant altijd aan de gevulde kant staat.
 */
export function ProgressBar({ fillPct, fillKind, richting }: ProgressBarProps) {
  const vertical = richting === 'v';
  const zichtbaar = fillKind !== 'none' && fillPct > 0;
  const maat = `${Math.min(fillPct * 100, 100)}%` as const;
  return (
    <View testID="ProgressBar" dataSet={variantData({ fillKind, richting })} style={vertical ? styles.barTrackV : styles.barTrackH}>
      {zichtbaar && (
        <View style={[vertical ? styles.barFillV : styles.barFillH, vertical ? { height: maat } : { width: maat }]}>
          {fillKind === 'gradient' ? (
            <LinearGradient
              colors={[buttonTokens.primary.gradientFrom, buttonTokens.primary.gradientTo]}
              start={vertical ? { x: 0, y: 1 } : { x: 0, y: 0 }}
              end={vertical ? { x: 0, y: 0 } : { x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
          ) : (
            <View
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: fillKind === 'success' ? progressBar.successFill : progressBar.warningFill },
              ]}
            />
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // Portrait: full-bleed 4px tussen hero-paneel en KPI-lijst.
  barTrackH: {
    alignSelf: 'stretch',
    height: 4,
    backgroundColor: progressBar.trackColor,
    overflow: 'hidden',
  },
  barFillH: {
    height: 4,
  },
  // Landscape: 4px op de kolomscheiding, vult onder→boven.
  barTrackV: {
    width: 4,
    alignSelf: 'stretch',
    backgroundColor: progressBar.trackColor,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  barFillV: {
    width: 4,
  },
});
