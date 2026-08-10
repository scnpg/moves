import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { Stack, useFocusEffect, useRouter } from 'expo-router';

import { Screen } from '@/components/Screen';
import { SegmentedControl } from '@/components/SegmentedControl';
import { UserRow } from '@/components/UserRow';
import {
  acceptFriendRequest,
  declineFriendRequest,
  getFriendRequests,
  getMyFriends,
  removeFriendship,
  setCloseFriend,
} from '@/features/friends/api';
import { useLocale } from '@/i18n/LocaleProvider';
import { confirmAction, notify } from '@/lib/alerts';
import type { FriendListItem, FriendRequest } from '@/lib/database.types';
import { useAuth } from '@/providers/AuthProvider';
import { useTheme } from '@/theme/ThemeProvider';

type Tab = 'friends' | 'requests';

export default function FriendsScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const { t } = useLocale();
  const { colors, border, font } = useTheme();
  const [tab, setTab] = useState<Tab>('friends');
  const [friends, setFriends] = useState<FriendListItem[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [friendsData, requestsData] = await Promise.all([getMyFriends(), getFriendRequests()]);
    setFriends(friendsData);
    setRequests(requestsData);
  }, []);

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

  const handleToggleClose = async (friend: FriendListItem) => {
    const next = !friend.is_close_friend;
    setFriends((prev) => prev.map((f) => (f.id === friend.id ? { ...f, is_close_friend: next } : f)));
    try {
      await setCloseFriend(friend.id, next);
    } catch {
      setFriends((prev) => prev.map((f) => (f.id === friend.id ? { ...f, is_close_friend: !next } : f)));
    }
  };

  const handleUnfriend = async (friend: FriendListItem) => {
    if (!session?.user) return;
    const name = friend.display_name ?? friend.username;
    const confirmed = await confirmAction(t('friendsScreen.unfriendTitle'), t('friendsScreen.unfriendMessage', { name }), t('friendsScreen.unfriendTitle'));
    if (!confirmed) return;

    const previous = friends;
    setFriends((prev) => prev.filter((f) => f.id !== friend.id));
    try {
      await removeFriendship(session.user.id, friend.id);
    } catch (err) {
      setFriends(previous);
      notify(t('friendsScreen.couldNotUnfriend'), err instanceof Error ? err.message : t('common.pleaseTryAgain'));
    }
  };

  const handleAccept = async (request: FriendRequest) => {
    if (!session?.user) return;
    setRequests((prev) => prev.filter((r) => r.id !== request.id));
    try {
      await acceptFriendRequest(session.user.id, request.other_user_id);
      load();
    } catch (err) {
      setRequests((prev) => [request, ...prev]);
      notify(t('friendsScreen.couldNotAccept'), err instanceof Error ? err.message : t('common.pleaseTryAgain'));
    }
  };

  const handleDecline = async (request: FriendRequest) => {
    if (!session?.user) return;
    setRequests((prev) => prev.filter((r) => r.id !== request.id));
    try {
      await declineFriendRequest(session.user.id, request.other_user_id);
    } catch (err) {
      setRequests((prev) => [request, ...prev]);
      notify(t('friendsScreen.couldNotDecline'), err instanceof Error ? err.message : t('common.pleaseTryAgain'));
    }
  };

  const handleCancel = async (request: FriendRequest) => {
    if (!session?.user) return;
    setRequests((prev) => prev.filter((r) => r.id !== request.id));
    try {
      await removeFriendship(session.user.id, request.other_user_id);
    } catch (err) {
      setRequests((prev) => [request, ...prev]);
      notify(t('friendsScreen.couldNotCancel'), err instanceof Error ? err.message : t('common.pleaseTryAgain'));
    }
  };

  const incoming = requests.filter((r) => r.direction === 'incoming');
  const outgoing = requests.filter((r) => r.direction === 'outgoing');

  return (
    <Screen>
      <Stack.Screen
        options={{
          headerShown: true,
          title: t('friendsScreen.title'),
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.textPrimary,
        }}
      />
      <View style={styles.tabsRow}>
        <SegmentedControl
          segments={[
            { value: 'friends', label: t('friendsScreen.friendsTab') },
            { value: 'requests', label: `${t('friendsScreen.requestsTab')}${requests.length ? ` (${requests.length})` : ''}` },
          ]}
          value={tab}
          onChange={setTab}
        />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.brand} />
        </View>
      ) : tab === 'friends' ? (
        <FlatList
          data={friends}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <UserRow
              avatarUrl={item.avatar_url}
              name={item.display_name ?? item.username}
              username={item.username}
              isCloseFriend={item.is_close_friend}
              friendshipStatus="accepted"
              onPress={() => router.push(`/users/${item.id}`)}
              onToggleClose={() => handleToggleClose(item)}
              onUnfriend={() => handleUnfriend(item)}
            />
          )}
          ItemSeparatorComponent={() => <View style={[styles.separator, { backgroundColor: border.soft.color }]} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={[styles.emptyText, { color: colors.textMuted, fontFamily: font.family.bodyRegular }]}>{t('friendsScreen.noFriendsYet')}</Text>
            </View>
          }
        />
      ) : (
        <FlatList
          data={[]}
          keyExtractor={() => 'x'}
          renderItem={null}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <View style={styles.requestsWrap}>
              <Text style={[styles.sectionTitle, { color: colors.textMuted, fontFamily: font.family.monoBold }]}>
                {incoming.length > 0 ? `${t('friendsScreen.received')} (${incoming.length})` : t('friendsScreen.received')}
              </Text>
              {incoming.length === 0 ? (
                <Text style={[styles.emptySectionText, { color: colors.textMuted, fontFamily: font.family.bodyRegular }]}>{t('friendsScreen.noIncoming')}</Text>
              ) : (
                incoming.map((r) => (
                  <UserRow
                    key={r.id}
                    avatarUrl={r.avatar_url}
                    name={r.display_name ?? r.username}
                    username={r.username}
                    friendshipStatus="pending_received"
                    onPress={() => router.push(`/users/${r.other_user_id}`)}
                    onAccept={() => handleAccept(r)}
                    onDecline={() => handleDecline(r)}
                  />
                ))
              )}

              <Text style={[styles.sectionTitle, styles.sentTitle, { color: colors.textMuted, fontFamily: font.family.monoBold }]}>
                {outgoing.length > 0 ? `${t('friendsScreen.sent')} (${outgoing.length})` : t('friendsScreen.sent')}
              </Text>
              {outgoing.length === 0 ? (
                <Text style={[styles.emptySectionText, { color: colors.textMuted, fontFamily: font.family.bodyRegular }]}>{t('friendsScreen.noOutgoing')}</Text>
              ) : (
                outgoing.map((r) => (
                  <UserRow
                    key={r.id}
                    avatarUrl={r.avatar_url}
                    name={r.display_name ?? r.username}
                    username={r.username}
                    friendshipStatus="pending_sent"
                    onPress={() => router.push(`/users/${r.other_user_id}`)}
                    onCancel={() => handleCancel(r)}
                  />
                ))
              )}
            </View>
          }
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabsRow: {
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  listContent: {
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  requestsWrap: {
    gap: 8,
  },
  sectionTitle: {
    fontSize: 11,
    letterSpacing: 0.9,
    marginTop: 12,
  },
  sentTitle: {
    marginTop: 24,
  },
  emptySectionText: {
    fontSize: 14,
    paddingVertical: 8,
  },
  separator: {
    height: 1,
  },
  empty: {
    paddingTop: 48,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
  },
});
