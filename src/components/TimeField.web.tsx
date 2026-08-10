import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

interface TimeFieldProps {
  label: string;
  value: string; // "HH:MM", 24-hour
  onChange: (value: string) => void;
}

/** Real native <input type="time"> on web - gives a proper browser time picker. */
export function TimeField({ label, value, onChange }: TimeFieldProps) {
  const { colors, border, font } = useTheme();
  return (
    <View style={styles.wrapper}>
      <Text style={[styles.label, { color: colors.textPrimary, fontFamily: font.family.monoBold }]}>{label.toUpperCase()}</Text>
      <input
        type="time"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          backgroundColor: colors.well,
          border: `${border.rest.width}px solid ${border.rest.color}`,
          padding: '12px',
          color: colors.textPrimary,
          fontSize: 16,
          fontFamily: 'inherit',
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 6,
  },
  label: {
    fontSize: 11,
    letterSpacing: 0.9,
  },
});
