import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { useLocale } from '@/i18n/LocaleProvider';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * Shown in place of the sign-in screen right after AuthProvider catches a
 * banned account and signs it out - see loadProfile() there. Dismissing
 * just clears back to the normal sign-in screen; there's no appeal flow
 * here, only the support contact (Settings isn't reachable while signed
 * out, so this points at the email directly).
 */
export function BannedScreen({ reason, onDismiss }: { reason: string; onDismiss: () => void }) {
  const { t } = useLocale();
  const { colors, font } = useTheme();

  return (
    <View style={[styles.wrap, { backgroundColor: colors.bg }]}>
      <Text style={styles.icon}>🚫</Text>
      <Text style={[styles.title, { color: colors.textPrimary, fontFamily: font.family.heroDisplay }]}>
        {t('banned.title')}
      </Text>
      <Text style={[styles.body, { color: colors.textSecondary, fontFamily: font.family.bodyRegular }]}>
        {reason ? t('banned.bodyWithReason', { reason }) : t('banned.body')}
      </Text>
      <Text style={[styles.contact, { color: colors.textMuted, fontFamily: font.family.bodyRegular }]}>
        {t('banned.contact')}
      </Text>
      <Button label={t('banned.dismiss')} variant="secondary" onPress={onDismiss} style={styles.button} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  icon: {
    fontSize: 40,
    marginBottom: 4,
  },
  title: {
    fontSize: 24,
    textAlign: 'center',
  },
  body: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  contact: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 8,
  },
  button: {
    minWidth: 200,
  } as object,
});
