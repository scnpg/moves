import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { HoverPressable } from '@/components/HoverPressable';
import { useLocale } from '@/i18n/LocaleProvider';
import type { SearchFriendshipStatus } from '@/lib/database.types';
import { useTheme } from '@/theme/ThemeProvider';

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
  const { t } = useLocale();
  const { colors, border, font } = useTheme();

  return (
    <Pressable onPress={onPress} style={styles.row}>
      <Avatar uri={avatarUrl} name={name} size={44} closeFriend={isCloseFriend} />
      <View style={styles.info}>
        <Text style={[styles.name, { color: colors.textPrimary, fontFamily: font.family.bodySemibold }]} numberOfLines={1}>
          {name}
        </Text>
        <Text style={[styles.username, { color: colors.textMuted, fontFamily: font.family.monoRegular }]} numberOfLines={1}>
          @{username}
        </Text>
      </View>
      {friendshipStatus === 'none' && onAdd ? (
        <HoverPressable onPress={onAdd} style={[styles.actionPrimary, { backgroundColor: colors.brand, borderWidth: border.rest.width, borderColor: colors.border }]}>
          <Text style={[styles.actionPrimaryText, { color: colors.onAccent, fontFamily: font.family.monoBold }]}>{t('userRow.add')}</Text>
        </HoverPressable>
      ) : null}
      {friendshipStatus === 'pending_sent' ? (
        <View style={styles.acceptedActions}>
          <View style={[styles.actionMuted, { borderWidth: border.soft.width, borderColor: border.soft.color }]}>
            <Text style={[styles.actionMutedText, { color: colors.textMuted, fontFamily: font.family.monoBold }]}>{t('userRow.requested')}</Text>
          </View>
          {onCancel ? (
            <HoverPressable onPress={onCancel} style={[styles.unfriendButton, { borderWidth: border.rest.width, borderColor: colors.border }]}>
              <Text style={[styles.unfriendText, { color: colors.danger, fontFamily: font.family.monoBold }]}>{t('userRow.cancel')}</Text>
            </HoverPressable>
          ) : null}
        </View>
      ) : null}
      {friendshipStatus === 'pending_received' ? (
        <View style={styles.acceptedActions}>
          {onAccept ? (
            <HoverPressable onPress={onAccept} style={[styles.actionPrimary, { backgroundColor: colors.brand, borderWidth: border.rest.width, borderColor: colors.border }]}>
              <Text style={[styles.actionPrimaryText, { color: colors.onAccent, fontFamily: font.family.monoBold }]}>{t('userRow.accept')}</Text>
            </HoverPressable>
          ) : null}
          {onDecline ? (
            <HoverPressable onPress={onDecline} style={[styles.unfriendButton, { borderWidth: border.rest.width, borderColor: colors.border }]}>
              <Text style={[styles.unfriendText, { color: colors.danger, fontFamily: font.family.monoBold }]}>{t('userRow.decline')}</Text>
            </HoverPressable>
          ) : null}
        </View>
      ) : null}
      {friendshipStatus === 'accepted' ? (
        <View style={styles.acceptedActions}>
          {onToggleClose ? (
            <HoverPressable onPress={onToggleClose} style={styles.starButton} lightenOpacity={0.25}>
              <Text style={[styles.star, { color: isCloseFriend ? colors.closeFriend : colors.borderSubtle }]}>★</Text>
            </HoverPressable>
          ) : null}
          {onUnfriend ? (
            <HoverPressable onPress={onUnfriend} style={[styles.unfriendButton, { borderWidth: border.rest.width, borderColor: colors.border }]}>
              <Text style={[styles.unfriendText, { color: colors.danger, fontFamily: font.family.monoBold }]}>{t('userRow.unfriend')}</Text>
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
    gap: 12,
    paddingVertical: 10,
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
  actionPrimary: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  actionPrimaryText: {
    fontSize: 10,
    letterSpacing: 0.8,
  },
  actionMuted: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  actionMutedText: {
    fontSize: 10,
    letterSpacing: 0.8,
  },
  acceptedActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  starButton: {
    padding: 4,
  },
  star: {
    fontSize: 18,
  },
  unfriendButton: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  unfriendText: {
    fontSize: 10,
    letterSpacing: 0.8,
  },
});
