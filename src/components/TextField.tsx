import { useState } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

interface TextFieldProps extends TextInputProps {
  label?: string;
  /** Appends a colored asterisk after the label - purely visual, doesn't affect validation. */
  required?: boolean;
  error?: string | null;
  hint?: string | null;
}

export function TextField({ label, required, error, hint, style, onFocus, onBlur, multiline, ...inputProps }: TextFieldProps) {
  const { colors, border, font } = useTheme();
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.wrapper}>
      {label ? (
        <Text style={[styles.label, { fontFamily: font.family.monoBold, color: colors.textPrimary }]}>
          {label.toUpperCase()}
          {required ? <Text style={{ color: colors.danger }}> *</Text> : null}
        </Text>
      ) : null}
      <View style={styles.inputRow}>
        {focused && border.focused.hasInsetBar ? (
          <View style={[styles.insetBar, { backgroundColor: colors.border }]} pointerEvents="none" />
        ) : null}
        <TextInput
          placeholderTextColor={colors.textMuted}
          multiline={multiline}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[
            styles.input,
            multiline && styles.inputMultiline,
            {
              backgroundColor: colors.well,
              borderWidth: focused ? border.focused.width : border.rest.width,
              borderColor: error ? colors.danger : focused ? border.focused.color : border.rest.color,
              color: colors.textPrimary,
              paddingLeft: focused && border.focused.hasInsetBar ? 11 : 12,
            },
            style,
          ]}
          {...inputProps}
        />
      </View>
      {hint && !error ? <Text style={[styles.hint, { color: colors.textMuted }]}>{hint}</Text> : null}
      {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
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
  inputRow: {
    position: 'relative',
  },
  insetBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    zIndex: 1,
  },
  input: {
    minHeight: 48,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    lineHeight: 24,
  },
  inputMultiline: {
    minHeight: 88,
    textAlignVertical: 'top',
  },
  hint: {
    fontSize: 14,
  },
  error: {
    fontSize: 12,
  },
});
