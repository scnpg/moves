import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { updateProfile } from '@/features/profile/api';
import { useLocale } from '@/i18n/LocaleProvider';
import { notify } from '@/lib/alerts';
import { hashPhone } from '@/lib/phone';
import { USERNAME_PATTERN } from '@/lib/username';
import { useAuth } from '@/providers/AuthProvider';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * Landing spot for accounts that skipped this app's own sign-up form -
 * currently that's Sign in with Apple (handle_new_user() gives them a
 * placeholder username like "user_1a2b3c4d" since there's no username
 * step before Apple hands back an identity token) - plus a username reset
 * forced by moderation. The root layout redirects here instead of
 * /(tabs) whenever the loaded profile still has a placeholder username -
 * see _layout.tsx and src/lib/username.ts. Also collects a phone number
 * when missing, since the normal sign-up form requires one
 * (20260826090100_require_phone_at_signup.sql) but an Apple sign-up has
 * no form step to collect it on - this is the one place that gap gets
 * closed for that path. Not shown at all if the profile already has one
 * (e.g. a moderation-forced username reset on an otherwise-complete
 * account shouldn't ask again).
 */
export default function CompleteProfileScreen() {
  const { session, profile, refreshProfile } = useAuth();
  const { t } = useLocale();
  const router = useRouter();
  const { colors, font } = useTheme();
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const needsPhone = !profile?.phone_hash;

  const handleSave = async () => {
    if (!session?.user) return;
    const normalized = username.trim().toLowerCase();
    if (!USERNAME_PATTERN.test(normalized)) {
      setUsernameError(t('auth.usernameHelp'));
      return;
    }
    setUsernameError(null);

    let phoneHash: string | null = null;
    if (needsPhone) {
      phoneHash = await hashPhone(phone);
      if (!phoneHash) {
        setPhoneError(t('profile.phoneTooShort'));
        return;
      }
    }
    setPhoneError(null);

    setSaving(true);
    try {
      await updateProfile(session.user.id, {
        username: normalized,
        display_name: displayName.trim() || normalized,
        ...(phoneHash ? { phone_hash: phoneHash } : {}),
      });
      await refreshProfile();
      router.replace('/(tabs)');
    } catch (err) {
      notify(t('completeProfile.couldNotSave'), err instanceof Error ? err.message : t('completeProfile.usernameTaken'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={[styles.title, { color: colors.textPrimary, fontFamily: font.family.bodySemibold }]}>
            {t('completeProfile.oneMoreThing')}
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary, fontFamily: font.family.bodyRegular }]}>
            {t('completeProfile.pickUsername', { name: profile?.display_name ?? t('completeProfile.welcome') })}
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
            <TextField label={t('auth.displayName')} value={displayName} onChangeText={setDisplayName} placeholder={t('auth.displayNamePlaceholder')} />
            {needsPhone ? (
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
            ) : null}
            <Button label={t('completeProfile.continueButton')} onPress={handleSave} loading={saving} size="lg" />
          </View>
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
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
  },
  form: {
    gap: 16,
  },
});
