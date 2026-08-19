import { useEffect, useState, type ReactNode } from 'react';
import { LayoutAnimation, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { HoverPressable } from '@/components/HoverPressable';
import { Screen } from '@/components/Screen';
import { SegmentedControl } from '@/components/SegmentedControl';
import { SubHeader } from '@/components/SubHeader';
import { Toggle } from '@/components/Toggle';
import { deleteAccount, signOut } from '@/features/auth/api';
import { getMyNotificationSettings, updateNotificationPref, type NotificationPrefs } from '@/features/settings/api';
import { LOCALE_LABELS, SUPPORTED_LOCALES, useLocale, type Locale } from '@/i18n/LocaleProvider';
import { confirmAction, notify } from '@/lib/alerts';
import { useAuth } from '@/providers/AuthProvider';
import { type ThemeMode, type TimeFormat, type UnitSystem, useTheme } from '@/theme/ThemeProvider';

const APPEARANCE_OPTIONS = ['light', 'dark', 'auto'] as const;

const NOTIFICATION_ROWS: { key: keyof NotificationPrefs; labelSuffix: string }[] = [
  { key: 'notify_close_friends_moves', labelSuffix: 'CloseFriends' },
  { key: 'notify_friend_moves', labelSuffix: 'Friends' },
  { key: 'notify_mutual_moves', labelSuffix: 'Mutuals' },
  { key: 'notify_public_moves', labelSuffix: 'Public' },
  { key: 'notify_group_chat', labelSuffix: 'GroupChat' },
];

type PreferenceKey = 'timeFormat' | 'units' | 'language';

/**
 * A tap-to-expand row for settings that get picked once and rarely
 * revisited (unlike Appearance/Notifications, which stay as always-visible
 * controls) - keeps three full-width segmented controls from stacking
 * before the reader even reaches Notifications.
 */
function PreferenceRow({
  label,
  value,
  expanded,
  onPress,
  isFirst,
  children,
}: {
  label: string;
  value: string;
  expanded: boolean;
  onPress: () => void;
  isFirst?: boolean;
  children: ReactNode;
}) {
  const { colors, border, font } = useTheme();

  return (
    <View>
      <HoverPressable
        onPress={onPress}
        style={[
          styles.prefRow,
          !isFirst && { borderTopWidth: border.soft.width, borderTopColor: border.soft.color },
        ]}
      >
        <Text style={[styles.prefRowLabel, { color: colors.textPrimary, fontFamily: font.family.bodyRegular }]}>{label}</Text>
        <View style={styles.prefRowRight}>
          <Text style={[styles.prefRowValue, { color: colors.textMuted, fontFamily: font.family.bodyRegular }]}>{value}</Text>
          <Text
            style={[
              styles.chevron,
              { color: colors.textMuted, transform: [{ rotate: expanded ? '90deg' : '0deg' }] },
            ]}
          >
            ›
          </Text>
        </View>
      </HoverPressable>
      {expanded ? (
        <View style={[styles.prefPanel, { borderTopWidth: border.soft.width, borderTopColor: border.soft.color }]}>
          {children}
        </View>
      ) : null}
    </View>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const { session, profile } = useAuth();
  const { t, locale, setLocale } = useLocale();
  const { colors, font, themeMode, setThemeMode, timeFormat, setTimeFormat, unitSystem, setUnitSystem } = useTheme();
  const [deleting, setDeleting] = useState(false);
  const [notifPrefs, setNotifPrefs] = useState<NotificationPrefs | null>(null);
  const [expandedPref, setExpandedPref] = useState<PreferenceKey | null>(null);

  const togglePref = (key: PreferenceKey) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedPref((current) => (current === key ? null : key));
  };

  // Small delay so the segmented control's own selection state is visible
  // for a beat before the row collapses back, rather than vanishing instantly.
  const selectAndCollapse = (apply: () => void) => {
    apply();
    setTimeout(() => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setExpandedPref(null);
    }, 220);
  };

  useEffect(() => {
    if (!session?.user) return;
    getMyNotificationSettings(session.user.id)
      .then(setNotifPrefs)
      .catch(() => {});
  }, [session?.user]);

  const handleToggleNotif = async (key: keyof NotificationPrefs, value: boolean) => {
    if (!notifPrefs) return;
    const previous = notifPrefs;
    setNotifPrefs({ ...notifPrefs, [key]: value });
    try {
      await updateNotificationPref(key, value);
    } catch (err) {
      setNotifPrefs(previous);
      notify(t('settings.couldNotSaveNotification'), err instanceof Error ? err.message : t('common.pleaseTryAgain'));
    }
  };

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
      <ScrollView contentContainerStyle={styles.content}>
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
          <Text style={[styles.sectionTitle, { color: colors.textMuted, fontFamily: font.family.monoBold }]}>{t('settings.preferences')}</Text>
          <Card style={styles.notifCard} raised={false}>
            <PreferenceRow
              label={t('settings.timeFormat')}
              value={timeFormat === '12h' ? t('settings.hour12') : t('settings.hour24')}
              expanded={expandedPref === 'timeFormat'}
              onPress={() => togglePref('timeFormat')}
              isFirst
            >
              <SegmentedControl
                segments={[
                  { value: '12h', label: t('settings.hour12') },
                  { value: '24h', label: t('settings.hour24') },
                ]}
                value={timeFormat}
                onChange={(v) => selectAndCollapse(() => setTimeFormat(v as TimeFormat))}
              />
            </PreferenceRow>
            <PreferenceRow
              label={t('settings.units')}
              value={unitSystem === 'imperial' ? t('settings.imperial') : t('settings.metric')}
              expanded={expandedPref === 'units'}
              onPress={() => togglePref('units')}
            >
              <SegmentedControl
                segments={[
                  { value: 'imperial', label: t('settings.imperial') },
                  { value: 'metric', label: t('settings.metric') },
                ]}
                value={unitSystem}
                onChange={(v) => selectAndCollapse(() => setUnitSystem(v as UnitSystem))}
              />
            </PreferenceRow>
            <PreferenceRow
              label={t('settings.language')}
              value={LOCALE_LABELS[locale]}
              expanded={expandedPref === 'language'}
              onPress={() => togglePref('language')}
            >
              <SegmentedControl
                segments={SUPPORTED_LOCALES.map((loc) => ({ value: loc, label: LOCALE_LABELS[loc] }))}
                value={locale}
                onChange={(v) => selectAndCollapse(() => setLocale(v as Locale))}
              />
            </PreferenceRow>
          </Card>
        </View>

        <View style={styles.field}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted, fontFamily: font.family.monoBold }]}>{t('settings.notifications')}</Text>
          <Card style={styles.notifCard} raised={false}>
            {NOTIFICATION_ROWS.map((row, i) => (
              <View
                key={row.key}
                style={[styles.notifRow, i > 0 && { borderTopWidth: 1, borderTopColor: colors.borderSubtle }]}
              >
                <Text style={[styles.notifLabel, { color: colors.textPrimary, fontFamily: font.family.bodyRegular }]}>
                  {t(`settings.notify${row.labelSuffix}` as never)}
                </Text>
                <Toggle
                  checked={notifPrefs?.[row.key] ?? true}
                  onChange={(value) => handleToggleNotif(row.key, value)}
                  disabled={!notifPrefs}
                />
              </View>
            ))}
          </Card>
        </View>

        <HoverPressable onPress={() => router.push('/blocked')}>
          <Card style={styles.row} raised={false}>
            <Text style={[styles.rowLabel, { color: colors.textPrimary, fontFamily: font.family.monoBold }]}>{t('settings.blockedUsers')}</Text>
            <Text style={[styles.chevron, { color: colors.textMuted }]}>›</Text>
          </Card>
        </HoverPressable>

        {profile?.is_moderator ? (
          <HoverPressable onPress={() => router.push('/moderation')}>
            <Card style={styles.row} raised={false}>
              <Text style={[styles.rowLabel, { color: colors.textPrimary, fontFamily: font.family.monoBold }]}>{t('settings.moderationQueue')}</Text>
              <Text style={[styles.chevron, { color: colors.textMuted }]}>›</Text>
            </Card>
          </HoverPressable>
        ) : null}

        <View style={styles.footer}>
          <Button label={t('profile.signOut')} variant="ghost" onPress={handleSignOut} />
          <HoverPressable onPress={handleDeleteAccount} disabled={deleting} style={styles.deleteAccountWrap}>
            <Text style={[styles.deleteAccountText, { color: colors.danger, fontFamily: font.family.monoBold }]}>
              {deleting ? '···' : t('profile.deleteAccount')}
            </Text>
          </HoverPressable>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 32,
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
  notifCard: {
    padding: 0,
    overflow: 'hidden',
  },
  notifRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  notifLabel: {
    fontSize: 14,
  },
  prefRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  prefRowLabel: {
    fontSize: 15,
  },
  prefRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  prefRowValue: {
    fontSize: 13,
  },
  prefPanel: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    paddingTop: 4,
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
