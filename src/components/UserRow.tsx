import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import type { SearchFriendshipStatus } from '@/lib/database.types';
import { borderWidth, color, font, radius, spacing } from '@/theme/tokens';

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
  onUnfriend?: () => void;
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
  onUnfriend,
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
          <Text style={styles.actionPrimaryText}>ADD</Text>
        </Pressable>
      ) : null}
      {friendshipStatus === 'pending_sent' ? (
        <View style={styles.actionMuted}>
          <Text style={styles.actionMutedText}>REQUESTED</Text>
        </View>
      ) : null}
      {friendshipStatus === 'pending_received' && onAccept ? (
        <Pressable onPress={onAccept} style={styles.actionPrimary}>
          <Text style={styles.actionPrimaryText}>ACCEPT</Text>
        </Pressable>
      ) : null}
      {friendshipStatus === 'accepted' ? (
        <View style={styles.acceptedActions}>
          {onToggleClose ? (
            <Pressable onPress={onToggleClose} style={styles.starButton}>
              <Text style={[styles.star, isCloseFriend && styles.starActive]}>★</Text>
            </Pressable>
          ) : null}
          {onUnfriend ? (
            <Pressable onPress={onUnfriend} style={styles.unfriendButton}>
              <Text style={styles.unfriendText}>UNFRIEND</Text>
            </Pressable>
          ) : null}
        </View>
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
    fontWeight: font.weight.bold,
  },
  username: {
    fontFamily: font.family.mono,
    color: color.textMuted,
    fontSize: font.size.xs,
  },
  actionPrimary: {
    backgroundColor: color.brand,
    borderWidth: borderWidth.thin,
    borderColor: color.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radius.sm,
  },
  actionPrimaryText: {
    fontFamily: font.family.mono,
    color: color.textPrimary,
    fontSize: font.size.xs,
    fontWeight: font.weight.bold,
    letterSpacing: font.tracking.label,
  },
  actionMuted: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radius.sm,
    borderWidth: borderWidth.thin,
    borderColor: color.borderSubtle,
  },
  actionMutedText: {
    fontFamily: font.family.mono,
    color: color.textMuted,
    fontSize: font.size.xs,
    fontWeight: font.weight.bold,
    letterSpacing: font.tracking.label,
  },
  acceptedActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  starButton: {
    padding: spacing.xxs,
  },
  star: {
    fontSize: font.size.lg,
    color: color.borderSubtle,
  },
  starActive: {
    color: color.closeFriend,
  },
  unfriendButton: {
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xxs,
    borderRadius: radius.sm,
    borderWidth: borderWidth.thin,
    borderColor: color.border,
  },
  unfriendText: {
    fontFamily: font.family.mono,
    color: color.danger,
    fontSize: 10,
    fontWeight: font.weight.bold,
    letterSpacing: font.tracking.label,
  },
});
