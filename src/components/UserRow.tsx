import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import type { SearchFriendshipStatus } from '@/lib/database.types';
import { color, font, radius, spacing } from '@/theme/tokens';

interface UserRowProps {
  avatarUrl?: string | null;
  name: string;
  username: string;
  isCloseFriend?: boolean;
  friendshipStatus?: SearchFriendshipStatus;
  onPress?: () => void;
  onAdd?: () => void;
  onAccept?: () => void;
  onToggleClose?: () => void;
}

export function UserRow({
  avatarUrl,
  name,
  username,
  isCloseFriend,
  friendshipStatus,
  onPress,
  onAdd,
  onAccept,
  onToggleClose,
}: UserRowProps) {
  return (
    <Pressable onPress={onPress} style={styles.row}>
      <Avatar uri={avatarUrl} name={name} size={44} closeFriend={isCloseFriend} />
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
        <Text style={styles.username} numberOfLines={1}>
          @{username}
        </Text>
      </View>
      {friendshipStatus === 'none' && onAdd ? (
        <Pressable onPress={onAdd} style={styles.actionPrimary}>
          <Text style={styles.actionPrimaryText}>Add</Text>
        </Pressable>
      ) : null}
      {friendshipStatus === 'pending_sent' ? (
        <View style={styles.actionMuted}>
          <Text style={styles.actionMutedText}>Requested</Text>
        </View>
      ) : null}
      {friendshipStatus === 'pending_received' && onAccept ? (
        <Pressable onPress={onAccept} style={styles.actionPrimary}>
          <Text style={styles.actionPrimaryText}>Accept</Text>
        </Pressable>
      ) : null}
      {friendshipStatus === 'accepted' && onToggleClose ? (
        <Pressable onPress={onToggleClose} style={styles.starButton}>
          <Text style={[styles.star, isCloseFriend && styles.starActive]}>★</Text>
        </Pressable>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  info: {
    flex: 1,
  },
  name: {
    color: color.textPrimary,
    fontSize: font.size.md,
    fontWeight: font.weight.medium,
  },
  username: {
    color: color.textMuted,
    fontSize: font.size.xs,
  },
  actionPrimary: {
    backgroundColor: color.brand,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radius.pill,
  },
  actionPrimaryText: {
    color: color.textInverse,
    fontSize: font.size.xs,
    fontWeight: font.weight.semibold,
  },
  actionMuted: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.border,
  },
  actionMutedText: {
    color: color.textMuted,
    fontSize: font.size.xs,
    fontWeight: font.weight.medium,
  },
  starButton: {
    padding: spacing.xxs,
  },
  star: {
    fontSize: font.size.lg,
    color: color.border,
  },
  starActive: {
    color: color.closeFriend,
  },
});
