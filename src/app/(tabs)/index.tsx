import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useBottomTabBarHeight } from 'expo-router/build/react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { BottomSheet } from '@/components/BottomSheet';
import { Chip } from '@/components/Chip';
import { HoverPressable } from '@/components/HoverPressable';
import { LiveMap } from '@/components/LiveMap';
import type { LiveMapHandle } from '@/components/LiveMap.types';
import { MoveCard } from '@/components/MoveCard';
import { PullToRefreshIndicator } from '@/components/PullToRefreshIndicator';
import { Screen } from '@/components/Screen';
import { SegmentedControl } from '@/components/SegmentedControl';
import { Slider } from '@/components/Slider';
import { getCloseFriendIds, getFriendOfFriendIds, getMyFriends, getReferralCount } from '@/features/friends/api';
import { getEligibleMoves } from '@/features/moves/api';
import { useLocale } from '@/i18n/LocaleProvider';
import type { EligibleMove } from '@/lib/database.types';
import { formatRadius } from '@/lib/format';
import { usePullToRefresh } from '@/lib/usePullToRefresh';
import { nextMilestoneLabel } from '@/lib/referrals';
import { useUserLocation } from '@/lib/useLocation';
import { useAuth } from '@/providers/AuthProvider';
import { useTheme } from '@/theme/ThemeProvider';

type Tab = 'friends' | 'public';

// Chrome heights this screen doesn't directly control (AppHeader is a
// sibling rendered in _layout.tsx, the tab bar in (tabs)/_layout.tsx) - used
// to size the map area from useWindowDimensions() instead of onLayout,
// which doesn't fire reliably for a flex:1 View on web in this RN/RNW
// version. Approximate but stable; doesn't need to be pixel-exact since the
// bottom sheet's snap points are fractions of whatever this resolves to.
const APP_HEADER_HEIGHT = 42; // + insets.top, added separately below
const TOP_BAR_HEIGHT = 40;
const REFERRAL_BAR_HEIGHT = 40;

const MILES_TO_METERS = 1609.34;
const MIN_RADIUS_MILES = 0.5;
const MAX_RADIUS_MILES = 100;
const DEFAULT_RADIUS_MILES = 25;
const RADIUS_MILESTONES = [2, 50];
// Recenter button size (44) + comfortable margins above the sheet and below
// the map's top edge - below this much visible map, there's no room to float
// the button without it crowding the sheet handle or the map's own chrome.
const MIN_VISIBLE_MAP_FOR_RECENTER = 120;

function isLiveNow(move: EligibleMove) {
  const now = Date.now();
  return new Date(move.starts_at).getTime() <= now && new Date(move.expires_at).getTime() > now;
}

