import { useCallback } from 'react';
import type { FlatList } from 'react-native';
import {
  runOnJS,
  scrollTo,
  useAnimatedReaction,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { SPIN_DURATION } from '@/components/CircularProgress';

interface UsePullToRefreshOptions {
  onRefresh: () => Promise<void>;
  /** Pull distance (px) past which releasing triggers a refresh. */
  threshold?: number;
  /** Container height the indicator locks open to while refreshing. */
  openHeight?: number;
  /** Ceiling on how tall the indicator grows while merely dragging. */
  maxDragHeight?: number;
}

/**
 * Drives a custom pull-to-refresh indicator from a scrollable's own
 * rubber-band overscroll (negative contentOffset.y) instead of a gesture
 * handler, so it never competes with the list's native scrolling - see
 * onScroll below, which only ever reacts to offsets already below 0.
 */
export function usePullToRefresh({ onRefresh, threshold = 70, openHeight = 64, maxDragHeight = 90 }: UsePullToRefreshOptions) {
  const scrollRef = useAnimatedRef<FlatList>();
  const openAmount = useSharedValue(0);
  const progress = useSharedValue(0);
  const refreshing = useSharedValue(false);
  // Reserves real layout space for the wheel (pushes the list content down)
  // instead of only overlaying it - unlike openAmount, this is NEVER touched
  // by onScroll, only by the two withTiming calls below (trigger and close).
  // That's deliberate: changing a normal-flow sibling's height while the
  // list is actively being scrolled/bounced is what caused the earlier
  // scroll-offset feedback bug, so this only ever moves once the gesture is
  // fully over and the list's own offset has already settled.
  const reservedHeight = useSharedValue(0);
  // Drives the list's own contentOffset back to 0 ourselves once a refresh
  // triggers, in lockstep with reservedHeight opening. Left alone, the list
  // would run its own native rubber-band snap-back animation at the same
  // time as reservedHeight is growing - two independently-timed animations
  // both moving the same content, which is exactly what showed up as content
  // twitching/settling wrong for a frame before this. Driving both from the
  // same withTiming call (same duration/easing) makes their combined effect
  // on-screen (reservedHeight - scrollOffset) move smoothly from wherever
  // the pull left it straight to its resting position, with nothing else
  // competing for that same pixel.
  const pinnedOffset = useSharedValue(0);

  useAnimatedReaction(
    () => pinnedOffset.value,
    (y) => {
      scrollTo(scrollRef, 0, y, false);
    }
  );

  // Only the actual data fetch needs the JS thread - everything the
  // animation depends on (refreshing/openAmount) is set synchronously in
  // onEndDrag below, on the same UI thread as onScroll, so there's no
  // window for the native bounce-back's own scroll events to land before
  // the "locked open" state takes effect.
  const startFetch = useCallback(() => {
    const startedAt = Date.now();
    onRefresh().finally(() => {
      // Don't close the moment data arrives - wait until the wheel has
      // completed a whole number of spins (at least one), so the list never
      // slides back up mid-rotation. A fast refresh still gets one full
      // visible spin; a slow one finishes whichever lap it's mid-way
      // through instead of stopping abruptly.
      const elapsed = Date.now() - startedAt;
      const totalSpinTime = Math.max(SPIN_DURATION, Math.ceil(elapsed / SPIN_DURATION) * SPIN_DURATION);
      setTimeout(() => {
        refreshing.value = false;
        progress.value = 0;
        // Both close on the exact same timing, so the reserved space and
        // the wheel's own visible size collapse together - the list only
        // ever moves at the rate the wheel is disappearing, never ahead of it.
        openAmount.value = withTiming(0, { duration: 250 });
        reservedHeight.value = withTiming(0, { duration: 250 });
      }, totalSpinTime - elapsed);
    });
  }, [onRefresh, refreshing, progress, openAmount, reservedHeight]);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      // Locked open for the duration of a refresh - ignore the native
      // bounce-back's own scroll events so they can't fight the timing
      // animation that opened/will close the indicator.
      if (refreshing.value) return;
      const overscroll = event.contentOffset.y < 0 ? -event.contentOffset.y : 0;
      openAmount.value = Math.min(overscroll, maxDragHeight);
      progress.value = Math.min(1, overscroll / threshold);
    },
    onEndDrag: (event) => {
      if (!refreshing.value && progress.value >= 1) {
        refreshing.value = true;
        // Freeze the scroll position right where the finger left it, then
        // animate it back to 0 ourselves instead of letting the native
        // bounce-back run unsupervised.
        pinnedOffset.value = event.contentOffset.y;
        pinnedOffset.value = withTiming(0, { duration: 220 });
        openAmount.value = withTiming(openHeight, { duration: 220 });
        reservedHeight.value = withTiming(openHeight, { duration: 220 });
        runOnJS(startFetch)();
      }
    },
  });

  return { scrollRef, scrollHandler, openAmount, progress, refreshing, reservedHeight };
}
