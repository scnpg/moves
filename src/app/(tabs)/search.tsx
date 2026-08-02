import { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { UserRow } from '@/components/UserRow';
import { acceptFriendRequest, sendFriendRequest, setCloseFriend } from '@/features/friends/api';
import { searchUsers } from '@/features/search/api';
import type { SearchUserResult } from '@/lib/database.types';
import { useAuth } from '@/providers/AuthProvider';
import { color, font, spacing } from '@/theme/tokens';

export default function SearchScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchUserResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      return;
    }
    const timeout = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await searchUsers(trimmed);
        setResults(data);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [query]);

  const updateResult = (id: string, patch: Partial<SearchUserResult>) => {
    setResults((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const handleAdd = async (target: SearchUserResult) => {
    if (!session?.user) return;
    updateResult(target.id, { friendship_status: 'pending_sent' });
    try {
      await sendFriendRequest(target.id, session.user.id);
    } catch {
      updateResult(target.id, { friendship_status: 'none' });
    }
  };

  const handleAccept = async (target: SearchUserResult) => {
    if (!session?.user) return;
    updateResult(target.id, { friendship_status: 'accepted' });
    try {
      await acceptFriendRequest(session.user.id, target.id);
    } catch {
      updateResult(target.id, { friendship_status: 'pending_received' });
    }
  };

  const handleToggleClose = async (target: SearchUserResult) => {
    const next = !target.is_close_friend;
    updateResult(target.id, { is_close_friend: next });
    try {
      await setCloseFriend(target.id, next);
    } catch {
      updateResult(target.id, { is_close_friend: !next });
    }
  };

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Search</Text>
      </View>
      <View style={styles.searchBox}>
        <TextField
          value={query}
          onChangeText={setQuery}
          placeholder="Search by username or name"
          autoCapitalize="none"
        />
      </View>
      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <UserRow
            avatarUrl={item.avatar_url}
            name={item.display_name ?? item.username}
            username={item.username}
            isCloseFriend={item.is_close_friend}
            friendshipStatus={item.friendship_status}
            onPress={() => router.push(`/users/${item.id}`)}
            onAdd={() => handleAdd(item)}
            onAccept={() => handleAccept(item)}
            onToggleClose={() => handleToggleClose(item)}
          />
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          query.trim() && !loading ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No users found for &quot;{query.trim()}&quot;.</Text>
            </View>
          ) : null
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  headerTitle: {
    fontSize: font.size.xl,
    fontWeight: font.weight.heavy,
    color: color.textPrimary,
  },
  searchBox: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  separator: {
    height: 1,
    backgroundColor: color.borderSubtle,
  },
  empty: {
    paddingTop: spacing.xxl,
    alignItems: 'center',
  },
  emptyText: {
    color: color.textMuted,
    fontSize: font.size.sm,
  },
});
