import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { borderWidth, color, font, radius, spacing } from '@/theme/tokens';

interface TextFieldProps extends TextInputProps {
  label?: string;
  error?: string | null;
}

export function TextField({ label, error, style, ...inputProps }: TextFieldProps) {
  return (
    <View style={styles.wrapper}>
      {label ? <Text style={styles.label}>{label.toUpperCase()}</Text> : null}
      <TextInput
        placeholderTextColor={color.textMuted}
        style={[styles.input, error ? styles.inputError : null, style]}
        {...inputProps}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
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
  input: {
    backgroundColor: color.bgCard,
    borderWidth: borderWidth.base,
    borderColor: color.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    color: color.textPrimary,
    fontSize: font.size.md,
  },
  inputError: {
    borderColor: color.danger,
  },
  error: {
    color: color.danger,
    fontSize: font.size.xs,
  },
});
