import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Link } from 'expo-router';

import { Button } from '@/components/Button';
import { PhoneAuth } from '@/components/PhoneAuth';
import { Screen } from '@/components/Screen';
import { SegmentedControl } from '@/components/SegmentedControl';
import { SunburstBackdrop } from '@/components/Streamline';
import { TextField } from '@/components/TextField';
import { signIn } from '@/features/auth/api';
import { useLocale } from '@/i18n/LocaleProvider';
import { notify } from '@/lib/alerts';
import { color, font, spacing } from '@/theme/tokens';

type AuthMethod = 'email' | 'phone';

export default function SignInScreen() {
  const { t } = useLocale();
  const [method, setMethod] = useState<AuthMethod>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignIn = async () => {
    if (!email || !password) return;
    setLoading(true);
    try {
      await signIn({ email: email.trim(), password });
    } catch (err) {
      notify(t('auth.signInFailed'), err instanceof Error ? err.message : t('auth.pleaseTryAgain'));
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
          <View style={styles.logoWrap}>
            <SunburstBackdrop />
            <Text style={styles.title}>MOVES?</Text>
          </View>

          <SegmentedControl
            segments={[
              { value: 'email', label: t('auth.email') },
              { value: 'phone', label: t('auth.phone') },
            ]}
            value={method}
            onChange={setMethod}
          />

          {method === 'email' ? (
            <View style={styles.form}>
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
                placeholder={t('auth.passwordPlaceholder')}
              />
              <Button label={t('auth.signIn')} onPress={handleSignIn} loading={loading} />
            </View>
          ) : (
            <PhoneAuth onDone={() => {}} />
          )}

          <Link href="/(auth)/sign-up" style={styles.link}>
            <Text style={styles.linkText}>
              {t('auth.newHere')} <Text style={styles.linkTextStrong}>{t('auth.createAccount')}</Text>
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
  logoWrap: {
    alignItems: 'center',
  },
  title: {
    fontFamily: font.family.logo,
    fontSize: font.size.hero + 12,
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
