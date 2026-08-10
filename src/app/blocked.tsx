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
import { useTheme } from '@/theme/ThemeProvider';

export default function BlockedUsersScreen() {
  const { t } = useLocale();
  const { colors, font } = useTheme();
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
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.textPrimary,
        }}
      />
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.brand} />
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
                <Text style={[styles.name, { color: colors.textPrimary, fontFamily: font.family.bodySemibold }]}>{item.display_name ?? item.username}</Text>
                <Text style={[styles.username, { color: colors.textMuted, fontFamily: font.family.monoRegular }]}>@{item.username}</Text>
              </View>
              <Button
                label={t('userProfile.unblock')}
                variant="secondary"
                onPress={() => handleUnblock(item)}
                loading={unblockingId === item.id}
              />
            </Card>
          )}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={[styles.emptyText, { color: colors.textMuted, fontFamily: font.family.bodyRegular }]}>{t('blocked.empty')}</Text>
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
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: 15,
  },
  username: {
    fontSize: 11,
    letterSpacing: 0.7,
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
