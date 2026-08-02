import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';

import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import {
  acceptFriendRequest,
  getFriendshipStatus,
  getMutualFriends,
  removeFriendship,
  sendFriendRequest,
  setCloseFriend,
} from '@/features/friends/api';
import { getProfile } from '@/features/profile/api';
import { confirmAction, notify } from '@/lib/alerts';
import type { MutualFriend, Profile, SearchFriendshipStatus } from '@/lib/database.types';
import { useAuth } from '@/providers/AuthProvider';
import { color, font, spacing } from '@/theme/tokens';

export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [mutuals, setMutuals] = useState<MutualFriend[]>([]);
  const [status, setStatus] = useState<SearchFriendshipStatus>('none');
  const [isCloseFriend, setIsCloseFriend] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!id || !session?.user) return;
      let cancelled = false;
      setLoading(true);

      (async () => {
        const [profileData, friendship, mutualData] = await Promise.all([
          getProfile(id),
          getFriendshipStatus(session.user.id, id),
          getMutualFriends(session.user.id, id).catch(() => []),
        ]);
        if (cancelled) return;
        setProfile(profileData);
        setStatus(friendship.status);
        setIsCloseFriend(friendship.isCloseFriend);
        setMutuals(mutualData);
        setLoading(false);
      })();

      return () => {
        cancelled = true;
      };
    }, [id, session?.user])
  );

  const handleAdd = async () => {
    if (!session?.user || !id) return;
    setActionLoading(true);
    try {
      await sendFriendRequest(id, session.user.id);
      setStatus('pending_sent');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAccept = async () => {
    if (!session?.user || !id) return;
    setActionLoading(true);
    try {
      await acceptFriendRequest(session.user.id, id);
      setStatus('accepted');
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleClose = async () => {
    if (!id) return;
    const next = !isCloseFriend;
    setIsCloseFriend(next);
    try {
      await setCloseFriend(id, next);
    } catch {
      setIsCloseFriend(!next);
    }
  };

  const handleUnfriend = async () => {
    if (!session?.user || !id || !profile) return;
    const name = profile.display_name ?? profile.username;
    const confirmed = await confirmAction('Unfriend', `Remove ${name} from your friends?`, 'Unfriend');
    if (!confirmed) return;

    setActionLoading(true);
    try {
      await removeFriendship(session.user.id, id);
      setStatus('none');
      setIsCloseFriend(false);
    } catch (err) {
      notify('Could not unfriend', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading || !profile) {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: true, title: '', headerStyle: { backgroundColor: color.bg } }} />
        <View style={styles.loading}>
          <ActivityIndicator color={color.brand} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <Stack.Screen
        options={{
          headerShown: true,
          title: '',
          headerStyle: { backgroundColor: color.bg },
          headerTintColor: color.textPrimary,
        }}
      />
      <View style={styles.content}>
        <View style={styles.profileHeader}>
          <Avatar
            uri={profile.avatar_url}
            name={profile.display_name ?? profile.username}
            size={88}
            closeFriend={isCloseFriend}
          />
          <Text style={styles.displayName}>{profile.display_name ?? profile.username}</Text>
          <Text style={styles.username}>@{profile.username}</Text>

          <View style={styles.actionsRow}>
            {status === 'none' ? (
              <Button label="Add friend" onPress={handleAdd} loading={actionLoading} />
            ) : null}
            {status === 'pending_sent' ? (
              <Button label="Request sent" variant="secondary" onPress={() => {}} disabled />
            ) : null}
            {status === 'pending_received' ? (
              <Button label="Accept request" onPress={handleAccept} loading={actionLoading} />
            ) : null}
            {status === 'accepted' ? (
              <View style={styles.acceptedActionsRow}>
                <Button
                  label={isCloseFriend ? '★ Close friend' : 'Mark as close friend'}
                  variant="secondary"
                  onPress={handleToggleClose}
                  style={styles.flexButton}
                />
                <Button
                  label="Unfriend"
                  variant="danger"
                  onPress={handleUnfriend}
                  loading={actionLoading}
                  style={styles.flexButton}
                />
              </View>
            ) : null}
          </View>
        </View>

        <Text style={styles.sectionTitle}>
          {mutuals.length > 0 ? `${mutuals.length} MUTUAL FRIEND${mutuals.length === 1 ? '' : 'S'}` : 'MUTUAL FRIENDS'}
        </Text>

        <FlatList
          data={mutuals}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <Card style={styles.mutualCard} raised={false}>
              <Avatar uri={item.avatar_url} name={item.display_name ?? item.username} size={36} />
              <Text style={styles.mutualName}>{item.display_name ?? item.username}</Text>
            </Card>
          )}
          ItemSeparatorComponent={() => <View style={{ height: spacing.xs }} />}
          ListEmptyComponent={<Text style={styles.emptyText}>No mutual friends to show.</Text>}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  profileHeader: {
    alignItems: 'center',
    gap: spacing.xxs,
    paddingVertical: spacing.md,
  },
  displayName: {
    color: color.textPrimary,
    fontSize: font.size.lg,
    fontWeight: font.weight.heavy,
    marginTop: spacing.sm,
  },
  username: {
    fontFamily: font.family.mono,
    color: color.textMuted,
    fontSize: font.size.sm,
  },
  actionsRow: {
    marginTop: spacing.md,
    alignSelf: 'stretch',
  },
  acceptedActionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  flexButton: {
    flex: 1,
  },
  sectionTitle: {
    fontFamily: font.family.mono,
    color: color.textSecondary,
    fontSize: font.size.xs,
    fontWeight: font.weight.bold,
    letterSpacing: font.tracking.label,
  },
  mutualCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  mutualName: {
    color: color.textPrimary,
    fontSize: font.size.sm,
    fontWeight: font.weight.medium,
  },
  emptyText: {
    color: color.textMuted,
    fontSize: font.size.sm,
    paddingVertical: spacing.md,
  },
});
