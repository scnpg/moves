import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { QRCodeSVG } from 'qrcode.react';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { useLocale } from '@/i18n/LocaleProvider';
import { notify } from '@/lib/alerts';
import { joinMoveUrl } from '@/lib/links';
import { borderWidth, color, font, spacing } from '@/theme/tokens';

interface ShareMovePanelProps {
  shareToken: string;
}

export function ShareMovePanel({ shareToken }: ShareMovePanelProps) {
  const { t } = useLocale();
  const [copying, setCopying] = useState(false);
  const url = joinMoveUrl(shareToken);

  const handleCopy = async () => {
    setCopying(true);
    try {
      await navigator.clipboard.writeText(url);
      notify(t('common.linkCopied'), t('shareMove.linkCopiedMessage'));
    } catch {
      notify(t('common.couldNotCopy'), t('common.copyManually'));
    } finally {
      setCopying(false);
    }
  };

  return (
    <Card style={styles.card}>
      <Text style={styles.label}>{t('shareMove.label')}</Text>
      <Text style={styles.helperText}>{t('shareMove.helperLinkQr')}</Text>
      <View style={styles.body}>
        <View style={styles.qrWrap}>
          <QRCodeSVG value={url} size={96} fgColor={color.textPrimary} bgColor={color.bgCard} />
        </View>
        <View style={styles.linkCol}>
          <Text style={styles.url} numberOfLines={2}>
            {url}
          </Text>
          <Button label={t('common.copyLink')} variant="secondary" onPress={handleCopy} loading={copying} />
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    margin: spacing.md,
    marginTop: 0,
    gap: spacing.xs,
  },
  label: {
    fontFamily: font.family.mono,
    color: color.textSecondary,
    fontSize: font.size.xs,
    fontWeight: font.weight.bold,
    letterSpacing: font.tracking.wide,
  },
  helperText: {
    color: color.textMuted,
    fontSize: font.size.xs,
  },
  body: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  qrWrap: {
    padding: spacing.xs,
    borderWidth: borderWidth.thin,
    borderColor: color.borderSubtle,
    borderRadius: 4,
  },
  linkCol: {
    flex: 1,
    gap: spacing.xs,
  },
  url: {
    fontFamily: font.family.mono,
    color: color.textPrimary,
    fontSize: font.size.xs,
    borderWidth: borderWidth.thin,
    borderColor: color.borderSubtle,
    borderRadius: 4,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
  },
});
