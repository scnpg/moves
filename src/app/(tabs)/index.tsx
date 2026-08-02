import { useCallback, useMemo, useState } from 'react';
import { FlatList, Platform, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';

import { MoveCard } from '@/components/MoveCard';
import { Screen } from '@/components/Screen';
import { SegmentedControl } from '@/components/SegmentedControl';
import { SunburstBackdrop } from '@/components/Streamline';
import { getCloseFriendIds } from '@/features/friends/api';
import { getEligibleMoves } from '@/features/moves/api';
import type { EligibleMove } from '@/lib/database.types';
import { useUserLocation } from '@/lib/useLocation';
import { useAuth } from '@/providers/AuthProvider';
import { borderWidth, color, degreeColor, font, radius, spacing } from '@/theme/tokens';

type Tab = 'friends' | 'public';

function isLiveNow(move: EligibleMove) {
  const now = Date.now();
  return new Date(move.starts_at).getTime() <= now && new Date(move.expires_at).getTime() > now;
}

function pinPosition(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return { left: `${12 + (hash % 76)}%`, top: `${18 + ((hash >> 8) % 55)}%` };
}

export default function MovesScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const { coords } = useUserLocation();
  const [tab, setTab] = useState<Tab>('friends');
  const [moves, setMoves] = useState<EligibleMove[]>([]);
  const [closeFriendIds, setCloseFriendIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [clockLabel] = useState(() =>
    new Date().toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  );

  const load = useCallback(async () => {
    if (!session?.user) return;
    const [movesData, closeIds] = await Promise.all([
      getEligibleMoves({ userId: session.user.id, lat: coords?.lat, lng: coords?.lng }),
      getCloseFriendIds(),
    ]);
    setMoves(movesData);
    setCloseFriendIds(closeIds);
  }, [session?.user, coords]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      load().finally(() => {
        if (!cancelled) setLoading(false);
      });
      return () => {
        cancelled = true;
      };
    }, [load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const liveCount = useMemo(() => moves.filter(isLiveNow).length, [moves]);

  const filtered = moves
    .filter((m) => (tab === 'friends' ? m.degree_limit !== 3 : m.degree_limit === 3))
    .sort((a, b) => {
      if (tab === 'public' && a.distance_m != null && b.distance_m != null) {
        return a.distance_m - b.distance_m;
      }
      return new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime();
    });

  const mapPins = moves.slice(0, 8);

  return (
    <Screen>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={color.brand} />
        }
        ListHeaderComponent={
          <View>
            <View style={styles.topBar}>
              <View style={styles.logoWrap}>
                <SunburstBackdrop />
                <Text style={styles.logo}>MOVES?</Text>
                <Text style={styles.subtitle}>
                  {coords ? 'NEARBY' : 'ALL MOVES'} · {clockLabel}
                </Text>
              </View>
              <View style={styles.liveBadge}>
                <Text style={styles.liveBadgeText}>{liveCount} LIVE</Text>
              </View>
            </View>

            <View style={styles.mapPanel}>
              <Text style={styles.mapLabel}>LIVE MAP</Text>
              {mapPins.map((move) => {
                const pos = pinPosition(move.id);
                const dotColor = degreeColor[move.degree_limit];
                return (
                  <View key={move.id} style={[styles.pinWrap, pos as object]}>
                    {isLiveNow(move) ? (
                      <View style={[styles.pinRing, { borderColor: dotColor }]} />
                    ) : null}
                    <View style={[styles.pinDot, { backgroundColor: dotColor }]} />
                  </View>
                );
              })}
            </View>

            <View style={styles.controlsRow}>
              <View style={styles.segmentFlex}>
                <SegmentedControl
                  segments={[
                    { value: 'friends', label: 'Friends' },
                    { value: 'public', label: 'Public' },
                  ]}
                  value={tab}
                  onChange={setTab}
                />
              </View>
              <Pressable onPress={() => router.push('/moves/create')} style={styles.newButton}>
                <Text style={styles.newButtonText}>+</Text>
              </Pressable>
            </View>

            <View style={styles.sectionBar}>
              <Text style={styles.sectionBarText}>
                {tab === 'friends' ? "FRIENDS' MOVES" : 'ACTIVE NEAR YOU'} · {filtered.length}
              </Text>
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.cardWrap}>
            <MoveCard
              move={item}
              hostIsCloseFriend={closeFriendIds.has(item.host_id)}
              onPress={() => router.push(`/moves/${item.id}`)}
            />
          </View>
        )}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>
                {tab === 'friends'
                  ? 'No Moves from your friends right now.'
                  : 'No public Moves nearby right now.'}
              </Text>
            </View>
          ) : null
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  logoWrap: {
    position: 'relative',
    overflow: 'hidden',
  },
  logo: {
    fontFamily: font.family.logo,
    fontSize: font.size.hero,
    color: color.textPrimary,
    lineHeight: font.size.hero + 2,
  },
  subtitle: {
    fontFamily: font.family.mono,
    color: color.textMuted,
    fontSize: font.size.xs,
    letterSpacing: font.tracking.wide,
    marginTop: 2,
  },
  liveBadge: {
    backgroundColor: color.accentGreen,
    borderWidth: borderWidth.base,
    borderColor: color.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    marginTop: 4,
  },
  liveBadgeText: {
    fontFamily: font.family.mono,
    color: color.textPrimary,
    fontSize: font.size.xs,
    fontWeight: font.weight.bold,
    letterSpacing: font.tracking.label,
  },
  mapPanel: {
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
    ...(Platform.OS === 'web'
      ? ({
          backgroundImage:
            'linear-gradient(#E1E1E1 1px, transparent 1px), linear-gradient(90deg, #E1E1E1 1px, transparent 1px)',
          backgroundSize: '20px 20px',
        } as object)
      : null),
  },
  mapLabel: {
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
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  segmentFlex: {
    flex: 1,
  },
  newButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.brand,
    borderWidth: borderWidth.base,
    borderColor: color.border,
    borderRadius: radius.sm,
  },
  newButtonText: {
    color: color.textPrimary,
    fontSize: font.size.xl,
    fontWeight: font.weight.heavy,
    lineHeight: font.size.xl,
  },
  sectionBar: {
    backgroundColor: color.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
  },
  sectionBarText: {
    fontFamily: font.family.mono,
    color: color.textInverse,
    fontSize: font.size.xs,
    fontWeight: font.weight.bold,
    letterSpacing: font.tracking.wide,
  },
  cardWrap: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  listContent: {
    paddingBottom: spacing.xl,
  },
  empty: {
    paddingTop: spacing.xxl,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  emptyText: {
    color: color.textMuted,
    fontSize: font.size.sm,
    textAlign: 'center',
  },
});
