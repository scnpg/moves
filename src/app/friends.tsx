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
import { confirmAction, notify } from '@/lib/alerts';
import type { FriendListItem, FriendRequest } from '@/lib/database.types';
import { useAuth } from '@/providers/AuthProvider';
import { color, font, spacing } from '@/theme/tokens';

type Tab = 'friends' | 'requests';

export default function FriendsScreen() {
  const router = useRouter();
  const { session } = useAuth();
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
    const confirmed = await confirmAction('Unfriend', `Remove ${name} from your friends?`, 'Unfriend');
    if (!confirmed) return;

    const previous = friends;
    setFriends((prev) => prev.filter((f) => f.id !== friend.id));
    try {
      await removeFriendship(session.user.id, friend.id);
    } catch (err) {
      setFriends(previous);
      notify('Could not unfriend', err instanceof Error ? err.message : 'Please try again.');
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
      notify('Could not accept', err instanceof Error ? err.message : 'Please try again.');
    }
  };

  const handleDecline = async (request: FriendRequest) => {
    if (!session?.user) return;
    setRequests((prev) => prev.filter((r) => r.id !== request.id));
    try {
      await declineFriendRequest(session.user.id, request.other_user_id);
    } catch (err) {
      setRequests((prev) => [request, ...prev]);
      notify('Could not decline', err instanceof Error ? err.message : 'Please try again.');
    }
  };

  const handleCancel = async (request: FriendRequest) => {
    if (!session?.user) return;
    setRequests((prev) => prev.filter((r) => r.id !== request.id));
    try {
      await removeFriendship(session.user.id, request.other_user_id);
    } catch (err) {
      setRequests((prev) => [request, ...prev]);
      notify('Could not cancel', err instanceof Error ? err.message : 'Please try again.');
    }
  };

  const incoming = requests.filter((r) => r.direction === 'incoming');
  const outgoing = requests.filter((r) => r.direction === 'outgoing');

  return (
    <Screen>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Friends',
          headerStyle: { backgroundColor: color.bg },
          headerTintColor: color.textPrimary,
        }}
      />
      <View style={styles.tabsRow}>
        <SegmentedControl
          segments={[
            { value: 'friends', label: 'Friends' },
            { value: 'requests', label: `Requests${requests.length ? ` (${requests.length})` : ''}` },
          ]}
          value={tab}
          onChange={setTab}
        />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={color.brand} />
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
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>
                No friends yet. Find people in Search and send a request.
              </Text>
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
              <Text style={styles.sectionTitle}>
                {incoming.length > 0 ? `RECEIVED (${incoming.length})` : 'RECEIVED'}
              </Text>
              {incoming.length === 0 ? (
                <Text style={styles.emptySectionText}>No incoming requests.</Text>
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

              <Text style={[styles.sectionTitle, styles.sentTitle]}>
                {outgoing.length > 0 ? `SENT (${outgoing.length})` : 'SENT'}
              </Text>
              {outgoing.length === 0 ? (
                <Text style={styles.emptySectionText}>No outgoing requests.</Text>
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
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  requestsWrap: {
    gap: spacing.xs,
  },
  sectionTitle: {
    fontFamily: font.family.mono,
    color: color.textSecondary,
    fontSize: font.size.xs,
    fontWeight: font.weight.bold,
    letterSpacing: font.tracking.wide,
    marginTop: spacing.sm,
  },
  sentTitle: {
    marginTop: spacing.lg,
  },
  emptySectionText: {
    color: color.textMuted,
    fontSize: font.size.sm,
    paddingVertical: spacing.xs,
  },
  separator: {
    height: 1,
    backgroundColor: color.borderSubtle,
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
