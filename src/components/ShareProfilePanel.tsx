import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import * as Clipboard from 'expo-clipboard';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { notify } from '@/lib/alerts';
import { profileShareUrl } from '@/lib/links';
import { borderWidth, color, font, spacing } from '@/theme/tokens';

interface ShareProfilePanelProps {
  userId: string;
}

/**
 * Native fallback: qrcode.react is React-DOM only, so the QR code itself is
 * web-exclusive - see ShareProfilePanel.web.tsx, which Metro picks
 * automatically on that platform. Native still gets the link + copy button.
 */
export function ShareProfilePanel({ userId }: ShareProfilePanelProps) {
  const [copying, setCopying] = useState(false);
  const url = profileShareUrl(userId);

  const handleCopy = async () => {
    setCopying(true);
    try {
      await Clipboard.setStringAsync(url);
      notify('Link copied', 'Share it however you like.');
    } finally {
      setCopying(false);
    }
  };

  return (
    <Card style={styles.card}>
      <Text style={styles.label}>SHARE PROFILE</Text>
      <Text style={styles.helperText}>Anyone with this link can view your profile - no account needed.</Text>
      <Text style={styles.url} numberOfLines={1}>
        {url}
      </Text>
      <Button label="Copy Link" variant="secondary" onPress={handleCopy} loading={copying} />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
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
