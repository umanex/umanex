import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { bg, radii } from '@/constants';

/**
 * Een blok ter grootte van wat er straks komt te staan.
 *
 * Bewust een wrapper om het echte component heen in plaats van een `<Skeleton
 * width={140} height={41} />`. Elke expliciete afmeting zou een hardgecodeerde
 * pixelwaarde zijn — de spacing-schaal loopt tot 48 en er is geen maatschaal voor
 * "zo groot als een doelkaart". Door het echte kind onzichtbaar mee te renderen komt
 * de afmeting uit de layout zelf en blijft alles token-schoon.
 *
 * Voor de screenreader bestaat dit niet: er valt niets voor te lezen, en het kind is
 * placeholder-tekst die je niet wil horen.
 */

export type SkeletonProps = {
  /** Wat er straks staat — wordt onzichtbaar gerenderd, puur om de maat te bepalen. */
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function Skeleton({ children, style }: SkeletonProps) {
  return (
    <View
      testID="Skeleton"
      style={[styles.block, style]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View style={styles.ghost}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    // Geen skeleton-rol in de tokens; `bg.raised` is de verhoogde-oppervlak-rol en
    // leest op `bg.base` als een placeholder-vlak. Zie de PR — een eigen rol
    // (in beide mode-sets) is een tokenkeuze voor Jeroen, geen literal voor mij.
    backgroundColor: bg.raised,
    borderRadius: radii.xs,
    overflow: 'hidden',
  },
  ghost: { opacity: 0 },
});
