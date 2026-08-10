import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { HoverPressable } from '@/components/HoverPressable';
import { Screen } from '@/components/Screen';
import { SegmentedControl } from '@/components/SegmentedControl';
import { SubHeader } from '@/components/SubHeader';
import { deleteAccount, signOut } from '@/features/auth/api';
import { LOCALE_LABELS, SUPPORTED_LOCALES, useLocale, type Locale } from '@/i18n/LocaleProvider';
import { confirmAction, notify } from '@/lib/alerts';
import { useAuth } from '@/providers/AuthProvider';
import { type ThemeMode, type TimeFormat, type UnitSystem, useTheme } from '@/theme/ThemeProvider';

const APPEARANCE_OPTIONS = ['light', 'dark', 'auto'] as const;

export default function SettingsScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const { t, locale, setLocale } = useLocale();
  const { colors, font, themeMode, setThemeMode, timeFormat, setTimeFormat, unitSystem, setUnitSystem } = useTheme();
  const [deleting, setDeleting] = useState(false);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (err) {
      notify(t('profile.signOutFailed'), err instanceof Error ? err.message : t('common.pleaseTryAgain'));
    }
  };

  const handleDeleteAccount = async () => {
    if (!session?.user) return;
    const confirmed = await confirmAction(
      t('profile.deleteAccountConfirmTitle'),
      t('profile.deleteAccountConfirmMessage'),
      t('profile.deleteAccount')
    );
    if (!confirmed) return;
    setDeleting(true);
    try {
      await deleteAccount(session.user.id);
    } catch (err) {
      notify(t('profile.couldNotDeleteAccount'), err instanceof Error ? err.message : t('common.pleaseTryAgain'));
      setDeleting(false);
    }
  };

  return (
    <Screen>
      <SubHeader title={t('settings.title')} onBack={handleBack} />
      <View style={styles.content}>
        <View style={styles.field}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted, fontFamily: font.family.monoBold }]}>{t('settings.appearance')}</Text>
          <SegmentedControl
            segments={[
              { value: 'light', label: t('settings.light') },
              { value: 'dark', label: t('settings.dark') },
              { value: 'auto', label: t('settings.auto') },
            ]}
            value={APPEARANCE_OPTIONS.includes(themeMode) ? themeMode : 'auto'}
            onChange={(v) => setThemeMode(v as ThemeMode)}
          />
        </View>

        <View style={styles.field}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted, fontFamily: font.family.monoBold }]}>{t('settings.timeFormat')}</Text>
          <SegmentedControl
            segments={[
              { value: '12h', label: t('settings.hour12') },
              { value: '24h', label: t('settings.hour24') },
            ]}
            value={timeFormat}
            onChange={(v) => setTimeFormat(v as TimeFormat)}
          />
        </View>

        <View style={styles.field}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted, fontFamily: font.family.monoBold }]}>{t('settings.units')}</Text>
          <SegmentedControl
            segments={[
              { value: 'imperial', label: t('settings.imperial') },
              { value: 'metric', label: t('settings.metric') },
            ]}
            value={unitSystem}
            onChange={(v) => setUnitSystem(v as UnitSystem)}
          />
        </View>

        <View style={styles.field}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted, fontFamily: font.family.monoBold }]}>{t('settings.language')}</Text>
          <SegmentedControl
            segments={SUPPORTED_LOCALES.map((loc) => ({ value: loc, label: LOCALE_LABELS[loc] }))}
            value={locale}
            onChange={(v) => setLocale(v as Locale)}
          />
        </View>

        <HoverPressable onPress={() => router.push('/blocked')}>
          <Card style={styles.row} raised={false}>
            <Text style={[styles.rowLabel, { color: colors.textPrimary, fontFamily: font.family.monoBold }]}>{t('settings.blockedUsers')}</Text>
            <Text style={[styles.chevron, { color: colors.textMuted }]}>›</Text>
          </Card>
        </HoverPressable>

        <View style={styles.footer}>
          <Button label={t('profile.signOut')} variant="ghost" onPress={handleSignOut} />
          <HoverPressable onPress={handleDeleteAccount} disabled={deleting} style={styles.deleteAccountWrap}>
            <Text style={[styles.deleteAccountText, { color: colors.danger, fontFamily: font.family.monoBold }]}>
              {deleting ? '···' : t('profile.deleteAccount')}
            </Text>
          </HoverPressable>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 16,
    paddingTop: 20,
    gap: 20,
  },
  field: {
    gap: 10,
  },
  sectionTitle: {
    fontSize: 10,
    letterSpacing: 0.9,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowLabel: {
    fontSize: 13,
    letterSpacing: 0.7,
  },
  chevron: {
    fontSize: 18,
  },
  footer: {
    gap: 16,
    marginTop: 8,
  },
  deleteAccountWrap: {
    alignSelf: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  deleteAccountText: {
    fontSize: 11,
    letterSpacing: 0.9,
  },
});
