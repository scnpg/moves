import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Link } from 'expo-router';

import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { signIn } from '@/features/auth/api';
import { color, font, spacing } from '@/theme/tokens';

export default function SignInScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignIn = async () => {
    if (!email || !password) return;
    setLoading(true);
    try {
      await signIn({ email: email.trim(), password });
    } catch (err) {
      Alert.alert('Sign in failed', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Moves?</Text>
          <Text style={styles.subtitle}>Spontaneous hangouts, privately.</Text>

          <View style={styles.form}>
            <TextField
              label="Email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="you@example.com"
            />
            <TextField
              label="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="••••••••"
            />
            <Button label="Sign in" onPress={handleSignIn} loading={loading} />
          </View>

          <Link href="/(auth)/sign-up" style={styles.link}>
            <Text style={styles.linkText}>
              New here? <Text style={styles.linkTextStrong}>Create an account</Text>
            </Text>
          </Link>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.lg,
  },
  title: {
    fontSize: font.size.xxl,
    fontWeight: font.weight.bold,
    color: color.textPrimary,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: font.size.md,
    color: color.textSecondary,
    textAlign: 'center',
    marginTop: -spacing.md,
  },
  form: {
    gap: spacing.md,
  },
  link: {
    alignSelf: 'center',
    marginTop: spacing.sm,
  },
  linkText: {
    color: color.textSecondary,
    fontSize: font.size.sm,
  },
  linkTextStrong: {
    color: color.brand,
    fontWeight: font.weight.semibold,
  },
});
