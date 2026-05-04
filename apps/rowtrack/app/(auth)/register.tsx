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
import { Button, FormField, ErrorMessage } from '@/components';
import {
  background,
  brand,
  text as textColors,
  display,
  body,
  fontFamily,
  space,
  layout,
} from '@/constants';

export default function RegisterScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleRegister() {
    if (!email || !password || !confirmPassword) {
      setError('Vul alle velden in.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Wachtwoorden komen niet overeen.');
      return;
    }
    if (password.length < 6) {
      setError('Wachtwoord moet minstens 6 tekens zijn.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await signUp(email.trim(), password);
    } catch (e: any) {
      setError(e.message ?? 'Registratie mislukt.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.inner}>
        <Text style={styles.title}>Account aanmaken</Text>
        <Text style={styles.subtitle}>Begin met roeien</Text>

        <ErrorMessage message={error} />

        <FormField
          placeholder="E-mail"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
        />

        <FormField
          placeholder="Wachtwoord"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="new-password"
        />

        <FormField
          placeholder="Bevestig wachtwoord"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          autoComplete="new-password"
        />

        <Button
          title="Maak account"
          onPress={handleRegister}
          loading={loading}
          style={styles.button}
        />

        <Link href="/(auth)/login" asChild>
          <TouchableOpacity style={styles.linkContainer}>
            <Text style={styles.linkText}>
              Al een account?{' '}
              <Text style={styles.linkAccent}>Log in</Text>
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
    backgroundColor: background.base,
  },
  inner: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: layout.screenHorizontal,
    gap: space[4],
  },
  title: {
    ...display.md,
    color: brand.primary,
    textAlign: 'center',
  },
  subtitle: {
    ...body.md,
    color: textColors.secondary,
    textAlign: 'center',
    marginBottom: space[4],
  },
  button: {
    marginTop: space[2],
  },
  linkContainer: {
    alignItems: 'center',
    paddingVertical: space[2],
  },
  linkText: {
    ...body.sm,
    color: textColors.secondary,
  },
  linkAccent: {
    color: brand.primary,
    fontFamily: fontFamily.bodySemiBold,
  },
});
