import { StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

import { CircularProgress } from '@/components/CircularProgress';
import { useTheme } from '@/theme/ThemeProvider';

interface PullToRefreshIndicatorProps {
  openAmount: SharedValue<number>;
  progress: SharedValue<number>;
  refreshing: SharedValue<boolean>;
}

/**
 * Overlays the top of the scrollable it's paired with (see usePullToRefresh)
 * - absolutely positioned so its growing height never touches the list's own
 * layout. If it were a normal flex sibling instead, expanding it would
 * shrink the list's frame on every pull frame, which resets the list's own
 * scroll offset mid-gesture (confirmed via a debug log: the tracked
 * overscroll oscillated back to 0 every other frame before this fix).
 * Purely presentational otherwise - its animation is driven entirely by the
 * shared values the hook already computed.
 */
export function PullToRefreshIndicator({ openAmount, progress, refreshing }: PullToRefreshIndicatorProps) {
  const { colors } = useTheme();

  const containerStyle = useAnimatedStyle(() => ({
    height: openAmount.value,
    opacity: Math.min(1, openAmount.value / 24),
  }));

  return (
    <Animated.View style={[styles.container, containerStyle]} pointerEvents="none">
      <CircularProgress progress={progress} spinning={refreshing} color={colors.brand} trackColor={colors.borderSubtle} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
