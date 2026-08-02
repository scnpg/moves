import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { EligibleMove } from '@/lib/database.types';
import { borderWidth, color, degreeColor, font, radius, spacing } from '@/theme/tokens';

interface LiveMapProps {
  moves: EligibleMove[];
  center: { lat: number; lng: number } | null;
  onSelectMove: (moveId: string) => void;
}

function isLiveNow(move: EligibleMove) {
  const now = Date.now();
  return new Date(move.starts_at).getTime() <= now && new Date(move.expires_at).getTime() > now;
}

function pinPosition(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return { left: `${12 + (hash % 76)}%`, top: `${18 + ((hash >> 8) % 55)}%` };
}

/**
 * Native fallback: this project has no native map library wired up (no
 * react-native-maps / API keys configured), so this stays a decorative,
 * non-geographic panel rather than pretending to be a real map. The web
 * build gets a genuine interactive map - see LiveMap.web.tsx, which Metro
 * picks automatically on that platform.
 */
export function LiveMap({ moves, onSelectMove }: LiveMapProps) {
  const pins = moves.slice(0, 8);

  return (
    <View style={styles.panel}>
      <Text style={styles.label}>LIVE MAP</Text>
      {pins.map((move) => {
        const pos = pinPosition(move.id);
        const dotColor = degreeColor[move.degree_limit];
        return (
          <Pressable
            key={move.id}
            onPress={() => onSelectMove(move.id)}
            style={[styles.pinWrap, pos as object]}
          >
            {isLiveNow(move) ? <View style={[styles.pinRing, { borderColor: dotColor }]} /> : null}
            <View style={[styles.pinDot, { backgroundColor: dotColor }]} />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    height: 160,
    backgroundColor: color.bgElevated,
    borderWidth: borderWidth.base,
    borderColor: color.border,
    borderRadius: radius.md,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontFamily: font.family.mono,
    color: color.textMuted,
    fontSize: font.size.xs,
    fontWeight: font.weight.bold,
    letterSpacing: font.tracking.wide,
  },
  pinWrap: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: borderWidth.thin,
    borderColor: color.border,
  },
  pinRing: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: borderWidth.thin,
    opacity: 0.5,
  },
});
