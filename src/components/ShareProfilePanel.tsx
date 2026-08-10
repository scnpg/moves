import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import * as Clipboard from 'expo-clipboard';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { useLocale } from '@/i18n/LocaleProvider';
import { notify } from '@/lib/alerts';
import { profileShareUrl } from '@/lib/links';
import { useTheme } from '@/theme/ThemeProvider';

interface ShareProfilePanelProps {
  userId: string;
}

/**
 * Native fallback: qrcode.react is React-DOM only, so the QR code itself is
 * web-exclusive - see ShareProfilePanel.web.tsx, which Metro picks
 * automatically on that platform. Native still gets the link + copy button.
 */
export function ShareProfilePanel({ userId }: ShareProfilePanelProps) {
  const { t } = useLocale();
  const { colors, border, font } = useTheme();
  const [copying, setCopying] = useState(false);
  const url = profileShareUrl(userId);

  const handleCopy = async () => {
    setCopying(true);
    try {
      await Clipboard.setStringAsync(url);
      notify(t('common.linkCopied'), t('shareProfile.linkCopiedMessage'));
    } finally {
      setCopying(false);
    }
  };

  return (
    <Card style={styles.card}>
      <Text style={[styles.label, { color: colors.textSecondary, fontFamily: font.family.monoBold }]}>{t('shareProfile.label')}</Text>
      <Text style={[styles.helperText, { color: colors.textMuted, fontFamily: font.family.bodyRegular }]}>{t('shareProfile.helperLink')}</Text>
      <Text
        style={[styles.url, { color: colors.textPrimary, fontFamily: font.family.monoRegular, borderWidth: border.soft.width, borderColor: border.soft.color }]}
        numberOfLines={1}
      >
        {url}
      </Text>
      <Button label={t('common.copyLink')} variant="secondary" onPress={handleCopy} loading={copying} />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 8,
  },
  label: {
    fontSize: 11,
    letterSpacing: 0.9,
  },
  helperText: {
    fontSize: 12,
  },
  url: {
    fontSize: 13,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
});
