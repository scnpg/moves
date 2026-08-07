import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { notify } from '@/lib/alerts';
import { joinMoveUrl } from '@/lib/links';
import { borderWidth, color, font, spacing } from '@/theme/tokens';

interface ShareMovePanelProps {
  shareToken: string;
}

/**
 * Native fallback: qrcode.react is React-DOM only, so the QR code itself is
 * web-exclusive - see ShareMovePanel.web.tsx, which Metro picks automatically
 * on that platform. Native still gets the link + copy button.
 */
export function ShareMovePanel({ shareToken }: ShareMovePanelProps) {
  const [copying, setCopying] = useState(false);
  const url = joinMoveUrl(shareToken);

  const handleCopy = async () => {
    setCopying(true);
    try {
      await Clipboard.setStringAsync(url);
      notify('Link copied', 'Share it with whoever you want in.');
    } finally {
      setCopying(false);
    }
  };

  return (
    <Card style={styles.card}>
      <Text style={styles.label}>PRIVATE - SHARE LINK ONLY</Text>
      <Text style={styles.helperText}>Only people with this link can see or join this Move.</Text>
      <Text style={styles.url} numberOfLines={1}>
        {url}
      </Text>
      <Button label="Copy Link" variant="secondary" onPress={handleCopy} loading={copying} />
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
  url: {
    fontFamily: font.family.mono,
    color: color.textPrimary,
    fontSize: font.size.sm,
    borderWidth: borderWidth.thin,
    borderColor: color.borderSubtle,
    borderRadius: 4,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
  },
});
