import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { useTheme } from '@/theme/ThemeProvider';

type SnapPoint = 'peek' | 'half' | 'full';

interface BottomSheetProps {
  children: ReactNode;
  /** Height of the area this sheet overlays (e.g. the map). Snap points are fractions of it. */
  containerHeight: number;
  defaultSnap?: SnapPoint;
}

export const BOTTOM_SHEET_PEEK_PX = 120;
const PEEK_PX = BOTTOM_SHEET_PEEK_PX;

/**
 * Drag-to-snap sheet, absolutely positioned over the bottom of its parent.
 * The gesture attaches only to the handle grip, not the body, so it never
 * fights a scrollable feed rendered inside `children`. Snaps at 140ms
 * linear - matches the design system's "nothing eases" motion spec, so this
 * deliberately uses withTiming, not withSpring.
 */
export function BottomSheet({ children, containerHeight, defaultSnap = 'half' }: BottomSheetProps) {
  const { colors, borderWidth } = useTheme();

  const snapPx = {
    peek: PEEK_PX,
    half: containerHeight * 0.5,
    full: containerHeight * 0.92,
  };
  const minPx = PEEK_PX;
  const maxPx = containerHeight * 0.95;

  const height = useSharedValue(snapPx[defaultSnap]);
  const dragStart = useSharedValue(snapPx[defaultSnap]);

  const pan = Gesture.Pan()
    .onStart(() => {
      dragStart.value = height.value;
    })
    .onUpdate((e) => {
      const next = dragStart.value - e.translationY;
      height.value = Math.min(maxPx, Math.max(minPx, next));
    })
    .onEnd(() => {
      const points = [snapPx.peek, snapPx.half, snapPx.full];
      let nearest = points[0];
      let bestDist = Math.abs(height.value - points[0]);
      for (let i = 1; i < points.length; i++) {
        const d = Math.abs(height.value - points[i]);
        if (d < bestDist) {
          bestDist = d;
          nearest = points[i];
        }
      }
      height.value = withTiming(nearest, { duration: 140, easing: Easing.linear });
    });

  const animatedStyle = useAnimatedStyle(() => ({ height: height.value }));

  return (
    <Animated.View
      style={[
        styles.sheet,
        animatedStyle,
        { backgroundColor: colors.bgCard, borderTopWidth: borderWidth.emphatic, borderTopColor: colors.border },
      ]}
    >
      <GestureDetector gesture={pan}>
        <View style={styles.handleArea}>
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
        </View>
      </GestureDetector>
      <View style={styles.content}>{children}</View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  handleArea: {
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  handle: {
    width: 48,
    height: 4,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
});
