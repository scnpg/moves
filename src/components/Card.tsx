import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { borderWidth, color, radius, shadow, spacing } from '@/theme/tokens';

interface CardProps {
  children: ReactNode;
  style?: ViewStyle;
  /** Thick colored stripe down the left edge, e.g. degree-of-separation color coding. */
  accentColor?: string;
  /** Set false for a flat card with no offset shadow (e.g. nested inside another card). */
  raised?: boolean;
}

export function Card({ children, style, accentColor, raised = true }: CardProps) {
  return (
    <View
      style={[
        styles.card,
        raised && shadow.small,
        accentColor ? { borderLeftWidth: borderWidth.thick + 2, borderLeftColor: accentColor } : null,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: color.bgCard,
    borderRadius: radius.md,
    borderWidth: borderWidth.base,
    borderColor: color.border,
    padding: spacing.md,
  },
});
