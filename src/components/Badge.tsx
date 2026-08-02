import { StyleSheet, Text, View } from 'react-native';

import { borderWidth, color, font, radius, spacing } from '@/theme/tokens';

type Tone = 'neutral' | 'green' | 'blue' | 'pink' | 'yellow' | 'orange' | 'violet' | 'teal' | 'ink';

export function Badge({ label, tone = 'neutral' }: { label: string; tone?: Tone }) {
  return (
    <View style={[styles.base, toneStyles[tone].bg]}>
      <Text style={[styles.label, toneStyles[tone].text]}>{label.toUpperCase()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 3,
    borderRadius: radius.sm,
    borderWidth: borderWidth.thin,
    borderColor: color.border,
    alignSelf: 'flex-start',
  },
  label: {
    fontFamily: font.family.mono,
    fontSize: font.size.xs,
    fontWeight: font.weight.bold,
    letterSpacing: font.tracking.label,
  },
});

const toneStyles = {
  neutral: StyleSheet.create({ bg: { backgroundColor: color.bgElevated }, text: { color: color.textPrimary } }),
  green: StyleSheet.create({ bg: { backgroundColor: color.accentGreen }, text: { color: color.textPrimary } }),
  blue: StyleSheet.create({ bg: { backgroundColor: color.accentBlue }, text: { color: color.textPrimary } }),
  pink: StyleSheet.create({ bg: { backgroundColor: color.accentPink }, text: { color: color.textPrimary } }),
  yellow: StyleSheet.create({ bg: { backgroundColor: color.accentYellow }, text: { color: color.textPrimary } }),
  orange: StyleSheet.create({ bg: { backgroundColor: color.accentOrange }, text: { color: color.textPrimary } }),
  violet: StyleSheet.create({ bg: { backgroundColor: color.accentViolet }, text: { color: color.textInverse } }),
  teal: StyleSheet.create({ bg: { backgroundColor: color.accentTeal }, text: { color: color.textPrimary } }),
  ink: StyleSheet.create({ bg: { backgroundColor: color.border }, text: { color: color.textInverse } }),
};
