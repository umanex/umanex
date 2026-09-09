import { View, Text, StyleSheet } from 'react-native';
import { GoalSegments, type GoalSegmentType } from '@/components/GoalSegments';
import { t } from '@/i18n';
import { fg, layout, typeStyles } from '@/constants';

export type GoalHeaderProps = {
  selectedSegment: GoalSegmentType;
  onChange: (type: GoalSegmentType) => void;
  /**
   * De volledige schermbreedte, uit `useWindowDimensions`. Niet af te leiden: de segmentenrij
   * moet full-bleed lopen terwijl de scroll-inhoud eromheen `layout.screenHorizontal` padding
   * draagt, dus hij krijgt een DEFINITE breedte plus een negatieve marge. Zonder een definite
   * breedte verdeelt de engine de segmenten niet gelijk.
   */
  screenWidth: number;
};

/** Het DOEL-kopje van het startscherm: sectielabel met de full-bleed segmentenrij eronder. */
export function GoalHeader({ selectedSegment, onChange, screenWidth }: GoalHeaderProps) {
  return (
    <View testID="GoalHeader" style={styles.doelHeader}>
      <Text style={styles.sectionLabel}>{t.workout.idle.goalLabel}</Text>
      <View style={{ width: screenWidth, marginLeft: -layout.screenHorizontal }}>
        <GoalSegments selected={selectedSegment} onChange={onChange} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  doelHeader: {
    gap: 8,
  },
  sectionLabel: {
    ...typeStyles.labelGoalPrefix,
    color: fg.tertiary,
  },
});
