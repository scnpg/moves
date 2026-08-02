import { Image, StyleSheet, Text, View } from 'react-native';

import { borderWidth, color, degreeColor, font, neonPalette, radius } from '@/theme/tokens';

interface AvatarProps {
  uri?: string | null;
  name?: string | null;
  size?: number;
  /** Yellow ring: this person is one of the *viewer's* close friends. */
  closeFriend?: boolean;
  /** Green pulse dot: this person currently hosts an active Move. */
  hosting?: boolean;
  /** Cycles through the accent palette instead of the fixed brand tint. */
  tint?: 1 | 2 | 3;
}

function fallbackTint(name?: string | null): string {
  if (!name) return neonPalette[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return neonPalette[hash % neonPalette.length];
}

export function Avatar({ uri, name, size = 44, closeFriend, hosting, tint }: AvatarProps) {
  const initial = (name ?? '?').trim().charAt(0).toUpperCase();
  const ringWidth = closeFriend ? borderWidth.base : 0;
  const outerSize = size + ringWidth * 2;
  const bgColor = tint ? degreeColor[tint] : fallbackTint(name);

  return (
    <View
      style={[
        styles.ring,
        {
          width: outerSize,
          height: outerSize,
          borderRadius: radius.md,
          borderWidth: ringWidth,
          borderColor: closeFriend ? color.closeFriend : 'transparent',
        },
      ]}
    >
      {uri ? (
        <Image source={{ uri }} style={{ width: size, height: size, borderRadius: radius.sm }} />
      ) : (
        <View
          style={[
            styles.fallback,
            { width: size, height: size, borderRadius: radius.sm, backgroundColor: bgColor },
          ]}
        >
          <Text style={[styles.initial, { fontSize: size * 0.42 }]}>{initial}</Text>
        </View>
      )}
      {hosting ? (
        <View
          style={[
            styles.pulseDot,
            { width: size * 0.3, height: size * 0.3, borderRadius: radius.sm * 0.75 },
          ]}
        />
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
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: borderWidth.thin,
    borderColor: color.border,
  },
  initial: {
    color: color.textPrimary,
    fontWeight: font.weight.heavy,
  },
  pulseDot: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    backgroundColor: color.accentGreen,
    borderWidth: borderWidth.thin,
    borderColor: color.border,
  },
});
