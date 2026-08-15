import { StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import { useTheme } from '@/theme/ThemeProvider';

interface SliderProps {
  min: number;
  max: number;
  value: number;
  /** Fires continuously while dragging, for live label/visual feedback. */
  onChange: (value: number) => void;
  /** Fires once when the drag ends - the right moment to trigger a network refetch. */
  onSlidingComplete?: (value: number) => void;
  formatValue?: (value: number) => string;
  /** Values to call out on the track with a tick + label, e.g. [2, 50]. Ones matching min/max are skipped (already shown as end labels). */
  milestones?: number[];
}

const TRACK_HEIGHT = 6;
const THUMB_SIZE = 24;

/**
 * Hand-rolled, not @react-native-community/slider - a native OS-styled
 * thumb/track would clash with the flat/square design system, and this
 * avoids pulling in another native module. Drag (or tap) anywhere along the
 * track - position is read directly from the gesture's local x, no
 * onLayout measurement involved (unreliable for this RN/RNW combination
 * elsewhere in the app - see (tabs)/index.tsx's mapHeight comment).
 *
 * Position <-> value mapping is logarithmic rather than linear (requires
 * min > 0): equal drag distance near the low end of the track moves the
 * value far less than the same drag distance near the high end, so most of
 * the track's precision is spent on small values.
 */
export function Slider({ min, max, value, onChange, onSlidingComplete, formatValue, milestones }: SliderProps) {
  const { colors, borderWidth, font } = useTheme();
  const trackWidth = useSharedValue(0);
  const logRange = Math.log(max / min);

  const toFraction = (v: number) => Math.min(1, Math.max(0, Math.log(Math.max(v, min) / min) / logRange));
  const fraction = useSharedValue(toFraction(value));

  // Called from .onUpdate()/.onEnd() below, which run as worklets on the UI
  // thread - these need the 'worklet' directive too, otherwise Reanimated
  // treats them as JS-thread-only functions and crashes trying to call them
  // synchronously from the UI thread.
  const clampFraction = (x: number, width: number) => {
    'worklet';
    return Math.min(1, Math.max(0, width > 0 ? x / width : 0));
  };
  // Whole-number precision above 10mi is plenty once each unit already
  // represents a meaningfully different search area; below that, halves
  // matter (there's a big difference between a 1mi and 1.5mi radius).
  const roundValue = (v: number) => {
    'worklet';
    return v < 10 ? Math.round(v * 2) / 2 : Math.round(v);
  };
  const valueFromFraction = (f: number) => {
    'worklet';
    return Math.min(max, Math.max(min, roundValue(min * Math.exp(f * logRange))));
  };

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      const next = clampFraction(e.x, trackWidth.value);
      fraction.value = next;
      runOnJS(onChange)(valueFromFraction(next));
    })
    .onEnd((e) => {
      const next = clampFraction(e.x, trackWidth.value);
      if (onSlidingComplete) runOnJS(onSlidingComplete)(valueFromFraction(next));
    });

  const fillStyle = useAnimatedStyle(() => ({ width: `${fraction.value * 100}%` }));
  const thumbStyle = useAnimatedStyle(() => ({
    left: `${fraction.value * 100}%`,
    transform: [{ translateX: -THUMB_SIZE / 2 }],
  }));

  const tickMarks = (milestones ?? []).filter((m) => m > min && m < max);

  return (
    <View>
      <Text style={[styles.value, { color: colors.textPrimary, fontFamily: font.family.monoBold }]}>
        {formatValue ? formatValue(value) : value}
      </Text>

      <GestureDetector gesture={pan}>
        <View
          style={styles.hitArea}
          onLayout={(e) => {
            trackWidth.value = e.nativeEvent.layout.width;
          }}
        >
          <View style={[styles.track, { backgroundColor: colors.bgElevated, borderWidth: borderWidth.hairline, borderColor: colors.border }]}>
            <Animated.View style={[styles.fill, fillStyle, { backgroundColor: colors.brand }]} />
          </View>
          {tickMarks.map((m) => (
            <View key={m} pointerEvents="none" style={[styles.tick, { left: `${toFraction(m) * 100}%`, backgroundColor: colors.border }]} />
          ))}
          <Animated.View
            style={[styles.thumb, thumbStyle, { backgroundColor: colors.bgCard, borderWidth: borderWidth.emphatic, borderColor: colors.border }]}
          />
        </View>
      </GestureDetector>

      {tickMarks.length > 0 ? (
        <View style={styles.milestoneRow}>
          {tickMarks.map((m) => (
            <Text
              key={m}
              style={[
                styles.milestoneLabel,
                { left: `${toFraction(m) * 100}%`, color: colors.textMuted, fontFamily: font.family.monoRegular },
              ]}
            >
              {formatValue ? formatValue(m) : m}
            </Text>
          ))}
        </View>
      ) : null}

      <View style={styles.endsRow}>
        <Text style={[styles.endLabel, { color: colors.textMuted, fontFamily: font.family.monoRegular }]}>
          {formatValue ? formatValue(min) : min}
        </Text>
        <Text style={[styles.endLabel, { color: colors.textMuted, fontFamily: font.family.monoRegular }]}>
          {formatValue ? formatValue(max) : max}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  value: {
    fontSize: 15,
    marginBottom: 12,
  },
  hitArea: {
    height: THUMB_SIZE + 8,
    justifyContent: 'center',
  },
  track: {
    height: TRACK_HEIGHT,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
  },
  thumb: {
    position: 'absolute',
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    top: 4,
  },
  tick: {
    position: 'absolute',
    width: 2,
    height: TRACK_HEIGHT + 6,
    top: -3,
  },
  milestoneRow: {
    height: 14,
    marginTop: 4,
  },
  milestoneLabel: {
    position: 'absolute',
    fontSize: 10,
    transform: [{ translateX: -12 }],
  },
  endsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  endLabel: {
    fontSize: 11,
  },
});
