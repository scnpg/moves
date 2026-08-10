import { StyleSheet, View } from 'react-native';

import { HoverPressable } from '@/components/HoverPressable';
import { useTheme } from '@/theme/ThemeProvider';

interface ToggleProps {
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}

const TRACK_WIDTH = 52;
const TRACK_HEIGHT = 28;
const THUMB_SIZE = 20;
const PADDING = 2;

/**
 * Hard rectangular switch - square track, square thumb, no slide animation.
 * The thumb moves via a flex justify-content flip, not a transform, so it's
 * an instant snap by design (matches the "zero softness" motion spec).
 */
export function Toggle({ checked, onChange, disabled }: ToggleProps) {
  const { colors, borderWidth } = useTheme();

  return (
    <HoverPressable
      onPress={() => !disabled && onChange(!checked)}
      disabled={disabled}
      lightenOpacity={0}
      accessibilityRole="switch"
      accessibilityState={{ checked, disabled }}
      style={[
        styles.track,
        {
          justifyContent: checked ? 'flex-end' : 'flex-start',
          backgroundColor: checked ? colors.brand : colors.bgCard,
          borderColor: colors.border,
          borderWidth: borderWidth.structural,
          opacity: disabled ? 0.4 : 1,
        },
      ]}
    >
      <View style={[styles.thumb, { backgroundColor: colors.border }]} />
    </HoverPressable>
  );
}

const styles = StyleSheet.create({
  track: {
    width: TRACK_WIDTH,
    height: TRACK_HEIGHT,
    padding: PADDING,
    flexDirection: 'row',
    alignItems: 'center',
  },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
  },
});
