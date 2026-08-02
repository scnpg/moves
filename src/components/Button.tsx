import { ActivityIndicator, StyleSheet, Text, type ViewStyle } from 'react-native';

import { HoverPressable } from '@/components/HoverPressable';
import { borderWidth, color, font, radius, shadow, spacing } from '@/theme/tokens';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  style,
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <HoverPressable
      onPress={onPress}
      disabled={isDisabled}
      lightenOpacity={variant === 'ghost' ? 0.08 : 0.18}
      style={({ pressed }) => [
        styles.base,
        variantStyles[variant],
        variant !== 'ghost' && !isDisabled ? (pressed ? styles.pressed : shadow.small) : undefined,
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={color.textPrimary} />
      ) : (
        <Text style={[styles.label, textVariantStyles[variant]]}>{label.toUpperCase()}</Text>
      )}
    </HoverPressable>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.sm,
    borderWidth: borderWidth.base,
    borderColor: color.border,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  disabled: {
    opacity: 0.4,
  },
  pressed: {
    transform: [{ translateX: 2 }, { translateY: 2 }],
  },
  label: {
    fontFamily: font.family.mono,
    fontSize: font.size.sm,
    fontWeight: font.weight.bold,
    letterSpacing: font.tracking.label,
  },
});

const variantStyles: Record<Variant, ViewStyle> = StyleSheet.create({
  primary: { backgroundColor: color.brand },
  secondary: { backgroundColor: color.bgCard },
  danger: { backgroundColor: color.danger },
  ghost: { backgroundColor: 'transparent', borderColor: 'transparent' },
});

const textVariantStyles = StyleSheet.create({
  primary: { color: color.textPrimary },
  secondary: { color: color.textPrimary },
  danger: { color: color.textPrimary },
  ghost: { color: color.textSecondary },
});
