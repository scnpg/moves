import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { Button } from '@/components/Button';
import { useLocale } from '@/i18n/LocaleProvider';
import { useTheme } from '@/theme/ThemeProvider';

const PIN_PATH =
  'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zM12 11.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z';

function PinIcon({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d={PIN_PATH} fill={color} />
    </Svg>
  );
}

/** A single expanding-and-fading ring, offset in time via `delay` so a pair of them reads as a continuous outward pulse rather than two rings ticking in lockstep. */
function PulseRing({ color, delay }: { color: string; delay: number }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: 2200, easing: Easing.out(Easing.ease) }), -1, false);
  }, [progress]);

  const style = useAnimatedStyle(() => {
    'worklet';
    const t = (progress.value + delay) % 1;
    return {
      opacity: (1 - t) * 0.5,
      transform: [{ scale: 1 + t * 1.15 }],
    };
  });

  return <Animated.View pointerEvents="none" style={[styles.ring, { borderColor: color }, style]} />;
}

interface LocationRequiredScreenProps {
  loading: boolean;
  denied: boolean;
  onRetry: () => void;
}

/**
 * Full-screen block shown in place of the tab UI whenever a signed-in user
 * has no resolved location - Moves is a location-first app (nearby feed,
 * map centering, Move creation), so there's no useful degraded mode to fall
 * back to instead of just asking again.
 */
export function LocationRequiredScreen({ loading, denied, onRetry }: LocationRequiredScreenProps) {
  const { t } = useLocale();
  const { colors, font } = useTheme();

  const badgeColor = denied ? colors.textMuted : colors.brand;

  return (
    <View style={[styles.wrap, { backgroundColor: colors.bg }]}>
      <View style={styles.badgeWrap}>
        {!denied && loading ? (
          <>
            <PulseRing color={colors.brand} delay={0} />
            <PulseRing color={colors.brand} delay={0.5} />
          </>
        ) : null}
        <View style={[styles.badge, { backgroundColor: denied ? colors.bgElevated : colors.brandMuted, borderColor: badgeColor }]}>
          <PinIcon size={30} color={badgeColor} />
        </View>
      </View>

      <Text style={[styles.title, { color: colors.textPrimary, fontFamily: font.family.heroDisplay }]}>
        {!denied && loading ? t('locationGate.locatingTitle') : t('locationGate.title')}
      </Text>
      <Text style={[styles.body, { color: colors.textSecondary, fontFamily: font.family.bodyRegular }]}>
        {denied ? t('locationGate.deniedBody') : loading ? t('locationGate.locatingBody') : t('locationGate.body')}
      </Text>

      {!loading || denied ? <Button label={t('locationGate.enableButton')} onPress={onRetry} style={styles.button} /> : null}
    </View>
  );
}

const RING_SIZE = 88;

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 10,
  },
  badgeWrap: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  ring: {
    position: 'absolute',
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    borderWidth: 1.5,
  },
  badge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 22,
    textAlign: 'center',
  },
  body: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 300,
    marginBottom: 8,
  },
  button: {
    marginTop: 8,
    minWidth: 200,
  } as object,
});
