import { View, Text, StyleSheet } from 'react-native';
import { achievement, fontSize, neutral, radii, space, typeStyles } from '@/constants';
import { t } from '@/i18n';

export type PrBadgeProps = {
  /** Tekst naast de medaille. Leeg laten voor de kale 'PR'-badge. */
  label?: string | null;
  /**
   * `md` (default) is de badge uit de detail-header en de samenvatting.
   * `sm` staat in een archiefrij en heeft daarom géén verticale padding: de datumregel
   * eronder heeft lineHeight 13.75, en elke extra pixel zou élke rij hoger maken —
   * ook de rijen zonder record.
   */
  size?: 'sm' | 'md';
};

/**
 * De 🏅-badge van een persoonlijk record. Stond eerst inline in het detailscherm; sinds
 * de samenvatting en de archiefrij hem ook tonen is dit de gedeelde bron.
 */
export const PrBadge = ({ label, size = 'md' }: PrBadgeProps) => {
  const small = size === 'sm';
  return (
    // Eén a11y-stop in plaats van twee: zonder dit leest VoiceOver 'sports medal' en
    // daarna los de tekst. Binnen een Pressable (de archiefrij) wordt deze View genegeerd,
    // dus dit botst niet met het rij-label.
    <View
      testID="PrBadge"
      accessible
      accessibilityLabel={label != null ? `${t.pr.a11yPlain}: ${label}` : t.pr.a11yPlain}
      style={[styles.badge, small && styles.badgeSm]}
    >
      <Text style={[styles.emoji, small && styles.emojiSm]}>🏅</Text>
      <Text style={small ? styles.textSm : styles.text} numberOfLines={1}>
        {label ?? t.pr.badge}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space['4'],
    backgroundColor: achievement.default,
    borderRadius: radii.full,
    paddingHorizontal: space['10'],
    paddingTop: space['4'],
    paddingBottom: space['2'],
  },
  badgeSm: {
    gap: space['2'],
    paddingHorizontal: space['6'],
    paddingTop: 0,
    paddingBottom: 0,
    // De rij mag niet meegroeien met de badge, en hij mag ook niet meekrimpen met een
    // lange datum ernaast.
    flexShrink: 0,
  },
  emoji: {
    fontSize: fontSize['12'],
  },
  emojiSm: {
    fontSize: fontSize['9'],
    // Vastgezet op de regelhoogte van de datum ernaast (labelGoalPrefix, 13.75). Zonder
    // dit anker hangt de badge-hoogte aan de fontmetrics van Albert Sans en van de
    // emoji-font, en dan verhoogt één iOS-update of één extra padding élke rij in de lijst.
    lineHeight: typeStyles.labelGoalPrefix.lineHeight,
  },
  text: {
    ...typeStyles.italicConnector,
    color: neutral['600'],
  },
  textSm: {
    ...typeStyles.labelMicro,
    lineHeight: typeStyles.labelGoalPrefix.lineHeight,
    color: neutral['600'],
  },
});
