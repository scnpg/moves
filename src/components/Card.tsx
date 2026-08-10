import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

interface CardProps {
  children: ReactNode;
  style?: ViewStyle;
  /** Thick colored stripe down the left edge, e.g. degree-of-separation color coding. */
  accentColor?: string;
  /** Set false for a flat card with no offset shadow (e.g. nested inside another card). */
  raised?: boolean;
}

export function Card({ children, style, accentColor, raised = true }: CardProps) {
  const { colors, border, shadow } = useTheme();

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.bgCard, borderWidth: border.rest.width, borderColor: border.rest.color },
        raised && shadow.small,
        accentColor ? { borderLeftWidth: 6, borderLeftColor: accentColor } : null,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
  },
});
