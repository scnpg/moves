import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { QRCodeSVG } from 'qrcode.react';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { useLocale } from '@/i18n/LocaleProvider';
import { notify } from '@/lib/alerts';
import { joinMoveUrl } from '@/lib/links';
import { useTheme } from '@/theme/ThemeProvider';

interface ShareMovePanelProps {
  shareToken: string;
}

export function ShareMovePanel({ shareToken }: ShareMovePanelProps) {
  const { t } = useLocale();
  const { colors, border, font } = useTheme();
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
      <Text style={[styles.label, { color: colors.textSecondary, fontFamily: font.family.monoBold }]}>{t('shareMove.label')}</Text>
      <Text style={[styles.helperText, { color: colors.textMuted, fontFamily: font.family.bodyRegular }]}>{t('shareMove.helperLinkQr')}</Text>
      <View style={styles.body}>
        <View style={[styles.qrWrap, { borderWidth: border.soft.width, borderColor: border.soft.color }]}>
          <QRCodeSVG value={url} size={96} fgColor={colors.textPrimary} bgColor={colors.bgCard} />
        </View>
        <View style={styles.linkCol}>
          <Text
            style={[styles.url, { color: colors.textPrimary, fontFamily: font.family.monoRegular, borderWidth: border.soft.width, borderColor: border.soft.color }]}
            numberOfLines={2}
          >
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
  body: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  qrWrap: {
    padding: 8,
  },
  linkCol: {
    flex: 1,
    gap: 8,
  },
  url: {
    fontSize: 11,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
});
