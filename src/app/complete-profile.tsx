import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { updateProfile } from '@/features/profile/api';
import { useLocale } from '@/i18n/LocaleProvider';
import { notify } from '@/lib/alerts';
import { USERNAME_PATTERN } from '@/lib/username';
import { useAuth } from '@/providers/AuthProvider';
import { color, font, spacing } from '@/theme/tokens';

/**
 * Landing spot for accounts created with no username - currently only
 * phone-first signups (handle_new_user() gives them a placeholder like
 * "user_1a2b3c4d"). The root layout redirects here instead of /(tabs)
 * whenever the loaded profile still has a placeholder username - see
 * _layout.tsx and src/lib/username.ts.
 */
export default function CompleteProfileScreen() {
  const { session, profile, refreshProfile } = useAuth();
  const { t } = useLocale();
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!session?.user) return;
    const normalized = username.trim().toLowerCase();
    if (!USERNAME_PATTERN.test(normalized)) {
      setUsernameError(t('auth.usernameHelp'));
      return;
    }
    setUsernameError(null);
    setSaving(true);
    try {
      await updateProfile(session.user.id, {
        username: normalized,
        display_name: displayName.trim() || normalized,
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
          <Text style={styles.title}>{t('completeProfile.oneMoreThing')}</Text>
          <Text style={styles.subtitle}>
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
            <Button label={t('completeProfile.continueButton')} onPress={handleSave} loading={saving} />
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
    padding: spacing.lg,
    gap: spacing.lg,
  },
  title: {
    fontSize: font.size.xl,
    fontWeight: font.weight.heavy,
    color: color.textPrimary,
    textAlign: 'center',
  },
  subtitle: {
    color: color.textSecondary,
    fontSize: font.size.sm,
    textAlign: 'center',
  },
  form: {
    gap: spacing.md,
  },
});
