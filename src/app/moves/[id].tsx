import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';

import { Avatar } from '@/components/Avatar';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { getCloseFriendIds } from '@/features/friends/api';
import {
  approveMember,
  endMoveEarly,
  getEligibleMoves,
  getMove,
  getMyMembership,
  listMembers,
  listMessages,
  rejectMember,
  removeMember,
  requestToJoin,
  sendMessage,
  subscribeToMoveMembers,
  subscribeToMoveMessages,
  type MoveMemberWithProfile,
  type MoveMessageWithSender,
} from '@/features/moves/api';
import type { EligibleMove, Move, MoveMember } from '@/lib/database.types';
import { formatCountdown, formatWhen } from '@/lib/format';
import { useAuth } from '@/providers/AuthProvider';
import { color, degreeLabel, font, radius, spacing } from '@/theme/tokens';

export default function MoveRoomScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const router = useRouter();
  const myId = session?.user.id;

  const [loading, setLoading] = useState(true);
  const [move, setMove] = useState<Move | null>(null);
  const [previewMove, setPreviewMove] = useState<EligibleMove | null>(null);
  const [membership, setMembership] = useState<MoveMember | null>(null);
  const [members, setMembers] = useState<MoveMemberWithProfile[]>([]);
  const [messages, setMessages] = useState<MoveMessageWithSender[]>([]);
  const [closeFriendIds, setCloseFriendIds] = useState<Set<string>>(new Set());
  const [messageText, setMessageText] = useState('');
  const [joining, setJoining] = useState(false);
  const [, forceCountdownTick] = useState(0);
  const messagesRef = useRef<FlatList>(null);

  const isHost = !!(move && myId && move.host_id === myId);
  const isApproved = isHost || membership?.status === 'approved';

  const load = useCallback(async () => {
    if (!id || !myId) return;

    const [directMove, myMembership, closeIds] = await Promise.all([
      getMove(id),
      getMyMembership(id, myId),
      getCloseFriendIds().catch(() => new Set<string>()),
    ]);

    setMembership(myMembership);
    setCloseFriendIds(closeIds);

    if (directMove) {
      setMove(directMove);
      setPreviewMove(null);
      const [memberList, messageList] = await Promise.all([listMembers(id), listMessages(id)]);
      setMembers(memberList);
      setMessages(messageList);
    } else {
      setMove(null);
      const eligible = await getEligibleMoves({ userId: myId }).catch(() => []);
      setPreviewMove(eligible.find((m) => m.id === id) ?? null);
    }
  }, [id, myId]);

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

  useEffect(() => {
    if (!id || !isApproved) return;
    // Realtime payloads don't include the joined sender profile, so just
    // refetch the (small, ephemeral-room-sized) message list on every insert.
    const unsubscribeMessages = subscribeToMoveMessages(id, () => {
      listMessages(id).then(setMessages).catch(() => {});
    });
    const unsubscribeMembers = subscribeToMoveMembers(id, () => {
      listMembers(id).then(setMembers).catch(() => {});
      if (myId) getMyMembership(id, myId).then(setMembership).catch(() => {});
    });
    return () => {
      unsubscribeMessages();
      unsubscribeMembers();
    };
  }, [id, isApproved, myId]);

  // Ticks once a second purely to force formatCountdown() to re-evaluate against Date.now().
  useEffect(() => {
    const interval = setInterval(() => forceCountdownTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (messages.length > 0) {
      requestAnimationFrame(() => messagesRef.current?.scrollToEnd({ animated: true }));
    }
  }, [messages.length]);

  const handleJoin = async () => {
    if (!id || !myId) return;
    setJoining(true);
    try {
      await requestToJoin(id, myId);
      await load();
    } catch (err) {
      Alert.alert('Could not join', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setJoining(false);
    }
  };

  const handleCancelRequest = async () => {
    if (!membership) return;
    setJoining(true);
    try {
      await removeMember(membership.id);
      await load();
    } finally {
      setJoining(false);
    }
  };

  const handleSend = async () => {
    if (!id || !myId || !messageText.trim()) return;
    const content = messageText.trim();
    setMessageText('');
    try {
      await sendMessage(id, myId, content);
    } catch (err) {
      Alert.alert('Message not sent', err instanceof Error ? err.message : 'Please try again.');
    }
  };

  const handleApprove = async (memberId: string) => {
    await approveMember(memberId);
    if (id) setMembers(await listMembers(id));
  };

  const handleReject = async (memberId: string) => {
    await rejectMember(memberId);
    if (id) setMembers(await listMembers(id));
  };

  const handleKick = async (memberId: string) => {
    await removeMember(memberId);
    if (id) setMembers(await listMembers(id));
  };

  const handleEndMove = () => {
    if (!id) return;
    Alert.alert('End this Move?', 'The room will close and be deleted after a short cooldown.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'End Move',
        style: 'destructive',
        onPress: async () => {
          await endMoveEarly(id);
          await load();
        },
      },
    ]);
  };

  if (loading) {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: true, title: '', headerStyle: { backgroundColor: color.bg } }} />
        <View style={styles.center}>
          <ActivityIndicator color={color.brand} />
        </View>
      </Screen>
    );
  }

  // Not a member yet (or request was rejected): preview + join flow.
  if (!move && !isApproved) {
    if (!previewMove) {
      return (
        <Screen>
          <Stack.Screen options={{ headerShown: true, title: '', headerStyle: { backgroundColor: color.bg } }} />
          <View style={styles.center}>
            <Text style={styles.emptyText}>This Move isn&apos;t available anymore.</Text>
          </View>
        </Screen>
      );
    }

    const pending = membership?.status === 'pending';
    // A rejected row still occupies the unique (move_id, user_id) constraint,
    // so a fresh requestToJoin() would fail - there's no re-request flow yet.
    const rejected = membership?.status === 'rejected';

    return (
      <Screen>
        <Stack.Screen options={{ headerShown: true, title: '', headerStyle: { backgroundColor: color.bg } }} />
        <View style={styles.previewContent}>
          <View style={styles.previewHeader}>
            <Avatar uri={previewMove.host_avatar_url} name={previewMove.host_display_name ?? previewMove.host_username} size={56} />
            <Text style={styles.title}>{previewMove.title}</Text>
            <Text style={styles.hostLine}>Hosted by {previewMove.host_display_name ?? previewMove.host_username}</Text>
          </View>

          {previewMove.description ? <Text style={styles.description}>{previewMove.description}</Text> : null}

          <View style={styles.metaRow}>
            <Badge label={formatWhen(previewMove.starts_at, previewMove.expires_at)} tone="brand" />
            <Badge label={degreeLabel[previewMove.degree_limit]} />
            {previewMove.requires_approval ? <Badge label="Approval required" tone="warning" /> : null}
          </View>

          <Text style={styles.helperText}>
            {previewMove.max_members
              ? `${previewMove.approved_count}/${previewMove.max_members} joined`
              : `${previewMove.approved_count} joined`}
            {' · Exact location revealed once you join.'}
          </Text>

          {pending ? (
            <>
              <Text style={styles.waitingText}>Your request is waiting for host approval.</Text>
              <Button label="Cancel request" variant="secondary" onPress={handleCancelRequest} loading={joining} />
            </>
          ) : rejected ? (
            <Text style={styles.waitingText}>The host declined your request to join.</Text>
          ) : previewMove.is_full ? (
            <Button label="This Move is full" variant="secondary" onPress={() => {}} disabled />
          ) : (
            <Button
              label={previewMove.requires_approval ? 'Request to join' : 'Join Move'}
              onPress={handleJoin}
              loading={joining}
            />
          )}
        </View>
      </Screen>
    );
  }

  if (!move) {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: true, title: '', headerStyle: { backgroundColor: color.bg } }} />
        <View style={styles.center}>
          <ActivityIndicator color={color.brand} />
        </View>
      </Screen>
    );
  }

  const approvedMembers = members.filter((m) => m.status === 'approved');
  const pendingMembers = members.filter((m) => m.status === 'pending');
  const isActive = move.status === 'active';
  const countdownTarget = isActive
    ? move.expires_at
    : move.cooldown_started_at
      ? new Date(new Date(move.cooldown_started_at).getTime() + 60 * 60_000).toISOString()
      : move.expires_at;

  return (
    <Screen>
      <Stack.Screen
        options={{
          headerShown: true,
          title: move.title,
          headerStyle: { backgroundColor: color.bg },
          headerTintColor: color.textPrimary,
        }}
      />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.roomHeader}>
          <View style={styles.roomHeaderRow}>
            <Badge label={isActive ? `Ends in ${formatCountdown(countdownTarget)}` : `Closing in ${formatCountdown(countdownTarget)}`} tone={isActive ? 'brand' : 'danger'} />
            <Text style={styles.memberCount}>
              {approvedMembers.length}
              {move.max_members ? `/${move.max_members}` : ''} here
            </Text>
          </View>
          {isHost && isActive ? (
            <Pressable onPress={handleEndMove}>
              <Text style={styles.endLink}>End Move</Text>
            </Pressable>
          ) : null}
        </View>

        {isHost && pendingMembers.length > 0 ? (
          <View style={styles.requestsSection}>
            <Text style={styles.sectionTitle}>Requests ({pendingMembers.length})</Text>
            {pendingMembers.map((pm) => (
              <View key={pm.id} style={styles.requestRow}>
                <Avatar uri={pm.profile.avatar_url} name={pm.profile.display_name ?? pm.profile.username} size={32} closeFriend={closeFriendIds.has(pm.user_id)} />
                <Text style={styles.requestName} numberOfLines={1}>
                  {pm.profile.display_name ?? pm.profile.username}
                </Text>
                <Pressable onPress={() => handleApprove(pm.id)} style={styles.approveButton}>
                  <Text style={styles.approveText}>Approve</Text>
                </Pressable>
                <Pressable onPress={() => handleReject(pm.id)} style={styles.rejectButton}>
                  <Text style={styles.rejectText}>Decline</Text>
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}

        <FlatList
          ref={messagesRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messagesContent}
          renderItem={({ item }) => {
            const mine = item.sender_id === myId;
            return (
              <View style={[styles.messageRow, mine && styles.messageRowMine]}>
                {!mine ? (
                  <Avatar uri={item.sender.avatar_url} name={item.sender.display_name ?? item.sender.username} size={28} closeFriend={closeFriendIds.has(item.sender_id)} />
                ) : null}
                <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                  {!mine ? <Text style={styles.senderName}>{item.sender.display_name ?? item.sender.username}</Text> : null}
                  <Text style={styles.messageText}>{item.content}</Text>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={<Text style={styles.emptyText}>No messages yet. Say hi 👋</Text>}
        />

        {isActive ? (
          <View style={styles.composer}>
            <View style={styles.composerInput}>
              <TextField value={messageText} onChangeText={setMessageText} placeholder="Message the group" onSubmitEditing={handleSend} />
            </View>
            <Pressable onPress={handleSend} style={styles.sendButton}>
              <Text style={styles.sendText}>Send</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.closedBanner}>
            <Text style={styles.closedText}>This Move has ended. The room will be deleted shortly.</Text>
          </View>
        )}

        {approvedMembers.length > 0 ? (
          <Card style={styles.memberListCard}>
            <Text style={styles.sectionTitle}>Who&apos;s here</Text>
            <View style={styles.memberAvatars}>
              {approvedMembers.map((m) => (
                <Pressable key={m.id} onPress={() => (m.user_id !== myId ? router.push(`/users/${m.user_id}`) : undefined)} style={styles.memberAvatarWrap}>
                  <Avatar uri={m.profile.avatar_url} name={m.profile.display_name ?? m.profile.username} size={36} closeFriend={closeFriendIds.has(m.user_id)} />
                  {isHost && m.user_id !== move.host_id ? (
                    <Pressable onPress={() => handleKick(m.id)} style={styles.kickBadge}>
                      <Text style={styles.kickText}>×</Text>
                    </Pressable>
                  ) : null}
                </Pressable>
              ))}
            </View>
          </Card>
        ) : null}
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: color.textMuted, fontSize: font.size.sm, textAlign: 'center', paddingVertical: spacing.lg },

  previewContent: { flex: 1, padding: spacing.lg, gap: spacing.md },
  previewHeader: { alignItems: 'center', gap: spacing.xxs, paddingVertical: spacing.md },
  title: { color: color.textPrimary, fontSize: font.size.xl, fontWeight: font.weight.bold, textAlign: 'center', marginTop: spacing.sm },
  hostLine: { color: color.textMuted, fontSize: font.size.sm },
  description: { color: color.textSecondary, fontSize: font.size.md },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  helperText: { color: color.textMuted, fontSize: font.size.xs },
  waitingText: { color: color.warning, fontSize: font.size.sm, fontWeight: font.weight.medium },

  roomHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: color.borderSubtle,
  },
  roomHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  memberCount: { color: color.textMuted, fontSize: font.size.xs },
  endLink: { color: color.danger, fontSize: font.size.sm, fontWeight: font.weight.semibold },

  requestsSection: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, gap: spacing.xs, borderBottomWidth: 1, borderBottomColor: color.borderSubtle },
  sectionTitle: { color: color.textSecondary, fontSize: font.size.xs, fontWeight: font.weight.semibold, textTransform: 'uppercase', letterSpacing: 0.5 },
  requestRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  requestName: { flex: 1, color: color.textPrimary, fontSize: font.size.sm },
  approveButton: { backgroundColor: color.success, paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.pill },
  approveText: { color: color.textInverse, fontSize: font.size.xs, fontWeight: font.weight.semibold },
  rejectButton: { paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.pill, borderWidth: 1, borderColor: color.border },
  rejectText: { color: color.textMuted, fontSize: font.size.xs, fontWeight: font.weight.medium },

  messagesContent: { padding: spacing.lg, gap: spacing.sm, flexGrow: 1 },
  messageRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.xs, maxWidth: '85%' },
  messageRowMine: { alignSelf: 'flex-end' },
  bubble: { borderRadius: radius.lg, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  bubbleTheirs: { backgroundColor: color.bgCard, borderWidth: 1, borderColor: color.borderSubtle },
  bubbleMine: { backgroundColor: color.brand },
  senderName: { color: color.textMuted, fontSize: font.size.xs, fontWeight: font.weight.semibold, marginBottom: 2 },
  messageText: { color: color.textPrimary, fontSize: font.size.sm },

  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.xs, padding: spacing.md, borderTopWidth: 1, borderTopColor: color.borderSubtle },
  composerInput: { flex: 1 },
  sendButton: { backgroundColor: color.brand, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill },
  sendText: { color: color.textInverse, fontWeight: font.weight.semibold },

  closedBanner: { padding: spacing.md, alignItems: 'center' },
  closedText: { color: color.textMuted, fontSize: font.size.sm },

  memberListCard: { margin: spacing.md, marginTop: 0, gap: spacing.sm },
  memberAvatars: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  memberAvatarWrap: { position: 'relative' },
  kickBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: color.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kickText: { color: color.textInverse, fontSize: 12, fontWeight: font.weight.bold, lineHeight: 14 },
});
