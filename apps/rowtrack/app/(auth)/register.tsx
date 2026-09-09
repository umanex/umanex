import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Link } from 'expo-router';
import { signUp } from '@/lib/auth';
import {
  isValidEmail,
  isValidPassword,
  MIN_PASSWORD_LENGTH,
  emailFieldError,
  passwordFieldError,
  confirmFieldError,
} from '@/lib/validation';
import { Button, FormField, ErrorMessage } from '@/components';
import { t } from '@/i18n';
import { bg, fg, accent, typeStyles, space, layout } from '@/constants';

export default function RegisterScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [touched, setTouched] = useState({ email: false, password: false, confirm: false });
  const [submitError, setSubmitError] = useState('');
  const [loading, setLoading] = useState(false);

  const emailError = emailFieldError(email, touched.email);
  const passwordError = passwordFieldError(password, touched.password, true);
  const confirmError = confirmFieldError(confirmPassword, password, touched.confirm);

  const canSubmit =
    isValidEmail(email) &&
    isValidPassword(password) &&
    confirmPassword.length > 0 &&
    confirmPassword === password &&
    !loading;

  async function handleRegister() {
    if (!canSubmit) return;
    setSubmitError('');
    setLoading(true);
    try {
      await signUp(email.trim(), password);
    } catch (e: any) {
      // Neutrale foutmelding voor een reeds-bestaand adres — de rauwe Supabase-
      // melding ("User already registered") verraadt anders of een account bestaat
      // (user enumeration, security-audit P2-7).
      const code = String(e?.code ?? '');
      const raw = String(e?.message ?? '');
      const revealsExisting =
        code === 'user_already_exists' || /already registered|already exists/i.test(raw);
      setSubmitError(
        revealsExisting ? t.auth.register.failedNeutral : raw || t.auth.register.failed,
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      testID="RegisterScreen"
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.inner}>
        <Text style={styles.title}>{t.auth.register.title}</Text>
        <Text style={styles.subtitle}>{t.auth.register.subtitle}</Text>

        <ErrorMessage message={submitError} />

        <FormField
          label={t.auth.emailLabel}
          placeholder={t.auth.emailPlaceholder}
          value={email}
          onChangeText={setEmail}
          onBlur={() => setTouched((t) => ({ ...t, email: true }))}
          error={emailError}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          autoCorrect={false}
        />

        <FormField
          label={t.auth.passwordLabel}
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
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          onBlur={() => setTouched((t) => ({ ...t, confirm: true }))}
          error={confirmError}
          secureTextEntry
          autoComplete="new-password"
        />

        <Button
          title={t.auth.register.button}
          onPress={handleRegister}
          disabled={!canSubmit}
          loading={loading}
          style={styles.button}
        />

        <Link href="/(auth)/login" asChild>
          <TouchableOpacity style={styles.linkContainer}>
            <Text style={styles.linkText}>
              {t.auth.register.haveAccount}{' '}
              <Text style={styles.linkAccent}>{t.auth.register.loginLink}</Text>
            </Text>
          </TouchableOpacity>
        </Link>
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
  title: {
    ...typeStyles.heroDisplay,
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
