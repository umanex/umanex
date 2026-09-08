import { useState } from 'react';
import { Modal, View, Text, ScrollView, StyleSheet, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/Button';
import { t } from '@/i18n';
import { PRIVACY_POLICY_URL } from '@/lib/links';
import {
  bg,
  fg,
  accent,
  status,
  typeStyles,
  fontFamily,
  fontSize,
  space,
} from '@/constants';

type Props = {
  visible: boolean;
  onGrant: () => Promise<boolean>;
  onDecline: () => Promise<boolean>;
};

/**
 * Vraagt uitdrukkelijke toestemming vóór de app hartslag- en lichaamsgegevens
 * verwerkt (AVG art. 9.2.a).
 *
 * Twee dingen die de vorm bepalen, niet de smaak:
 * — De keuzes zijn visueel gelijkwaardig. Een grote groene "ja" naast een grijs
 *   linkje stuurt de keuze, en een gestuurde keuze is niet vrij gegeven.
 * — Er staat niets voorgevinkt, en de app blijft zonder toestemming volledig
 *   bruikbaar. Toestemming die de voorwaarde is om de app te gebruiken, telt niet.
 */
export const HealthConsentScreen = ({ visible, onGrant, onDecline }: Props) => {
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState<'grant' | 'decline' | null>(null);
  const [failed, setFailed] = useState(false);

  async function choose(which: 'grant' | 'decline') {
    if (busy) return;
    setFailed(false);
    setBusy(which);
    const ok = which === 'grant' ? await onGrant() : await onDecline();
    if (!ok) {
      // Blijf staan. Doorlaten na een mislukte opslag zou betekenen dat de app
      // verdergaat zonder dat de keuze ergens vastligt.
      setFailed(true);
      setBusy(null);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent>
      <View testID="HealthConsentScreen" style={[styles.screen, { paddingTop: insets.top + space['24'] }]}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.title}>{t.consent.title}</Text>
          <Text style={styles.intro}>{t.consent.intro}</Text>

          <View style={styles.list}>
            {t.consent.items.map((item) => (
              <View key={item} style={styles.listItem}>
                <View style={styles.bullet} />
                <Text style={styles.listText}>{item}</Text>
              </View>
            ))}
          </View>

          <Text style={styles.body}>{t.consent.why}</Text>
          <Text style={styles.body}>{t.consent.optional}</Text>
          <Text style={styles.body}>{t.consent.withdraw}</Text>

          <Text
            style={styles.link}
            onPress={() => Linking.openURL(PRIVACY_POLICY_URL)}
            accessibilityRole="link"
          >
            {t.consent.readPolicy}
          </Text>

          {failed ? <Text style={styles.error}>{t.consent.saveFailed}</Text> : null}
        </ScrollView>

        <View style={[styles.actions, { paddingBottom: insets.bottom + space['20'] }]}>
          <Button
            title={t.consent.accept}
            onPress={() => choose('grant')}
            variant="primary"
            size="lg"
            loading={busy === 'grant'}
            disabled={busy !== null}
          />
          <Button
            title={t.consent.decline}
            onPress={() => choose('decline')}
            variant="outline"
            size="lg"
            loading={busy === 'decline'}
            disabled={busy !== null}
          />
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: bg.base,
    paddingHorizontal: space['20'],
  },
  content: {
    paddingBottom: space['24'],
    gap: space['16'],
  },
  title: {
    ...typeStyles.sectionValue,
    color: fg.primary,
  },
  intro: {
    fontFamily: fontFamily.albertSansRegular,
    fontSize: fontSize['16'],
    color: fg.secondary,
  },
  list: {
    gap: space['8'],
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space['12'],
  },
  bullet: {
    width: space['4'],
    height: space['4'],
    borderRadius: space['4'],
    backgroundColor: accent.default,
    marginTop: space['8'],
  },
  listText: {
    flex: 1,
    fontFamily: fontFamily.albertSansRegular,
    fontSize: fontSize['15'],
    color: fg.primary,
  },
  body: {
    fontFamily: fontFamily.albertSansRegular,
    fontSize: fontSize['15'],
    color: fg.secondary,
  },
  link: {
    fontFamily: fontFamily.albertSansSemiBold,
    fontSize: fontSize['15'],
    color: accent.default,
    textDecorationLine: 'underline',
  },
  error: {
    fontFamily: fontFamily.albertSansRegular,
    fontSize: fontSize['14'],
    color: status.error,
  },
  actions: {
    gap: space['12'],
    paddingTop: space['16'],
  },
});
