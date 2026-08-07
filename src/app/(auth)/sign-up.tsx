import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';

import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { signUp } from '@/features/auth/api';
import { useLocale } from '@/i18n/LocaleProvider';
import { notify } from '@/lib/alerts';
import { USERNAME_PATTERN } from '@/lib/username';
import { color, font, spacing } from '@/theme/tokens';

export default function SignUpScreen() {
  const { t } = useLocale();
  const router = useRouter();
  const { ref: referredBy } = useLocalSearchParams<{ ref?: string }>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [usernameError, setUsernameError] = useState<string | null>(null);

  const handleSignUp = async () => {
    const normalizedUsername = username.trim().toLowerCase();
    if (!USERNAME_PATTERN.test(normalizedUsername)) {
      setUsernameError(t('auth.usernameHelp'));
      return;
    }
    setUsernameError(null);

    if (!email || !password) return;

    setLoading(true);
    try {
      const { signedIn } = await signUp({
        email: email.trim(),
        password,
        username: normalizedUsername,
        displayName: displayName.trim() || normalizedUsername,
        referredBy: referredBy || null,
      });
      // If confirmations are on, there's no session yet and the root
      // layout's redirect won't fire - send them to sign in ourselves.
      // If they're already signed in, the root layout handles navigation.
      if (!signedIn) {
        notify(t('auth.checkEmailTitle'), t('auth.checkEmailMessage'));
        router.replace('/(auth)/sign-in');
      }
    } catch (err) {
      notify(t('auth.signUpFailed'), err instanceof Error ? err.message : t('auth.pleaseTryAgain'));
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
          <Text style={styles.title}>{t('auth.createYourAccount')}</Text>

          <View style={styles.form}>
            <TextField
              label={t('auth.username')}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              placeholder={t('auth.usernamePlaceholder')}
              error={usernameError}
            />
            <TextField
              label={t('auth.displayName')}
              value={displayName}
              onChangeText={setDisplayName}
              placeholder={t('auth.displayNamePlaceholder')}
            />
            <TextField
              label={t('auth.email')}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder={t('auth.emailPlaceholder')}
            />
            <TextField
              label={t('auth.password')}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder={t('auth.passwordMinPlaceholder')}
            />
            <Button label={t('auth.signUp')} onPress={handleSignUp} loading={loading} />
          </View>

          <Link href="/(auth)/sign-in" style={styles.link}>
            <Text style={styles.linkText}>
              {t('auth.alreadyHaveAccount')} <Text style={styles.linkTextStrong}>{t('auth.signIn')}</Text>
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
    fontSize: font.size.xl,
    fontWeight: font.weight.heavy,
    color: color.textPrimary,
    textAlign: 'center',
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
    color: color.textPrimary,
    fontWeight: font.weight.heavy,
    textDecorationLine: 'underline',
  },
});
