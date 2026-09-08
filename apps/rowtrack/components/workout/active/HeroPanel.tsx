import { View, Text, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { bg, fg, fontFamily, fontSize, space, typeStyles } from '@/constants';
import { SubtitleProgress } from './SubtitleProgress';

/**
 * De subtitle onder het hero-getal, als DATA in plaats van als ReactNode.
 *
 * Waarom niet gewoon `ReactNode`: de coaching-zin (split/watt) en de kale waarde (geen doel)
 * dragen stijlen die alleen hier bestaan. Met een ReactNode-prop zou de story van dit component
 * die stijlen uit ActivePhase moeten halen — en dat is precies de import-richting die deze
 * snede opheft. Als data is HeroPanel zelfstandig testbaar.
 */
export type HeroSubtitle =
  | { kind: 'progress'; left: string; pct: number }
  | { kind: 'sentence'; text: string }
  | { kind: 'plain'; text: string };

export type HeroPanelProps = {
  /** Eyebrow boven het hero-getal, of `null` als er geen doel is dat het dubbelzinnig maakt. */
  heroLabel: string | null;
  /** Het hero-getal zelf. */
  heroText: string;
  /** Eyebrow boven de subtitle; `null` bij split/watt, waar de subtitle een zin is. */
  subLabel: string | null;
  subtitle: HeroSubtitle;
  /** Per oriëntatie: flex/stretch en de horizontale insets. */
  style?: StyleProp<ViewStyle>;
};

/**
 * Het hero-paneel van het active-scherm: eyebrow + hero-getal, dan eyebrow + subtitle.
 *
 * Gedeeld portrait/landscape (Figma Main KPI: gap 40 tussen de groepen, gap 8 binnen een
 * groep). Het paneel zelf draagt alleen `bg.elevated` en de centrering; flex en de
 * horizontale insets komen per oriëntatie mee via `style` — portrait vult de vrije ruimte,
 * landscape krijgt een gemeten halve breedte.
 *
 * De eyebrow-labels zijn niet decoratief: bij een doel telt de hero AF (resterend), en zonder
 * label leest dat als een oplopende waarde (audit F3).
 */
export function HeroPanel({ heroLabel, heroText, subLabel, subtitle, style }: HeroPanelProps) {
  return (
    <View testID="HeroPanel" style={[styles.heroPanel, style]}>
      <View style={styles.heroGroup}>
        {heroLabel != null && <Text style={styles.heroLabel}>{heroLabel}</Text>}
        <Text style={styles.heroText}>{heroText}</Text>
      </View>
      <View style={styles.heroGroup}>
        {subLabel != null && <Text style={styles.heroLabel}>{subLabel}</Text>}
        {subtitle.kind === 'progress'
          ? <SubtitleProgress left={subtitle.left} pct={subtitle.pct} />
          : subtitle.kind === 'sentence'
            ? <Text style={[styles.subtitleText, styles.subtitleSentence]}>{subtitle.text}</Text>
            : <Text style={styles.subtitleText}>{subtitle.text}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  heroPanel: {
    backgroundColor: bg.elevated,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space['40'],
  },
  // Hero- en subtitle-groep: eyebrow-label boven zijn waarde (Figma Frame 130/132, gap 8).
  heroGroup: {
    alignSelf: 'stretch', // vult het hero-paneel → subtitle-rij kan gelijk-brede kolommen maken
    alignItems: 'center',
    gap: space['8'],
  },
  // Eyebrow-label boven hero-getal én subtitle: Albert Sans SemiBold 16, 20% tracking, UPPER.
  heroLabel: {
    fontFamily: fontFamily.albertSansSemiBold,
    fontSize: fontSize['16'],
    letterSpacing: 3.2, // 20% van 16
    textTransform: 'uppercase',
    color: fg.onAccent,
  },
  heroText: {
    // Hero-cijfer via de heroNumeric-typeStyle (Albert Sans Bold 114, ls -5.13).
    // Token herbestemd in Tokens Studio 2026-07-14 (was Source Serif 96).
    ...typeStyles.heroNumeric,
    color: fg.onAccent,
  },
  subtitleText: {
    fontFamily: fontFamily.albertSansLight,
    fontSize: fontSize['36'],
    letterSpacing: -0.9, // -2.5% van 36
    color: fg.primary,
  },
  // Coaching-zin (split/watt-doel) alléén. Niet op `heroPanel`: dat paneel draagt het
  // 114px hero-getal, en een symmetrische inset van 40 knijpt "120:45" tot wrappen/krimpen.
  // Ook niet op `subtitleText` zelf: die stijl draagt óók de twee kolommen van de
  // progress-rij (duration/distance), waar padding de statische divider zou wegduwen.
  subtitleSentence: {
    paddingHorizontal: space['20'],
    textAlign: 'center',
  },
});
