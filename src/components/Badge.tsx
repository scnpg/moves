import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

type Tone = 'neutral' | 'green' | 'blue' | 'pink' | 'yellow' | 'orange' | 'violet' | 'teal' | 'ink' | 'red';

export function Badge({ label, tone = 'neutral' }: { label: string; tone?: Tone }) {
  const { colors, border, font } = useTheme();

  const toneColors: Record<Tone, { bg: string; text: string }> = {
    neutral: { bg: colors.bgElevated, text: colors.textPrimary },
    green: { bg: colors.accentGreenFlat, text: colors.onAccent },
    blue: { bg: colors.accentBlue, text: colors.textInverse },
    pink: { bg: colors.accentPink, text: colors.textInverse },
    yellow: { bg: colors.accentYellow, text: colors.textPrimary },
    orange: { bg: colors.accentOrange, text: colors.textPrimary },
    violet: { bg: colors.accentViolet, text: colors.textInverse },
    teal: { bg: colors.accentTeal, text: colors.textPrimary },
    ink: { bg: colors.border, text: colors.textInverse },
    red: { bg: colors.accentRed, text: colors.textInverse },
  };
  const { bg, text } = toneColors[tone];

  return (
    <View
      style={[
        styles.base,
        { backgroundColor: bg, borderWidth: border.rest.width, borderColor: colors.border },
      ]}
    >
      <Text style={[styles.label, { color: text, fontFamily: font.family.monoBold }]}>{label.toUpperCase()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 22,
    paddingHorizontal: 10,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  label: {
    fontSize: 11,
    letterSpacing: 0.9,
  },
});
