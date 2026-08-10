import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import * as Clipboard from 'expo-clipboard';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { useLocale } from '@/i18n/LocaleProvider';
import { notify } from '@/lib/alerts';
import { joinMoveUrl } from '@/lib/links';
import { useTheme } from '@/theme/ThemeProvider';

interface ShareMovePanelProps {
  shareToken: string;
}

/**
 * Native fallback: qrcode.react is React-DOM only, so the QR code itself is
 * web-exclusive - see ShareMovePanel.web.tsx, which Metro picks automatically
 * on that platform. Native still gets the link + copy button.
 */
export function ShareMovePanel({ shareToken }: ShareMovePanelProps) {
  const { t } = useLocale();
  const { colors, border, font } = useTheme();
  const [copying, setCopying] = useState(false);
  const url = joinMoveUrl(shareToken);

  const handleCopy = async () => {
    setCopying(true);
    try {
      await Clipboard.setStringAsync(url);
      notify(t('common.linkCopied'), t('shareMove.linkCopiedMessage'));
    } finally {
      setCopying(false);
    }
  };

  return (
    <Card style={styles.card}>
      <Text style={[styles.label, { color: colors.textSecondary, fontFamily: font.family.monoBold }]}>{t('shareMove.label')}</Text>
      <Text style={[styles.helperText, { color: colors.textMuted, fontFamily: font.family.bodyRegular }]}>{t('shareMove.helperLink')}</Text>
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
    margin: 16,
    marginTop: 0,
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
