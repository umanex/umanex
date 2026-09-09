import { useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { completePasswordReset } from '@/lib/auth';
import {
  passwordFieldError,
  confirmFieldError,
  isValidPassword,
  MIN_PASSWORD_LENGTH,
} from '@/lib/validation';
import { useDeepLink } from '@/lib/recovery-link';
import { Button, FormField, ErrorMessage } from '@/components';
import { t } from '@/i18n';
import { bg, fg, accent, typeStyles, space, layout } from '@/constants';

type RecoveryTokens = { access_token: string; refresh_token: string };

/** Haalt de recovery-tokens uit de deep-link. Supabase's implicit flow zet ze
 *  in de URL-fragment (#…); een query (?…) wordt als fallback ondersteund.
 *  `type` moet 'recovery' zijn — magiclink/signup-tokens worden geweigerd. */
function parseRecoveryTokens(url: string | null): RecoveryTokens | null {
  if (!url) return null;
  const fragment = url.includes('#') ? url.split('#')[1] : '';
  const query = url.includes('?') ? url.split('?')[1].split('#')[0] : '';
  const params = new URLSearchParams(fragment || query);
  const access_token = params.get('access_token');
  const refresh_token = params.get('refresh_token');
  const type = params.get('type');
  if (access_token && refresh_token && type === 'recovery') {
    return { access_token, refresh_token };
  }
  return null;
}

export default function ResetPasswordScreen() {
  const router = useRouter();
  const { url, resolved } = useDeepLink();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [touched, setTouched] = useState({ password: false, confirm: false });
  const [submitError, setSubmitError] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const tokens = useMemo(() => parseRecoveryTokens(url), [url]);

  const passwordError = passwordFieldError(password, touched.password, true);
  const confirmError = confirmFieldError(confirm, password, touched.confirm);

  const canSubmit =
    isValidPassword(password) && confirm.length > 0 && confirm === password && !saving;

  async function handleSave() {
    if (!canSubmit || !tokens) return;
    setSubmitError('');
    setSaving(true);
    try {
      await completePasswordReset(tokens, password);
      setDone(true);
    } catch (e: any) {
      setSubmitError(e.message ?? t.auth.reset.failed);
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView
      testID="ResetPasswordScreen"
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.inner}>
        {!resolved ? (
          <ActivityIndicator color={accent.default} />
        ) : done ? (
          <>
            <Ionicons name="checkmark-circle-outline" size={48} color={accent.default} style={styles.icon} />
            <Text style={styles.title}>{t.auth.reset.doneTitle}</Text>
            <Text style={styles.subtitle}>{t.auth.reset.doneBody}</Text>
            <Button
              title={t.auth.reset.toLogin}
              onPress={() => router.replace('/(auth)/login')}
              style={styles.button}
            />
          </>
        ) : !tokens ? (
          <>
            <Ionicons name="alert-circle-outline" size={48} color={accent.default} style={styles.icon} />
            <Text style={styles.title}>{t.auth.reset.invalidTitle}</Text>
            <Text style={styles.subtitle}>{t.auth.reset.invalidBody}</Text>
            <Link href="/(auth)/forgot-password" asChild>
              <TouchableOpacity style={styles.linkContainer}>
                <Text style={styles.linkText}>
                  <Text style={styles.linkAccent}>{t.auth.reset.requestNewLink}</Text>
                </Text>
              </TouchableOpacity>
            </Link>
          </>
        ) : (
          <>
            <Text style={styles.title}>{t.auth.reset.title}</Text>
            <Text style={styles.subtitle}>{t.auth.reset.subtitle}</Text>

            <ErrorMessage message={submitError} />

            <FormField
              label={t.auth.reset.newPasswordLabel}
              placeholder={t.validation.passwordMinLength(MIN_PASSWORD_LENGTH)}
              value={password}
              onChangeText={setPassword}
              onBlur={() => setTouched((t) => ({ ...t, password: true }))}
              error={passwordError}
              secureTextEntry
              autoComplete="new-password"
            />

            <FormField
              label={t.auth.confirmPasswordLabel}
              value={confirm}
              onChangeText={setConfirm}
              onBlur={() => setTouched((t) => ({ ...t, confirm: true }))}
              error={confirmError}
              secureTextEntry
              autoComplete="new-password"
            />

            <Button
              title={t.auth.reset.button}
              onPress={handleSave}
              disabled={!canSubmit}
              loading={saving}
              style={styles.button}
            />
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: bg.base,
  },
  inner: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: layout.screenHorizontal,
    gap: space['16'],
  },
  icon: {
    alignSelf: 'center',
    marginBottom: space['8'],
  },
  title: {
    ...typeStyles.sectionValue,
    color: fg.primary,
    textAlign: 'center',
  },
  subtitle: {
    ...typeStyles.italicConnector,
    color: fg.secondary,
    textAlign: 'center',
    marginBottom: space['8'],
  },
  button: {
    marginTop: space['8'],
  },
  linkContainer: {
    alignItems: 'center',
    paddingVertical: space['8'],
  },
  linkText: {
    ...typeStyles.textLink,
    color: fg.secondary,
    textAlign: 'center',
  },
  linkAccent: {
    color: accent.default,
  },
});
