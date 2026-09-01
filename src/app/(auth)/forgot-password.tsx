import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Link } from 'expo-router';

import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { requestPasswordReset } from '@/features/auth/api';
import { useLocale } from '@/i18n/LocaleProvider';
import { notify } from '@/lib/alerts';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * Requests the reset email - never reveals whether the address actually
 * has an account (see requestPasswordReset()), so the "check your email"
 * state shows unconditionally on a successful request, same as it would
 * for an address that doesn't exist.
 */
export default function ForgotPasswordScreen() {
  const { t } = useLocale();
  const { colors, font } = useTheme();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async () => {
    const trimmed = email.trim();
    if (!trimmed) return;
    setLoading(true);
    try {
      await requestPasswordReset(trimmed);
      setSent(true);
    } catch (err) {
      notify(t('auth.resetLinkFailed'), err instanceof Error ? err.message : t('auth.pleaseTryAgain'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={[styles.title, { color: colors.textPrimary, fontFamily: font.family.bodySemibold }]}>
            {t('auth.forgotPasswordTitle')}
          </Text>

          {sent ? (
            <Text style={[styles.body, { color: colors.textSecondary, fontFamily: font.family.bodyRegular }]}>
              {t('auth.resetLinkSentMessage')}
            </Text>
          ) : (
            <>
              <Text style={[styles.body, { color: colors.textSecondary, fontFamily: font.family.bodyRegular }]}>
                {t('auth.forgotPasswordBody')}
              </Text>
              <View style={styles.form}>
                <TextField
                  label={t('auth.email')}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  placeholder={t('auth.emailPlaceholder')}
                />
                <Button label={t('auth.sendResetLink')} onPress={handleSubmit} loading={loading} size="lg" />
              </View>
            </>
          )}

          <Link href="/(auth)/sign-in" style={styles.link}>
            <Text style={[styles.linkText, { color: colors.textSecondary, fontFamily: font.family.bodyRegular }]}>
              {t('auth.backToSignIn')}
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
    gap: 20,
  },
  title: {
    fontSize: 22,
    lineHeight: 26,
    textAlign: 'center',
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  form: {
    gap: 16,
  },
  link: {
    alignSelf: 'center',
    marginTop: 8,
  },
  linkText: {
    fontSize: 14,
    textDecorationLine: 'underline',
  },
});
