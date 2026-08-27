import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';

import { Button } from '@/components/Button';
import { Checkbox } from '@/components/Checkbox';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { signUp } from '@/features/auth/api';
import { useLocale } from '@/i18n/LocaleProvider';
import { notify } from '@/lib/alerts';
import { hashPhone } from '@/lib/phone';
import { USERNAME_PATTERN } from '@/lib/username';
import { useTheme } from '@/theme/ThemeProvider';

export default function SignUpScreen() {
  const { t } = useLocale();
  const router = useRouter();
  const { colors, font } = useTheme();
  const { ref: referredBy } = useLocalSearchParams<{ ref?: string }>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [agreed, setAgreed] = useState(false);

  const handleSignUp = async () => {
    const normalizedUsername = username.trim().toLowerCase();
    if (!USERNAME_PATTERN.test(normalizedUsername)) {
      setUsernameError(t('auth.usernameHelp'));
      return;
    }
    setUsernameError(null);

    const phoneHash = await hashPhone(phone);
    if (!phoneHash) {
      setPhoneError(t('profile.phoneTooShort'));
      return;
    }
    setPhoneError(null);

    if (!email || !password) return;

    if (!agreed) {
      notify(t('auth.mustAgreeTitle'), t('auth.mustAgreeMessage'));
      return;
    }

    setLoading(true);
    try {
      const { signedIn } = await signUp({
        email: email.trim(),
        password,
        username: normalizedUsername,
        displayName: displayName.trim() || normalizedUsername,
        phoneHash,
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
          <Text style={[styles.title, { color: colors.textPrimary, fontFamily: font.family.bodySemibold }]}>
            {t('auth.createYourAccount')}
          </Text>

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
              label={t('auth.phoneLabel')}
              required
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              placeholder={t('profile.phoneFindPlaceholder')}
              error={phoneError}
              hint={t('profile.phoneHelp')}
            />
            <TextField
              label={t('auth.password')}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder={t('auth.passwordMinPlaceholder')}
            />
            <Button label={t('auth.signUp')} onPress={handleSignUp} loading={loading} size="lg" />
          </View>

          <Text style={[styles.legalText, { color: colors.textMuted, fontFamily: font.family.bodyRegular }]}>
            {t('auth.legalPrefix')}{' '}
            <Link href="/terms">
              <Text style={[styles.legalLink, { color: colors.textSecondary }]}>{t('auth.termsOfService')}</Text>
            </Link>{' '}
            {t('auth.legalAnd')}{' '}
            <Link href="/privacy">
              <Text style={[styles.legalLink, { color: colors.textSecondary }]}>{t('auth.privacyPolicy')}</Text>
            </Link>
            .
          </Text>

          <Checkbox checked={agreed} onToggle={() => setAgreed((a) => !a)}>
            {t('auth.ageConfirmAgree')}{' '}
            <Text style={[styles.boldText, { color: colors.textPrimary, fontFamily: font.family.bodySemibold }]}>
              {t('auth.ageConfirmAge')}
            </Text>
          </Checkbox>

          <Link href="/(auth)/sign-in" style={styles.link}>
            <Text style={[styles.linkText, { color: colors.textSecondary, fontFamily: font.family.bodyRegular }]}>
              {t('auth.alreadyHaveAccount')}{' '}
              <Text style={[styles.linkTextStrong, { color: colors.textPrimary, fontFamily: font.family.bodySemibold }]}>
                {t('auth.signIn')}
              </Text>
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
    padding: 24,
    gap: 24,
  },
  title: {
    fontSize: 22,
    lineHeight: 26,
    textAlign: 'center',
  },
  form: {
    gap: 16,
  },
  legalText: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  legalLink: {
    textDecorationLine: 'underline',
  },
  boldText: {},
  link: {
    alignSelf: 'center',
    marginTop: 8,
  },
  linkText: {
    fontSize: 14,
  },
  linkTextStrong: {
    textDecorationLine: 'underline',
  },
});
