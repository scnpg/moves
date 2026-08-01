import { Image, StyleSheet, Text, View } from 'react-native';

import { color, font } from '@/theme/tokens';

interface AvatarProps {
  uri?: string | null;
  name?: string | null;
  size?: number;
  /** Gold ring: this person is one of the *viewer's* close friends. */
  closeFriend?: boolean;
  /** Green dot: this person currently hosts an active Move. */
  hosting?: boolean;
}

export function Avatar({ uri, name, size = 44, closeFriend, hosting }: AvatarProps) {
  const initial = (name ?? '?').trim().charAt(0).toUpperCase();
  const ringWidth = closeFriend ? 2.5 : 0;
  const outerSize = size + ringWidth * 2;

  return (
    <View
      style={[
        styles.ring,
        {
          width: outerSize,
          height: outerSize,
          borderRadius: outerSize / 2,
          borderWidth: ringWidth,
          borderColor: closeFriend ? color.closeFriend : 'transparent',
        },
      ]}
    >
      {uri ? (
        <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} />
      ) : (
        <View
          style={[
            styles.fallback,
            { width: size, height: size, borderRadius: size / 2 },
          ]}
        >
          <Text style={[styles.initial, { fontSize: size * 0.4 }]}>{initial}</Text>
        </View>
      )}
      {hosting ? (
        <View style={[styles.pulseDot, { width: size * 0.28, height: size * 0.28, borderRadius: size * 0.14 }]} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  ring: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallback: {
    backgroundColor: color.brandMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: {
    color: color.textPrimary,
    fontWeight: font.weight.bold,
  },
  pulseDot: {
    position: 'absolute',
    right: -1,
    bottom: -1,
    backgroundColor: color.success,
    borderWidth: 2,
    borderColor: color.bg,
  },
});
