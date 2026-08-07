import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { HoverPressable } from '@/components/HoverPressable';
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
  onDecline?: () => void;
  onCancel?: () => void;
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
  onDecline,
  onCancel,
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
        <HoverPressable onPress={onAdd} style={styles.actionPrimary}>
          <Text style={styles.actionPrimaryText}>ADD</Text>
        </HoverPressable>
      ) : null}
      {friendshipStatus === 'pending_sent' ? (
        <View style={styles.acceptedActions}>
          <View style={styles.actionMuted}>
            <Text style={styles.actionMutedText}>REQUESTED</Text>
          </View>
          {onCancel ? (
            <HoverPressable onPress={onCancel} style={styles.unfriendButton}>
              <Text style={styles.unfriendText}>CANCEL</Text>
            </HoverPressable>
          ) : null}
        </View>
      ) : null}
      {friendshipStatus === 'pending_received' ? (
        <View style={styles.acceptedActions}>
          {onAccept ? (
            <HoverPressable onPress={onAccept} style={styles.actionPrimary}>
              <Text style={styles.actionPrimaryText}>ACCEPT</Text>
            </HoverPressable>
          ) : null}
          {onDecline ? (
            <HoverPressable onPress={onDecline} style={styles.unfriendButton}>
              <Text style={styles.unfriendText}>DECLINE</Text>
            </HoverPressable>
          ) : null}
        </View>
      ) : null}
      {friendshipStatus === 'accepted' ? (
        <View style={styles.acceptedActions}>
          {onToggleClose ? (
            <HoverPressable onPress={onToggleClose} style={styles.starButton} lightenOpacity={0.25}>
              <Text style={[styles.star, isCloseFriend && styles.starActive]}>★</Text>
            </HoverPressable>
          ) : null}
          {onUnfriend ? (
            <HoverPressable onPress={onUnfriend} style={styles.unfriendButton}>
              <Text style={styles.unfriendText}>UNFRIEND</Text>
            </HoverPressable>
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
    borderRadius: radius.sm,
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
