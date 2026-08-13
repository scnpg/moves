import { View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface CircularProgressProps {
  /** 0-1 fill amount while dragging - ignored once `spinning` is true. */
  progress: SharedValue<number>;
  /** Locks the ring into an indeterminate, continuously-rotating arc (the active-refresh state). */
  spinning: SharedValue<boolean>;
  size?: number;
  strokeWidth?: number;
  color: string;
  trackColor: string;
}

// How much of the ring stays visible while spinning indeterminately - a full,
// unbroken circle wouldn't read as "moving" once rotation kicks in.
const SPIN_ARC_FRACTION = 0.75;
// Exported so usePullToRefresh can time the stop to land on a lap boundary -
// withRepeat resets this animation to 0 at the start of every lap (see its
// source), so stopping exactly on a multiple of this duration means the ring
// is already back at its 0deg resting position with nothing to unwind.
export const SPIN_DURATION = 900;

export function CircularProgress({ progress, spinning, size = 28, strokeWidth = 3, color, trackColor }: CircularProgressProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const rotation = useSharedValue(0);

  // Starts/stops the continuous spin as a side effect of `spinning` flipping,
  // rather than inside useAnimatedStyle - reading and rewriting the same
  // shared value from within its own style computation would self-trigger.
  useAnimatedReaction(
    () => spinning.value,
    (isSpinning, wasSpinning) => {
      if (isSpinning === wasSpinning) return;
      if (isSpinning) {
        rotation.value = 0;
        rotation.value = withRepeat(withTiming(360, { duration: SPIN_DURATION, easing: Easing.linear }), -1, false);
      } else {
        rotation.value = withTiming(0, { duration: 150 });
      }
    },
    []
  );

  const wheelStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const progressProps = useAnimatedProps(() => {
    const fraction = spinning.value ? SPIN_ARC_FRACTION : progress.value;
    return { strokeDashoffset: circumference * (1 - fraction) };
  });

  return (
    <View style={{ width: size, height: size }}>
      <Animated.View style={wheelStyle}>
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <Circle cx={size / 2} cy={size / 2} r={radius} stroke={trackColor} strokeWidth={strokeWidth} fill="none" />
          <AnimatedCircle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={color}
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={circumference}
            strokeLinecap="round"
            rotation={-90}
            origin={`${size / 2}, ${size / 2}`}
            animatedProps={progressProps}
          />
        </Svg>
      </Animated.View>
    </View>
  );
}
