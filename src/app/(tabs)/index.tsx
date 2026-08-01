import { useCallback, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';

import { Button } from '@/components/Button';
import { MoveCard } from '@/components/MoveCard';
import { Screen } from '@/components/Screen';
import { SegmentedControl } from '@/components/SegmentedControl';
import { getCloseFriendIds } from '@/features/friends/api';
import { getEligibleMoves } from '@/features/moves/api';
import type { EligibleMove } from '@/lib/database.types';
import { useUserLocation } from '@/lib/useLocation';
import { useAuth } from '@/providers/AuthProvider';
import { color, font, spacing } from '@/theme/tokens';

type Tab = 'friends' | 'public';

export default function MovesScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const { coords } = useUserLocation();
  const [tab, setTab] = useState<Tab>('friends');
  const [moves, setMoves] = useState<EligibleMove[]>([]);
  const [closeFriendIds, setCloseFriendIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Moves</Text>
        <Button label="+ New" onPress={() => router.push('/moves/create')} style={styles.newButton} />
      </View>

      <View style={styles.segmentWrapper}>
        <SegmentedControl
          segments={[
            { value: 'friends', label: 'Friends' },
            { value: 'public', label: 'Public' },
          ]}
          value={tab}
          onChange={setTab}
        />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={color.brand} />
        }
        renderItem={({ item }) => (
          <MoveCard
            move={item}
            hostIsCloseFriend={closeFriendIds.has(item.host_id)}
            onPress={() => router.push(`/moves/${item.id}`)}
          />
        )}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  headerTitle: {
    fontSize: font.size.xl,
    fontWeight: font.weight.bold,
    color: color.textPrimary,
  },
  newButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  segmentWrapper: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  empty: {
    paddingTop: spacing.xxl,
    alignItems: 'center',
  },
  emptyText: {
    color: color.textMuted,
    fontSize: font.size.sm,
    textAlign: 'center',
  },
});
