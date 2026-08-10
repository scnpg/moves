import { forwardRef, useImperativeHandle, type ForwardedRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { LiveMapHandle } from '@/components/LiveMap.types';
import { useLocale } from '@/i18n/LocaleProvider';
import type { EligibleMove } from '@/lib/database.types';
import { useTheme } from '@/theme/ThemeProvider';

interface LiveMapProps {
  moves: EligibleMove[];
  center: { lat: number; lng: number } | null;
  onSelectMove: (moveId: string) => void;
  /** Web-only (LiveMap.web.tsx draws a real geographic coverage bubble) - accepted here just to keep props identical across platforms; this decorative fallback has no real coordinates to draw one against. */
  radiusMiles?: number | null;
  fitRadiusMiles?: number | null;
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
function LiveMapImpl({ moves, onSelectMove }: LiveMapProps, ref: ForwardedRef<LiveMapHandle>) {
  const { t } = useLocale();
  const { colors, border, signal, font, map } = useTheme();
  const pins = moves.slice(0, 8);

  // Decorative, non-geographic panel (see file doc below) - there's no real
  // pan/zoom state to reset, so recenter() is a harmless no-op. Exists so
  // callers can hold one LiveMapHandle type across both platforms.
  useImperativeHandle(ref, () => ({ recenter: () => {} }), []);

  return (
    <View style={[styles.panel, { backgroundColor: map.bg }]}>
      <Text style={[styles.label, { color: colors.textMuted, fontFamily: font.family.monoBold }]}>{t('liveMap.label')}</Text>
      {pins.map((move) => {
        const pos = pinPosition(move.id);
        const dotColor = signal.degree[move.degree_limit];
        return (
          <Pressable
            key={move.id}
            onPress={() => onSelectMove(move.id)}
            style={[styles.pinWrap, pos as object]}
          >
            {isLiveNow(move) ? <View style={[styles.pinRing, { borderColor: dotColor }]} /> : null}
            <View style={[styles.pinDot, { backgroundColor: dotColor, borderColor: colors.border, borderWidth: border.rest.width }]} />
          </Pressable>
        );
      })}
    </View>
  );
}

export const LiveMap = forwardRef(LiveMapImpl);

const styles = StyleSheet.create({
  panel: {
    flex: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 11,
    letterSpacing: 0.9,
  },
  pinWrap: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinDot: {
    width: 12,
    height: 12,
  },
  pinRing: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    opacity: 0.5,
  },
});
