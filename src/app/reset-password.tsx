import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { confirmPasswordReset } from '@/features/auth/api';
import { useLocale } from '@/i18n/LocaleProvider';
import { notify } from '@/lib/alerts';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/theme/ThemeProvider';

const MIN_PASSWORD_LENGTH = 8;

type Status = 'verifying' | 'ready' | 'invalid';

/**
 * Landing spot for the "forgot password" email's link. The Supabase
 * client has detectSessionInUrl disabled app-wide (see src/lib/
 * supabase.ts - it's meant for a browser context this RN app doesn't
 * reliably have), so the recovery tokens Supabase appends to this URL's
 * hash have to be picked up and exchanged for a session by hand here,
 * rather than happening automatically on load.
 */
export default function ResetPasswordScreen() {
  const { t } = useLocale();
  const router = useRouter();
  const { colors, font } = useTheme();
  const [status, setStatus] = useState<Status>('verifying');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') {
      setStatus('invalid');
      return;
    }
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    if (params.get('type') !== 'recovery' || !accessToken || !refreshToken) {
      setStatus('invalid');
      return;
    }
    supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken }).then(({ error }) => {
      setStatus(error ? 'invalid' : 'ready');
    });
  }, []);

  const handleSave = async () => {
    if (password.length < MIN_PASSWORD_LENGTH) {
      setPasswordError(t('auth.passwordTooShort'));
      return;
    }
    if (password !== confirmPassword) {
      setPasswordError(t('auth.passwordsDontMatch'));
      return;
    }
    setPasswordError(null);
    setSaving(true);
    try {
      await confirmPasswordReset(password);
      notify(t('auth.passwordResetDoneTitle'), t('auth.passwordResetDoneMessage'));
      router.replace('/(tabs)');
    } catch (err) {
      notify(t('auth.resetLinkFailed'), err instanceof Error ? err.message : t('auth.pleaseTryAgain'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={[styles.title, { color: colors.textPrimary, fontFamily: font.family.bodySemibold }]}>
            {t('auth.resetPasswordTitle')}
          </Text>

          {status === 'verifying' ? (
            <Text style={[styles.body, { color: colors.textSecondary, fontFamily: font.family.bodyRegular }]}>
              {t('auth.resetPasswordVerifying')}
            </Text>
          ) : status === 'invalid' ? (
            <Text style={[styles.body, { color: colors.textSecondary, fontFamily: font.family.bodyRegular }]}>
              {t('auth.resetLinkInvalid')}
            </Text>
          ) : (
            <View style={styles.form}>
              <TextField
                label={t('auth.newPassword')}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                placeholder={t('auth.passwordMinPlaceholder')}
                error={passwordError}
              />
              <TextField
                label={t('auth.confirmPassword')}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                placeholder={t('auth.passwordPlaceholder')}
              />
              <Button label={t('auth.setNewPassword')} onPress={handleSave} loading={saving} size="lg" />
            </View>
          )}
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
});
