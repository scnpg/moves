import { useCallback, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';

import { MoveCard } from '@/components/MoveCard';
import { Screen } from '@/components/Screen';
import { getCloseFriendIds } from '@/features/friends/api';
import { getMyOptedInMoves } from '@/features/moves/api';
import { useLocale } from '@/i18n/LocaleProvider';
import type { EligibleMove } from '@/lib/database.types';
import { useAuth } from '@/providers/AuthProvider';
import { useTheme } from '@/theme/ThemeProvider';

/** "Moves" tab - active Moves the viewer is hosting or an approved member of, as opposed to the Feed tab's full discovery list. */
export default function MyMovesScreen() {
  const { session } = useAuth();
  const { t } = useLocale();
  const router = useRouter();
  const { colors, font } = useTheme();
  const [moves, setMoves] = useState<EligibleMove[]>([]);
  const [closeFriendIds, setCloseFriendIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!session?.user) return;
    const [myMoves, closeIds] = await Promise.all([
      getMyOptedInMoves(session.user.id),
      getCloseFriendIds().catch(() => new Set<string>()),
    ]);
    setMoves(myMoves);
    setCloseFriendIds(closeIds);
  }, [session?.user]);

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

  return (
    <Screen style={styles.noPadding}>
      <FlatList
        data={moves}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={[styles.headerTitle, { color: colors.textPrimary, fontFamily: font.family.bodySemibold }]}>{t('nav.moves')}</Text>
            <Text style={[styles.headerSubtitle, { color: colors.textMuted, fontFamily: font.family.monoBold }]}>{t('moves.hostingAndJoined')}</Text>
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
              <Text style={[styles.emptyTitle, { color: colors.textPrimary, fontFamily: font.family.heroDisplay }]}>
                {t('moves.optedInEmptyTitle')}
              </Text>
              <Text style={[styles.emptyText, { color: colors.textSecondary, fontFamily: font.family.bodyRegular }]}>
                {t('moves.optedInEmptyText')}
              </Text>
            </View>
          ) : null
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  noPadding: {
    padding: 0,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    gap: 4,
  },
  headerTitle: {
    fontSize: 22,
    lineHeight: 26,
  },
  headerSubtitle: {
    fontSize: 11,
    letterSpacing: 0.9,
  },
  cardWrap: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  listContent: {
    paddingBottom: 32,
  },
  empty: {
    paddingTop: 32,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 32,
    lineHeight: 34,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 12,
  },
});
