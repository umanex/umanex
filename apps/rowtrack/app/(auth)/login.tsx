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

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!email || !password) {
      setError('Vul e-mail en wachtwoord in.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await signIn(email.trim(), password);
    } catch (e: any) {
      setError(e.message ?? 'Inloggen mislukt.');
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
        <Text style={styles.title}>RowTrack</Text>
        <Text style={styles.subtitle}>Log in om verder te gaan</Text>

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
          autoComplete="password"
        />

        <Button
          title="Log in"
          onPress={handleLogin}
          loading={loading}
          style={styles.button}
        />

        <Link href="/(auth)/register" asChild>
          <TouchableOpacity style={styles.linkContainer}>
            <Text style={styles.linkText}>
              Nog geen account?{' '}
              <Text style={styles.linkAccent}>Registreer</Text>
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
