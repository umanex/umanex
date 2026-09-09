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
import { signIn } from '@/lib/auth';
import { isValidEmail, emailFieldError, passwordFieldError } from '@/lib/validation';
import { Button, FormField, ErrorMessage } from '@/components';
import { t } from '@/i18n';
import { bg, fg, accent, typeStyles, space, layout } from '@/constants';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [touched, setTouched] = useState({ email: false, password: false });
  const [submitError, setSubmitError] = useState('');
  const [loading, setLoading] = useState(false);

  const emailError = emailFieldError(email, touched.email);
  const passwordError = passwordFieldError(password, touched.password);

  const canSubmit = isValidEmail(email) && password.length > 0 && !loading;

  async function handleLogin() {
    if (!canSubmit) return;
    setSubmitError('');
    setLoading(true);
    try {
      await signIn(email.trim(), password);
    } catch (e: any) {
      setSubmitError(e.message ?? t.auth.login.failed);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      testID="LoginScreen"
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.inner}>
        <Text style={styles.title}>RowTrack</Text>
        <Text style={styles.subtitle}>{t.auth.login.subtitle}</Text>

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
          value={password}
          onChangeText={setPassword}
          onBlur={() => setTouched((t) => ({ ...t, password: true }))}
          error={passwordError}
          secureTextEntry
          autoComplete="password"
        />

        <Link href="/(auth)/forgot-password" asChild>
          <TouchableOpacity style={styles.forgot} accessibilityRole="link">
            <Text style={styles.forgotText}>{t.auth.login.forgotPassword}</Text>
          </TouchableOpacity>
        </Link>

        <Button
          title={t.auth.login.button}
          onPress={handleLogin}
          disabled={!canSubmit}
          loading={loading}
          style={styles.button}
        />

        <Link href="/(auth)/register" asChild>
          <TouchableOpacity style={styles.linkContainer}>
            <Text style={styles.linkText}>
              {t.auth.login.noAccount}{' '}
              <Text style={styles.linkAccent}>{t.auth.login.registerLink}</Text>
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
    color: accent.default,
    textAlign: 'center',
  },
  subtitle: {
    ...typeStyles.italicConnector,
    color: fg.secondary,
    textAlign: 'center',
    marginBottom: space['8'],
  },
  forgot: {
    alignSelf: 'flex-end',
    marginTop: -space['8'],
  },
  forgotText: {
    ...typeStyles.textLink,
    color: accent.default,
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
