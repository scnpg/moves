import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { Stack, useFocusEffect, useRouter } from 'expo-router';

import { Screen } from '@/components/Screen';
import { UserRow } from '@/components/UserRow';
import { getMyFriends, removeFriendship, setCloseFriend } from '@/features/friends/api';
import { confirmAction, notify } from '@/lib/alerts';
import type { FriendListItem } from '@/lib/database.types';
import { useAuth } from '@/providers/AuthProvider';
import { color, font, spacing } from '@/theme/tokens';

export default function FriendsScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const [friends, setFriends] = useState<FriendListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      getMyFriends()
        .then((data) => {
          if (!cancelled) setFriends(data);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }, [])
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
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={color.brand} />
        </View>
      ) : (
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
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
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
