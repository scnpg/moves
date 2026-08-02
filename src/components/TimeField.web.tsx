import { StyleSheet, Text, View } from 'react-native';

import { borderWidth, color, font, radius, spacing } from '@/theme/tokens';

interface TimeFieldProps {
  label: string;
  value: string; // "HH:MM", 24-hour
  onChange: (value: string) => void;
}

/** Real native <input type="time"> on web - gives a proper browser time picker. */
export function TimeField({ label, value, onChange }: TimeFieldProps) {
  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label.toUpperCase()}</Text>
      <input
        type="time"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          backgroundColor: color.bgCard,
          border: `${borderWidth.base}px solid ${color.border}`,
          borderRadius: radius.sm,
          padding: `${spacing.sm}px`,
          color: color.textPrimary,
          fontSize: font.size.md,
          fontFamily: 'inherit',
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: spacing.xxs,
  },
  label: {
    fontFamily: font.family.mono,
    color: color.textSecondary,
    fontSize: font.size.xs,
    fontWeight: font.weight.bold,
    letterSpacing: font.tracking.label,
  },
});
