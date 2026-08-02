import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

interface HoverState {
  pressed: boolean;
  hovered: boolean;
}

interface HoverPressableProps extends Omit<PressableProps, 'style' | 'children'> {
  style?: StyleProp<ViewStyle> | ((state: HoverState) => StyleProp<ViewStyle>);
  children?: ReactNode | ((state: HoverState) => ReactNode);
  /** 0-1. How much whiter the surface gets on hover/press - a "shade lightens" effect that works over any background color. */
  lightenOpacity?: number;
  disabled?: boolean;
}

/**
 * Pressable that lightens its own surface on hover (mouse) and press
 * (touch/mouse-down) - a white overlay clipped to the element's shape, so
 * it works consistently regardless of the underlying color. Hover is a
 * no-op on touch-only devices (no onHoverIn ever fires there), so the
 * press state alone covers mobile.
 */
export function HoverPressable({
  style,
  children,
  lightenOpacity = 0.15,
  disabled,
  onHoverIn,
  onHoverOut,
  ...rest
}: HoverPressableProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <Pressable
      disabled={disabled}
      onHoverIn={(e) => {
        setHovered(true);
        onHoverIn?.(e);
      }}
      onHoverOut={(e) => {
        setHovered(false);
        onHoverOut?.(e);
      }}
      style={({ pressed }) => [
        styles.base,
        typeof style === 'function' ? style({ pressed, hovered }) : style,
      ]}
      {...rest}
    >
      {(state) => (
        <>
          {typeof children === 'function' ? children({ ...state, hovered }) : children}
          {!disabled && (hovered || state.pressed) ? (
            <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: `rgba(255,255,255,${lightenOpacity})` }]} />
          ) : null}
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    position: 'relative',
    overflow: 'hidden',
  },
});
