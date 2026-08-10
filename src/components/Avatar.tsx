import { Image, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

interface AvatarProps {
  uri?: string | null;
  name?: string | null;
  size?: number;
  /** Yellow ring: this person is one of the *viewer's* close friends. */
  closeFriend?: boolean;
  /** Green pulse dot: this person currently hosts an active Move. */
  hosting?: boolean;
  /** Cycles through the accent palette instead of the fixed brand tint. */
  tint?: 0 | 1 | 2 | 3 | 4;
}

function fallbackTint(neonPalette: readonly string[], name?: string | null): string {
  if (!name) return neonPalette[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return neonPalette[hash % neonPalette.length];
}

/** Square, not circular - a deliberate brutalist-design choice, not a rounding oversight. */
export function Avatar({ uri, name, size = 44, closeFriend, hosting, tint }: AvatarProps) {
  const { colors, signal, borderWidth, font } = useTheme();
  const initial = (name ?? '?').trim().charAt(0).toUpperCase();
  const ringWidth = closeFriend ? borderWidth.structural : 0;
  const outerSize = size + ringWidth * 2;
  const bgColor = tint !== undefined ? signal.degree[tint] : fallbackTint(signal.neonPalette, name);

  return (
    <View
      style={[
        styles.ring,
        {
          width: outerSize,
          height: outerSize,
          borderWidth: ringWidth,
          borderColor: closeFriend ? colors.closeFriend : 'transparent',
        },
      ]}
    >
      {uri ? (
        <Image source={{ uri }} style={{ width: size, height: size }} />
      ) : (
        <View style={[styles.fallback, { width: size, height: size, backgroundColor: bgColor, borderColor: colors.border, borderWidth: borderWidth.hairline }]}>
          <Text style={[styles.initial, { fontSize: size * 0.42, color: colors.onAccent, fontFamily: font.family.monoBold }]}>{initial}</Text>
        </View>
      )}
      {hosting ? (
        <View style={[styles.pulseDot, { width: size * 0.3, height: size * 0.3, backgroundColor: colors.brand, borderColor: colors.border, borderWidth: borderWidth.hairline }]} />
      ) : null}
    </View>
  );
}

interface AvatarStackItem {
  src?: string;
  alt: string;
}

/** Overlapping row of square avatars with an optional "+N" overflow tile. */
export function AvatarStack({
  avatars,
  size = 32,
  overflow = 0,
  max = 4,
}: {
  avatars: AvatarStackItem[];
  size?: number;
  overflow?: number;
  max?: number;
}) {
  const { colors, borderWidth, font } = useTheme();
  const shown = avatars.slice(0, max);
  const overlap = -Math.round(size * 0.35);

  return (
    <View style={styles.stackRow}>
      {shown.map((a, i) => (
        <View key={i} style={[i > 0 && { marginLeft: overlap }, { zIndex: shown.length - i }]}>
          <Avatar uri={a.src} name={a.alt} size={size} />
        </View>
      ))}
      {overflow > 0 ? (
        <View
          style={[
            styles.overflowTile,
            {
              marginLeft: overlap,
              height: size * 0.85,
              paddingHorizontal: 10,
              backgroundColor: colors.bgCard,
              borderColor: colors.border,
              borderWidth: borderWidth.hairline,
            },
          ]}
        >
          <Text style={[styles.overflowText, { color: colors.textPrimary, fontFamily: font.family.monoBold }]}>+{overflow}</Text>
        </View>
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
  },
  initial: {
    fontWeight: '700',
  },
  pulseDot: {
    position: 'absolute',
    right: -2,
    bottom: -2,
  },
  stackRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  overflowTile: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
  },
  overflowText: {
    fontSize: 11,
    letterSpacing: 0.8,
  },
});
