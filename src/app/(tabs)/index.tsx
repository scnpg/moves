import { useCallback, useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';

import { HoverPressable } from '@/components/HoverPressable';
import { LiveMap } from '@/components/LiveMap';
import { MoveCard } from '@/components/MoveCard';
import { Screen } from '@/components/Screen';
import { SegmentedControl } from '@/components/SegmentedControl';
import { getCloseFriendIds, getReferralCount, updateMyLocation } from '@/features/friends/api';
import { getEligibleMoves } from '@/features/moves/api';
import { useLocale } from '@/i18n/LocaleProvider';
import type { EligibleMove } from '@/lib/database.types';
import { nextMilestoneLabel } from '@/lib/referrals';
import { useUserLocation } from '@/lib/useLocation';
import { useAuth } from '@/providers/AuthProvider';
import { borderWidth, color, font, radius, spacing } from '@/theme/tokens';

type Tab = 'friends' | 'public';

function isLiveNow(move: EligibleMove) {
  const now = Date.now();
  return new Date(move.starts_at).getTime() <= now && new Date(move.expires_at).getTime() > now;
}

export default function MovesScreen() {
  const { session } = useAuth();
  const { t } = useLocale();
  const router = useRouter();
  const { coords } = useUserLocation();
  const [tab, setTab] = useState<Tab>('friends');
  const [moves, setMoves] = useState<EligibleMove[]>([]);
  const [closeFriendIds, setCloseFriendIds] = useState<Set<string>>(new Set());
  const [referralCount, setReferralCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [clockLabel] = useState(() =>
    new Date().toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  );

  const load = useCallback(async () => {
    if (!session?.user) return;
    const [movesData, closeIds, referrals] = await Promise.all([
      getEligibleMoves({ userId: session.user.id, lat: coords?.lat, lng: coords?.lng }),
      getCloseFriendIds(),
      getReferralCount(session.user.id).catch(() => 0),
    ]);
    setMoves(movesData);
    setCloseFriendIds(closeIds);
    setReferralCount(referrals);
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
              <Text style={styles.subtitle}>
                {coords ? t('moves.nearby') : t('moves.allMoves')} · {clockLabel}
              </Text>
              <View style={styles.liveBadge}>
                <Text style={styles.liveBadgeText}>{liveCount} {t('moves.live')}</Text>
              </View>
            </View>

            {referralCount != null && nextMilestoneLabel(referralCount, t) ? (
              <HoverPressable onPress={() => router.push('/(tabs)/profile')} style={styles.referralBar}>
                <Text style={styles.referralBarText}>🎟 {t('moves.progress')}: {nextMilestoneLabel(referralCount, t)}</Text>
              </HoverPressable>
            ) : null}

            <LiveMap
              moves={moves}
              center={coords}
              onSelectMove={(moveId) => router.push(`/room/${moveId}`)}
            />

            <View style={styles.controlsRow}>
              <View style={styles.segmentFlex}>
                <SegmentedControl
                  segments={[
                    { value: 'friends', label: t('moves.friendsTab') },
                    { value: 'public', label: t('moves.publicTab') },
                  ]}
                  value={tab}
                  onChange={setTab}
                />
              </View>
              <HoverPressable onPress={() => router.push('/room/create')} style={styles.newButton}>
                <Text style={styles.newButtonText}>+</Text>
              </HoverPressable>
            </View>

            <View style={styles.sectionBar}>
              <Text style={styles.sectionBarText}>
                {tab === 'friends' ? t('moves.friendsMoves') : t('moves.activeNearYou')} · {filtered.length}
              </Text>
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.cardWrap}>
            <MoveCard
              move={item}
              hostIsCloseFriend={closeFriendIds.has(item.host_id)}
              onPress={() => router.push(`/room/${item.id}`)}
            />
          </View>
        )}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>
                {tab === 'friends' ? t('moves.noFriendsMoves') : t('moves.noPublicMoves')}
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
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  subtitle: {
    fontFamily: font.family.mono,
    color: color.textMuted,
    fontSize: font.size.xs,
    letterSpacing: font.tracking.wide,
  },
  liveBadge: {
    backgroundColor: color.accentGreen,
    borderWidth: borderWidth.base,
    borderColor: color.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
  },
  liveBadgeText: {
    fontFamily: font.family.mono,
    color: color.textPrimary,
    fontSize: font.size.xs,
    fontWeight: font.weight.bold,
    letterSpacing: font.tracking.label,
  },
  referralBar: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    backgroundColor: color.brandMuted,
    borderWidth: borderWidth.thin,
    borderColor: color.borderSubtle,
    borderRadius: radius.sm,
  },
  referralBarText: {
    fontFamily: font.family.mono,
    color: color.textPrimary,
    fontSize: font.size.xs,
    fontWeight: font.weight.bold,
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
    backgroundColor: color.accentBlue,
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
