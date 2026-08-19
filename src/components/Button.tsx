import { ActivityIndicator, StyleSheet, Text, type ViewStyle } from 'react-native';

import { HoverPressable } from '@/components/HoverPressable';
import { useTheme } from '@/theme/ThemeProvider';

type Variant = 'primary' | 'secondary' | 'destructive' | 'ghost';
/** @deprecated use variant="destructive" */
type LegacyVariant = 'danger';
type Size = 'lg' | 'md' | 'sm';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant | LegacyVariant;
  size?: Size;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  /** Overrides the secondary variant's border/text color - e.g. gold for an active "close friend" toggle. No effect on filled or ghost variants. */
  accentColor?: string;
}

const HEIGHTS: Record<Size, number> = { lg: 52, md: 40, sm: 32 };
const H_PADDING: Record<Size, number> = { lg: 24, md: 20, sm: 14 };

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled,
  loading,
  style,
  accentColor,
}: ButtonProps) {
  const theme = useTheme();
  const { colors, borderWidth, shadow, font } = theme;
  const isDisabled = disabled || loading;
  const resolvedVariant: Variant = variant === 'danger' ? 'destructive' : variant;

  const isFilled = resolvedVariant === 'primary' || resolvedVariant === 'destructive';
  const fillColor = resolvedVariant === 'primary' ? colors.brand : colors.danger;
  const fillTextColor = resolvedVariant === 'primary' ? colors.onAccent : colors.textInverse;

  const variantStyle: ViewStyle = isDisabled
    ? { backgroundColor: colors.bg, borderWidth: borderWidth.structural, borderColor: colors.borderSubtle }
    : isFilled
      ? { backgroundColor: fillColor, borderWidth: borderWidth.emphatic, borderColor: colors.border }
      : resolvedVariant === 'secondary'
        ? { backgroundColor: colors.bgElevated, borderWidth: borderWidth.structural, borderColor: accentColor ?? colors.border }
        : { backgroundColor: 'transparent', borderWidth: 0, paddingHorizontal: 0 };

  const textColor = isDisabled
    ? colors.textMuted
    : resolvedVariant === 'secondary'
      ? (accentColor ?? colors.textPrimary)
      : resolvedVariant === 'ghost'
        ? colors.textPrimary
        : fillTextColor;

  return (
    <HoverPressable
      onPress={onPress}
      disabled={isDisabled}
      lightenOpacity={resolvedVariant === 'ghost' ? 0 : 0.12}
      style={({ pressed }) => {
        const showShadow = isFilled && !isDisabled && !pressed;
        const translate = pressed && !isDisabled ? (resolvedVariant === 'ghost' ? 1 : 3) : 0;
        return [
          styles.base,
          {
            height: HEIGHTS[size],
            paddingHorizontal: resolvedVariant === 'ghost' ? 0 : H_PADDING[size],
            width: size === 'lg' && resolvedVariant !== 'ghost' ? '100%' : undefined,
          },
          variantStyle,
          showShadow ? shadow.hard : null,
          translate ? { transform: [{ translateX: translate }, { translateY: translate }] } : null,
          style,
        ];
      }}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <Text
          style={[
            styles.label,
            {
              color: textColor,
              fontFamily: font.family.monoBold,
              textDecorationLine: resolvedVariant === 'ghost' && !isDisabled ? 'underline' : 'none',
            },
          ]}
        >
          {label.toUpperCase()}
        </Text>
      )}
    </HoverPressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  label: {
    fontSize: 13,
    letterSpacing: 1,
  },
});
