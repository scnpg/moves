import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { color, font, radius, spacing } from '@/theme/tokens';

interface TextFieldProps extends TextInputProps {
  label?: string;
  error?: string | null;
}

export function TextField({ label, error, style, ...inputProps }: TextFieldProps) {
  return (
    <View style={styles.wrapper}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
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
    color: color.textSecondary,
    fontSize: font.size.sm,
    fontWeight: font.weight.medium,
  },
  input: {
    backgroundColor: color.bgCard,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.md,
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