export default function MovesScreen() {
  const { session } = useAuth();
  const { t } = useLocale();
  const router = useRouter();
  const { coords } = useUserLocation();
  const { colors, border, font, unitSystem } = useTheme();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const { height: windowHeight } = useWindowDimensions();
  const [tab, setTab] = useState<Tab>('friends');
  // radiusMiles drives the slider's live label while dragging; fetchRadiusMiles
  // only updates when the drag ends, so the network refetch effect below
  // (keyed on fetchRadiusMiles) doesn't fire on every intermediate frame.
  const [radiusMiles, setRadiusMiles] = useState(DEFAULT_RADIUS_MILES);
  const [fetchRadiusMiles, setFetchRadiusMiles] = useState(DEFAULT_RADIUS_MILES);
  const [moves, setMoves] = useState<EligibleMove[]>([]);
  const [friendIds, setFriendIds] = useState<Set<string>>(new Set());
  const [friendOfFriendCounts, setFriendOfFriendCounts] = useState<Map<string, number>>(new Map());
  const [closeFriendIds, setCloseFriendIds] = useState<Set<string>>(new Set());
  const [referralCount, setReferralCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [clockLabel] = useState(() =>
    new Date().toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  );
  const mapRef = useRef<LiveMapHandle>(null);
  // Tracks the bottom sheet's live height so the recenter button can sit
  // just above its moving top edge instead of the map area's fixed bottom.
  const [sheetHeight, setSheetHeight] = useState(0);

  const load = useCallback(async () => {
    if (!session?.user) return;
    const [movesData, friends, fofCounts, closeIds, referrals] = await Promise.all([
      getEligibleMoves({
        userId: session.user.id,
        lat: coords?.lat,
        lng: coords?.lng,
        radiusM: Math.round(fetchRadiusMiles * MILES_TO_METERS),
      }),
      getMyFriends().catch(() => []),
      getFriendOfFriendIds().catch(() => new Map<string, number>()),
      getCloseFriendIds(),
      getReferralCount(session.user.id).catch(() => 0),
    ]);
    setMoves(movesData);
    setFriendIds(new Set(friends.map((f) => f.id)));
    setFriendOfFriendCounts(fofCounts);
    setCloseFriendIds(closeIds);
    setReferralCount(referrals);
  }, [session?.user, coords, fetchRadiusMiles]);

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

  // Refetch when the radius slider settles on a new value - separate from
  // useFocusEffect above since that only fires on focus/blur transitions,
  // not on every change to `load`'s own dependencies while already focused.
  const isFirstRadiusChange = useRef(true);
  useEffect(() => {
    if (isFirstRadiusChange.current) {
      isFirstRadiusChange.current = false;
      return;
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchRadiusMiles]);

  // Snap the map back to the viewer's location on every Friends/Public
  // switch - browsing pins on one tab shouldn't leave the map panned away
  // when the other tab's (differently filtered) pins come in.
  const isFirstTabChange = useRef(true);
  useEffect(() => {
    if (isFirstTabChange.current) {
      isFirstTabChange.current = false;
      return;
    }
    mapRef.current?.recenter();
  }, [tab]);

  const { scrollRef, scrollHandler, openAmount, progress, refreshing, reservedHeight } = usePullToRefresh({ onRefresh: load, threshold: 70 });
  const reservedSpaceStyle = useAnimatedStyle(() => ({ height: reservedHeight.value }));

  const liveCount = useMemo(() => moves.filter(isLiveNow).length, [moves]);

  const filtered = moves
    .filter((m) => {
      // A Public Move hosted by a friend (or a friend-of-friend) is still
      // "connected to you" - the Friends tab isn't just "moves with a
      // friends-only degree", it's "moves connected to your social graph".
      // Without these checks, a friend's or FoF's public Move would only
      // ever show under Public.
      const hostIsFriend = friendIds.has(m.host_id);
      const hostIsFriendOfFriend = friendOfFriendCounts.has(m.host_id);
      return tab === 'friends'
        ? m.degree_limit !== 3 || hostIsFriend || hostIsFriendOfFriend
        : m.degree_limit === 3 && !hostIsFriend && !hostIsFriendOfFriend;
    })
    .sort((a, b) => {
      // Nearest first on both tabs now that Friends isn't radius-filtered
      // server-side (see get_eligible_moves_for_user) - a friend's Move on
      // the other side of the country still shows, it just sorts to the
      // bottom instead of being hidden outright.
      if (a.distance_m != null && b.distance_m != null) {
        return a.distance_m - b.distance_m;
      }
      return new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime();
    });

  const showReferralBar = referralCount != null && !!nextMilestoneLabel(referralCount, t);
  const mapHeight = Math.max(
    300,
    windowHeight -
      insets.top -
      APP_HEADER_HEIGHT -
      TOP_BAR_HEIGHT -
      (showReferralBar ? REFERRAL_BAR_HEIGHT : 0) -
      tabBarHeight
  );

  return (
    <Screen style={styles.noPadding}>
      <View style={styles.topBar}>
        <Text style={[styles.subtitle, { color: colors.textMuted, fontFamily: font.family.monoRegular }]}>
          {coords ? t('moves.nearby') : t('moves.allMoves')} · {clockLabel}
        </Text>
        <Chip label={liveCount > 0 ? `${liveCount} ${t('moves.live')}` : t('moves.noneLive')} variant={liveCount > 0 ? 'live' : 'default'} />
      </View>

      {showReferralBar ? (
        <HoverPressable
          onPress={() => router.push('/(tabs)/profile')}
          style={[styles.referralBar, { backgroundColor: colors.brandMuted, borderWidth: border.soft.width, borderColor: border.soft.color }]}
        >
          <Text style={[styles.referralBarText, { color: colors.textPrimary, fontFamily: font.family.monoBold }]}>
            🎟 {t('moves.progress')}: {nextMilestoneLabel(referralCount, t)}
          </Text>
        </HoverPressable>
      ) : null}

      <View style={[styles.mapArea, { height: mapHeight }]}>
        <LiveMap
          ref={mapRef}
          moves={moves}
          center={coords}
          onSelectMove={(moveId) => router.push(`/room/${moveId}`)}
          radiusMiles={tab === 'public' ? radiusMiles : null}
          fitRadiusMiles={tab === 'public' ? fetchRadiusMiles : null}
          mapHeight={mapHeight}
          obscuredBottom={sheetHeight}
        />

        {coords && mapHeight - sheetHeight >= MIN_VISIBLE_MAP_FOR_RECENTER ? (
          <HoverPressable
            onPress={() => mapRef.current?.recenter()}
            style={[
              styles.recenterButton,
              { bottom: sheetHeight + 12, backgroundColor: colors.bgCard, borderWidth: border.rest.width, borderColor: colors.border },
            ]}
            lightenOpacity={0.25}
          >
            <Text style={[styles.recenterIcon, { color: colors.textPrimary }]}>◎</Text>
          </HoverPressable>
        ) : null}

        <BottomSheet containerHeight={mapHeight} defaultSnap="half" onHeightChange={setSheetHeight}>
          <View style={styles.listWrap}>
            <PullToRefreshIndicator openAmount={openAmount} progress={progress} refreshing={refreshing} />
            <Animated.View style={reservedSpaceStyle} />
            <Animated.FlatList
              ref={scrollRef}
              data={filtered}
              keyExtractor={(item) => item.id}
              onScroll={scrollHandler}
              scrollEventThrottle={1}
              bounces
              alwaysBounceVertical
              overScrollMode="always"
              contentContainerStyle={styles.listContent}
              ListHeaderComponent={
                <View style={styles.segmentWrap}>
                  <SegmentedControl
                    segments={[
                      { value: 'friends', label: t('moves.friendsTab') },
                      { value: 'public', label: t('moves.publicTab') },
                    ]}
                    value={tab}
                    onChange={setTab}
                  />
                  {tab === 'public' ? (
                    <View style={styles.radiusWrap}>
                      <Text style={[styles.radiusLabel, { color: colors.textMuted, fontFamily: font.family.monoBold }]}>
                        {t('moves.searchRadius')}
                      </Text>
                      <Slider
                        min={MIN_RADIUS_MILES}
                        max={MAX_RADIUS_MILES}
                        value={radiusMiles}
                        onChange={setRadiusMiles}
                        onSlidingComplete={setFetchRadiusMiles}
                        formatValue={(v) => formatRadius(v, unitSystem, t)}
                        milestones={RADIUS_MILESTONES}
                      />
                    </View>
                  ) : null}
                </View>
              }
              renderItem={({ item }) => (
                <View style={styles.cardWrap}>
                  <MoveCard
                    move={item}
                    hostIsCloseFriend={closeFriendIds.has(item.host_id)}
                    hostIsFriend={friendIds.has(item.host_id)}
                    friendOfFriendCount={friendOfFriendCounts.get(item.host_id)}
                    onPress={() => router.push(`/room/${item.id}`)}
                  />
                </View>
              )}
              ListEmptyComponent={
                !loading ? (
                  <View style={styles.empty}>
                    <Text style={[styles.emptyTitle, { color: colors.textPrimary, fontFamily: font.family.heroDisplay }]}>
                      {t('moves.nothingYet')}
                    </Text>
                    <Text style={[styles.emptyText, { color: colors.textSecondary, fontFamily: font.family.bodyRegular }]}>
                      {tab === 'friends' ? t('moves.noFriendsMoves') : t('moves.noPublicMoves')}
                    </Text>
                  </View>
                ) : null
              }
            />
          </View>
        </BottomSheet>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  noPadding: {
    padding: 0,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  subtitle: {
    fontSize: 11,
    letterSpacing: 0.9,
  },
  referralBar: {
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  referralBarText: {
    fontSize: 11,
  },
  mapArea: {
    position: 'relative',
  },
  recenterButton: {
    position: 'absolute',
    right: 12,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  } as object,
  recenterIcon: {
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 20,
  },
  listWrap: {
    flex: 1,
    position: 'relative',
  },
  segmentWrap: {
    paddingBottom: 12,
  },
  radiusWrap: {
    paddingTop: 16,
    paddingHorizontal: 4,
  },
  radiusLabel: {
    fontSize: 11,
    letterSpacing: 0.9,
    marginBottom: 10,
  },
  cardWrap: {
    paddingBottom: 12,
  },
  listContent: {
    paddingBottom: 24,
  },
  empty: {
    paddingTop: 32,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 40,
    lineHeight: 40,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 12,
  },
});
