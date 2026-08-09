import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { Stack, useFocusEffect } from 'expo-router';

import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { getBlockedUsers, unblockUser } from '@/features/blocking/api';
import { useLocale } from '@/i18n/LocaleProvider';
import { notify } from '@/lib/alerts';
import type { BlockedUser } from '@/lib/database.types';
import { color, font, spacing } from '@/theme/tokens';

export default function BlockedUsersScreen() {
  const { t } = useLocale();
  const [users, setUsers] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [unblockingId, setUnblockingId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      getBlockedUsers()
        .then((data) => {
          if (!cancelled) setUsers(data);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }, [])
  );

  const handleUnblock = async (user: BlockedUser) => {
    setUnblockingId(user.id);
    const previous = users;
    setUsers((prev) => prev.filter((u) => u.id !== user.id));
    try {
      await unblockUser(user.id);
    } catch (err) {
      setUsers(previous);
      notify(t('userProfile.couldNotUnblock'), err instanceof Error ? err.message : t('common.pleaseTryAgain'));
    } finally {
      setUnblockingId(null);
    }
  };

  return (
    <Screen>
      <Stack.Screen
        options={{
          headerShown: true,
          title: t('blocked.title'),
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
          data={users}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <Card style={styles.row} raised={false}>
              <Avatar uri={item.avatar_url} name={item.display_name ?? item.username} size={40} />
              <View style={styles.info}>
                <Text style={styles.name}>{item.display_name ?? item.username}</Text>
                <Text style={styles.username}>@{item.username}</Text>
              </View>
              <Button
                label={t('userProfile.unblock')}
                variant="secondary"
                onPress={() => handleUnblock(item)}
                loading={unblockingId === item.id}
              />
            </Card>
          )}
          ItemSeparatorComponent={() => <View style={{ height: spacing.xs }} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>{t('blocked.empty')}</Text>
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  info: {
    flex: 1,
  },
  name: {
    color: color.textPrimary,
    fontSize: font.size.md,
    fontWeight: font.weight.bold,
  },
  username: {
    fontFamily: font.family.mono,
    color: color.textMuted,
    fontSize: font.size.xs,
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
