import { StyleSheet, Text, View } from 'react-native';

import { color, font, radius, spacing } from '@/theme/tokens';

type Tone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger';

export function Badge({ label, tone = 'neutral' }: { label: string; tone?: Tone }) {
  return (
    <View style={[styles.base, toneStyles[tone].bg]}>
      <Text style={[styles.label, toneStyles[tone].text]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 3,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  label: {
    fontSize: font.size.xs,
    fontWeight: font.weight.semibold,
  },
});

const toneStyles = {
  neutral: StyleSheet.create({ bg: { backgroundColor: color.bgElevated }, text: { color: color.textSecondary } }),
  brand: StyleSheet.create({ bg: { backgroundColor: color.brandMuted }, text: { color: color.textPrimary } }),
  success: StyleSheet.create({ bg: { backgroundColor: 'rgba(61,220,132,0.15)' }, text: { color: color.success } }),
  warning: StyleSheet.create({ bg: { backgroundColor: 'rgba(255,176,32,0.15)' }, text: { color: color.warning } }),
  danger: StyleSheet.create({ bg: { backgroundColor: 'rgba(255,84,112,0.15)' }, text: { color: color.danger } }),
};
