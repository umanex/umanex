import { View, Text, StyleSheet } from 'react-native';
import { fg, space, typeStyles } from '@/constants';

export type SummaryTitleProps = {
  title: string;
  /**
   * De datumregel, AL GEFORMATTEERD. Dit component leest de klok niet: een node waarvan de
   * inhoud van `new Date()` komt, verschilt tussen twee metingen en is daarmee door geen
   * enkele statische vergelijking te toetsen (gemeten 2026-09-08 —
   * `figma/niet-reproduceerbaar.json` moest hem uitsluiten). Als prop zet de story er een
   * vaste waarde in en is de node weer meetbaar.
   */
  dateLabel: string;
  /** Safe-area top; de rest van de padding zit in de stijl. */
  paddingTop: number;
};

/** De kop van de samenvatting: titel met de datumregel eronder, in kapitalen. */
export function SummaryTitle({ title, dateLabel, paddingTop }: SummaryTitleProps) {
  return (
    <View testID="SummaryTitle" style={[styles.titleBlock, { paddingTop }]}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.dateText}>{dateLabel}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  titleBlock: {
    paddingHorizontal: space['20'],
    // paddingTop komt van buiten (safe-area top)
  },
  title: {
    ...typeStyles.sectionValue,
    color: fg.primary,
  },
  dateText: {
    ...typeStyles.labelGoalPrefix,
    color: fg.secondary,
    textTransform: 'uppercase',
  },
});
