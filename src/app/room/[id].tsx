import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  View,
  type TextInput,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { Extrapolation, interpolate, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { Avatar, AvatarStack } from '@/components/Avatar';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { HoverPressable } from '@/components/HoverPressable';
import { ReportUserPanel } from '@/components/ReportUserPanel';
import { Screen } from '@/components/Screen';
import { ShareMovePanel } from '@/components/ShareMovePanel';
import { SubHeader } from '@/components/SubHeader';
import { TextField } from '@/components/TextField';
import { getCloseFriendIds } from '@/features/friends/api';
import {
  approveMember,
  deleteMove,
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
import { useLocale } from '@/i18n/LocaleProvider';
import { confirmAction, notify } from '@/lib/alerts';
import type { EligibleMove, Move, MoveMember } from '@/lib/database.types';
import { formatCountdown, formatWhen } from '@/lib/format';
import { useAuth } from '@/providers/AuthProvider';
import { useTheme } from '@/theme/ThemeProvider';

const DEGREE_TONE = { 0: 'violet', 1: 'green', 2: 'blue', 3: 'pink', 4: 'red' } as const;
const MINI_BAR_HEIGHT = 52;

export default function MoveRoomScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const { t } = useLocale();
  const router = useRouter();
  const { colors, border, borderWidth, font } = useTheme();
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
  const [reportOpen, setReportOpen] = useState(false);
  const [reportingMessageId, setReportingMessageId] = useState<string | null>(null);
  const [, forceCountdownTick] = useState(0);
  const messagesRef = useRef<FlatList>(null);
  const composerInputRef = useRef<TextInput>(null);

  // Collapsible header: title/countdown + "who's here" shrink to a compact
  // mini-bar so the chat gets more vertical room. Driven by discrete
  // triggers (tap/scroll/drag), not a scroll-position-following animation -
  // collapseProgress just eases between the two states.
  const [headerCollapsed, setHeaderCollapsed] = useState(false);
  const collapseProgress = useSharedValue(0);
  const expandedHeaderHeight = useSharedValue(0);

  useEffect(() => {
    collapseProgress.value = withTiming(headerCollapsed ? 1 : 0, { duration: 220 });
  }, [headerCollapsed, collapseProgress]);

  const collapseChat = useCallback(() => setHeaderCollapsed(true), []);
  const expandChat = useCallback(() => setHeaderCollapsed(false), []);
  const focusComposer = useCallback(() => composerInputRef.current?.focus(), []);

  const composerPan = Gesture.Pan()
    .activeOffsetY(-14)
    .failOffsetY(20)
    .failOffsetX([-20, 20])
    .onStart(() => {
      runOnJS(collapseChat)();
      runOnJS(focusComposer)();
    });

  const headerContainerStyle = useAnimatedStyle(() => {
    if (expandedHeaderHeight.value <= 0) return {};
    return { height: interpolate(collapseProgress.value, [0, 1], [expandedHeaderHeight.value, MINI_BAR_HEIGHT], Extrapolation.CLAMP) };
  });
  const fullHeaderStyle = useAnimatedStyle(() => ({
    opacity: interpolate(collapseProgress.value, [0, 0.6], [1, 0], Extrapolation.CLAMP),
  }));
  const miniBarStyle = useAnimatedStyle(() => ({
    opacity: interpolate(collapseProgress.value, [0.4, 1], [0, 1], Extrapolation.CLAMP),
  }));

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
    if (!id || !isApproved || move?.chat_enabled === false) return;
    // Realtime payloads don't include the joined sender profile, so just
    // refetch the (small, ephemeral-room-sized) message list on every insert.
    const unsubscribeMessages = subscribeToMoveMessages(id, () => {
      listMessages(id).then(setMessages).catch(() => {});
    });
    return unsubscribeMessages;
  }, [id, isApproved, move?.chat_enabled]);

  useEffect(() => {
    if (!id || !isApproved) return;
    const unsubscribeMembers = subscribeToMoveMembers(id, () => {
      listMembers(id).then(setMembers).catch(() => {});
      if (myId) getMyMembership(id, myId).then(setMembership).catch(() => {});
    });
    return unsubscribeMembers;
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
      notify(t('room.couldNotJoin'), err instanceof Error ? err.message : t('common.pleaseTryAgain'));
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
      notify(t('room.messageNotSent'), err instanceof Error ? err.message : t('common.pleaseTryAgain'));
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

  const handleBack = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const handleEndMove = async () => {
    if (!id) return;
    const confirmed = await confirmAction(
      t('room.endMoveConfirmTitle'),
      t('room.endMoveConfirmMessage'),
      t('room.endMove')
    );
    if (!confirmed) return;
    await endMoveEarly(id);
    await load();
  };

  const handleDeleteMove = async () => {
    if (!id) return;
    const confirmed = await confirmAction(
      t('room.deleteMoveConfirmTitle'),
      t('room.deleteMoveConfirmMessage'),
      t('room.delete')
    );
    if (!confirmed) return;
    try {
      await deleteMove(id);
      router.replace('/');
    } catch (err) {
      notify(t('room.couldNotDelete'), err instanceof Error ? err.message : t('common.pleaseTryAgain'));
    }
  };

  const handleLeaveMove = async () => {
    if (!membership) return;
    const confirmed = await confirmAction(
      t('room.leaveMoveConfirmTitle'),
      t('room.leaveMoveConfirmMessage'),
      t('room.leaveMove')
    );
    if (!confirmed) return;
    try {
      await removeMember(membership.id);
      router.replace('/');
    } catch (err) {
      notify(t('room.couldNotLeave'), err instanceof Error ? err.message : t('common.pleaseTryAgain'));
    }
  };

  if (loading) {
    return (
      <Screen>
        <SubHeader title="" onBack={handleBack} />
        <View style={styles.center}>
          <ActivityIndicator color={colors.brand} />
        </View>
      </Screen>
    );
  }

  // Not a member yet (or request was rejected): preview + join flow.
  if (!move && !isApproved) {
    if (!previewMove) {
      return (
        <Screen>
          <SubHeader title="" onBack={handleBack} />
          <View style={styles.center}>
            <Text style={[styles.emptyText, { color: colors.textMuted, fontFamily: font.family.bodyRegular }]}>{t('room.notAvailable')}</Text>
          </View>
        </Screen>
      );
    }

    const pending = membership?.status === 'pending';
    // A rejected row still occupies the unique (move_id, user_id) constraint,
    // so a fresh requestToJoin() would fail - there's no re-request flow yet.
    const rejected = membership?.status === 'rejected';

    return (
      <Screen style={styles.noPadding}>
        <SubHeader title={previewMove.title} onBack={handleBack} />
        <View style={styles.previewContent}>
          <View style={styles.previewHeader}>
            <Avatar
              uri={previewMove.host_avatar_url}
              name={previewMove.host_display_name ?? previewMove.host_username}
              size={56}
              tint={previewMove.degree_limit}
            />
            <Text style={[styles.title, { color: colors.textPrimary, fontFamily: font.family.bodySemibold }]}>{previewMove.title}</Text>
            <Text style={[styles.hostLine, { color: colors.textMuted, fontFamily: font.family.monoRegular }]}>
              {t('common.hostedByName', { name: previewMove.host_display_name ?? previewMove.host_username })}
            </Text>
          </View>

          {previewMove.description ? (
            <Text style={[styles.description, { color: colors.textSecondary, fontFamily: font.family.bodyRegular }]}>{previewMove.description}</Text>
          ) : null}

          <View style={styles.metaRow}>
            <Badge label={formatWhen(previewMove.starts_at, previewMove.expires_at, t)} tone="green" />
            <Badge
              label={t(`degree.badge.${previewMove.degree_limit}`)}
              tone={DEGREE_TONE[previewMove.degree_limit]}
            />
            {previewMove.requires_approval ? <Badge label={t('room.approvalRequired')} tone="yellow" /> : null}
          </View>

          <Text style={[styles.helperText, { color: colors.textMuted, fontFamily: font.family.monoRegular }]}>
            {previewMove.max_members
              ? t('room.peopleJoined', { count: previewMove.approved_count, max: previewMove.max_members })
              : t('room.peopleJoinedNoCap', { count: previewMove.approved_count })}
            {' · '}
            {t('room.locationRevealed')}
          </Text>

          {pending ? (
            <>
              <Text style={[styles.waitingText, { color: colors.textPrimary, fontFamily: font.family.bodySemibold }]}>{t('room.waitingApproval')}</Text>
              <Button label={t('room.cancelRequest')} variant="secondary" onPress={handleCancelRequest} loading={joining} size="lg" />
            </>
          ) : rejected ? (
            <Text style={[styles.waitingText, { color: colors.textPrimary, fontFamily: font.family.bodySemibold }]}>{t('room.requestDeclined')}</Text>
          ) : previewMove.is_full ? (
            <Button label={t('room.moveFull')} variant="secondary" onPress={() => {}} disabled size="lg" />
          ) : (
            <Button
              label={previewMove.requires_approval ? t('room.requestToJoin') : t('room.joinMove')}
              onPress={handleJoin}
              loading={joining}
              size="lg"
            />
          )}

          {reportOpen ? (
            <ReportUserPanel
              userId={previewMove.host_id}
              name={previewMove.host_display_name ?? previewMove.host_username}
              moveId={previewMove.id}
              onDone={() => setReportOpen(false)}
            />
          ) : (
            <HoverPressable onPress={() => setReportOpen(true)} style={styles.reportLinkWrap}>
              <Text style={[styles.reportLink, { color: colors.danger, fontFamily: font.family.monoBold }]}>{t('room.reportMove')}</Text>
            </HoverPressable>
          )}
        </View>
      </Screen>
    );
  }

  if (!move) {
    return (
      <Screen>
        <SubHeader title="" onBack={handleBack} />
        <View style={styles.center}>
          <ActivityIndicator color={colors.brand} />
        </View>
      </Screen>
    );
  }

  const approvedMembers = members.filter((m) => m.status === 'approved');
  const pendingMembers = members.filter((m) => m.status === 'pending');
  const hostMember = members.find((m) => m.user_id === move.host_id);
  const isActive = move.status === 'active';
  const countdownTarget = isActive
    ? move.expires_at
    : move.cooldown_started_at
      ? new Date(new Date(move.cooldown_started_at).getTime() + 60 * 60_000).toISOString()
      : move.expires_at;
  const countdown = formatCountdown(countdownTarget);

  return (
    <Screen style={styles.noPadding}>
      {/* Collapsible header: title/countdown + who's-here, shrinks to a mini-bar */}
      <Animated.View style={[styles.collapsibleHeader, headerContainerStyle]}>
        <View pointerEvents={headerCollapsed ? 'auto' : 'none'} style={styles.miniBarAbs}>
          <Animated.View style={[styles.miniBar, { backgroundColor: colors.bgElevated, borderBottomWidth: borderWidth.emphatic, borderBottomColor: colors.border }, miniBarStyle]}>
            <HoverPressable onPress={expandChat} style={styles.miniBarPressable} lightenOpacity={0.08}>
              <AvatarStack
                size={22}
                avatars={approvedMembers.slice(0, 4).map((m) => ({ src: m.profile.avatar_url ?? undefined, alt: m.profile.display_name ?? m.profile.username }))}
                overflow={Math.max(0, approvedMembers.length - 4)}
              />
              <Text style={[styles.miniBarTitle, { color: colors.textPrimary, fontFamily: font.family.bodySemibold }]} numberOfLines={1}>
                {move.title}
              </Text>
              <Badge
                label={isActive ? t('room.endsIn', { time: countdown }) : t('room.closingIn', { time: countdown })}
                tone={isActive ? 'green' : 'pink'}
              />
            </HoverPressable>
          </Animated.View>
        </View>

        <Animated.View
          pointerEvents={headerCollapsed ? 'none' : 'auto'}
          style={fullHeaderStyle}
          onLayout={(e) => {
            expandedHeaderHeight.value = e.nativeEvent.layout.height;
          }}
        >
      <View style={[styles.headerBlock, { borderBottomWidth: borderWidth.emphatic, borderBottomColor: colors.border }]}>
        <View style={[styles.backStrip, { borderBottomWidth: border.soft.width, borderBottomColor: border.soft.color }]}>
          <HoverPressable onPress={handleBack} lightenOpacity={0.08} style={styles.backButton}>
            <Text style={[styles.backText, { color: colors.textPrimary, fontFamily: font.family.monoBold }]}>← {t('common.back').toUpperCase()}</Text>
          </HoverPressable>
        </View>

        <View style={styles.headerMain}>
          <View style={styles.headerLeft}>
            <Badge
              label={isActive ? t('room.endsIn', { time: countdown }) : t('room.closingIn', { time: countdown })}
              tone={isActive ? 'green' : 'pink'}
            />
            <Text style={[styles.title, styles.headerTitle, { color: colors.textPrimary, fontFamily: font.family.bodySemibold }]} numberOfLines={2}>
              {move.title}
            </Text>
            <HoverPressable
              onPress={() => (hostMember && hostMember.user_id !== myId ? router.push(`/users/${hostMember.user_id}`) : undefined)}
              style={styles.hostLineWrap}
              lightenOpacity={0.1}
            >
              <Text style={[styles.hostLine, { color: colors.textMuted, fontFamily: font.family.monoRegular }]}>
                {t('common.hostedByName', { name: hostMember ? hostMember.profile.display_name ?? hostMember.profile.username : '…' })}
              </Text>
            </HoverPressable>
          </View>

          <View style={styles.headerRight}>
            <Text style={[styles.countdown, { color: colors.textPrimary, fontFamily: font.family.heroDisplay }]} key={countdown}>
              {countdown}
            </Text>
            <Text style={[styles.countdownLabel, { color: colors.textMuted, fontFamily: font.family.monoRegular }]}>{t('moveCreated.left')}</Text>
          </View>
        </View>

        <View style={styles.metaRow}>
          <Badge label={t(`degree.badge.${move.degree_limit}`)} tone={DEGREE_TONE[move.degree_limit]} />
          {move.requires_approval ? <Badge label={t('room.approvalRequired')} tone="yellow" /> : null}
          <Text style={[styles.memberCount, { color: colors.textMuted, fontFamily: font.family.monoRegular }]}>
            {move.max_members ? t('room.hereWithCap', { count: approvedMembers.length, max: move.max_members }) : t('room.here', { count: approvedMembers.length })}
          </Text>
        </View>

        {isHost ? (
          <View style={styles.hostActionsRow}>
            {isActive ? (
              <HoverPressable onPress={handleEndMove} style={styles.endLinkWrap}>
                <Text style={[styles.endLink, { color: colors.danger, fontFamily: font.family.monoBold }]}>{t('room.endMove')}</Text>
              </HoverPressable>
            ) : null}
            <HoverPressable onPress={handleDeleteMove} style={styles.endLinkWrap}>
              <Text style={[styles.deleteLink, { color: colors.textMuted, fontFamily: font.family.monoBold }]}>{t('room.delete')}</Text>
            </HoverPressable>
          </View>
        ) : (
          <View style={styles.hostActionsRow}>
            <HoverPressable onPress={handleLeaveMove} style={styles.endLinkWrap}>
              <Text style={[styles.deleteLink, { color: colors.textMuted, fontFamily: font.family.monoBold }]}>{t('room.leaveMove')}</Text>
            </HoverPressable>
            <HoverPressable onPress={() => setReportOpen((o) => !o)} style={styles.endLinkWrap}>
              <Text style={[styles.deleteLink, { color: colors.danger, fontFamily: font.family.monoBold }]}>{t('room.reportMove')}</Text>
            </HoverPressable>
          </View>
        )}
      </View>

      {/* GOING block */}
      {approvedMembers.length > 0 ? (
        <View style={[styles.goingBlock, { borderBottomWidth: border.soft.width, borderBottomColor: border.soft.color }]}>
          <View style={styles.goingHeaderRow}>
            <Text style={[styles.sectionTitle, { color: colors.textMuted, fontFamily: font.family.monoBold }]}>{t('room.whosHere')}</Text>
            <Text style={[styles.goingCount, { color: colors.textPrimary, fontFamily: font.family.heroDisplay }]}>{approvedMembers.length}</Text>
          </View>
          <View style={styles.avatarStackWrap}>
            <AvatarStack
              size={32}
              avatars={approvedMembers.slice(0, 6).map((m) => ({ src: m.profile.avatar_url ?? undefined, alt: m.profile.display_name ?? m.profile.username }))}
              overflow={Math.max(0, approvedMembers.length - 6)}
            />
          </View>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={approvedMembers}
            keyExtractor={(m) => m.id}
            contentContainerStyle={styles.attendeeRow}
            renderItem={({ item: m }) => (
              <HoverPressable
                onPress={() => (m.user_id !== myId ? router.push(`/users/${m.user_id}`) : undefined)}
                style={styles.attendeeTile}
                lightenOpacity={0.15}
              >
                <View style={styles.attendeeAvatarWrap}>
                  <Avatar uri={m.profile.avatar_url} name={m.profile.display_name ?? m.profile.username} size={48} closeFriend={closeFriendIds.has(m.user_id)} />
                  {isHost && m.user_id !== move.host_id ? (
                    <HoverPressable onPress={() => handleKick(m.id)} style={[styles.kickBadge, { backgroundColor: colors.danger, borderColor: colors.border, borderWidth: border.rest.width }]}>
                      <Text style={[styles.kickText, { color: colors.textInverse }]}>×</Text>
                    </HoverPressable>
                  ) : null}
                </View>
                <Text style={[styles.attendeeName, { color: colors.textMuted, fontFamily: font.family.monoRegular }]} numberOfLines={1}>
                  {(m.profile.display_name ?? m.profile.username).split(' ')[0]}
                </Text>
              </HoverPressable>
            )}
          />
        </View>
      ) : null}
        </Animated.View>
      </Animated.View>

      {reportOpen && !isHost && hostMember ? (
        <View style={styles.reportPanelWrap}>
          <ReportUserPanel
            userId={move.host_id}
            name={hostMember.profile.display_name ?? hostMember.profile.username}
            moveId={move.id}
            onDone={() => setReportOpen(false)}
          />
        </View>
      ) : null}

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        onTouchStart={collapseChat}
      >
        {move.degree_limit === 0 ? <ShareMovePanel shareToken={move.share_token} /> : null}

        {/* Approval requests (host only, inline) */}
        {isHost && pendingMembers.length > 0 ? (
          <View style={[styles.requestsSection, { borderBottomWidth: border.soft.width, borderBottomColor: border.soft.color }]}>
            <Text style={[styles.sectionTitle, { color: colors.textMuted, fontFamily: font.family.monoBold }]}>{t('room.requests', { count: pendingMembers.length })}</Text>
            {pendingMembers.map((pm) => (
              <View key={pm.id} style={styles.requestRow}>
                <HoverPressable
                  onPress={() => router.push(`/users/${pm.user_id}`)}
                  style={styles.requestIdentityWrap}
                  lightenOpacity={0.1}
                >
                  <Avatar uri={pm.profile.avatar_url} name={pm.profile.display_name ?? pm.profile.username} size={44} closeFriend={closeFriendIds.has(pm.user_id)} />
                  <Text style={[styles.requestName, { color: colors.textPrimary, fontFamily: font.family.bodySemibold }]} numberOfLines={1}>
                    {pm.profile.display_name ?? pm.profile.username}
                  </Text>
                </HoverPressable>
                <Button label={t('room.decline')} variant="secondary" size="sm" onPress={() => handleReject(pm.id)} />
                <Button label={t('room.approve')} size="sm" onPress={() => handleApprove(pm.id)} />
              </View>
            ))}
          </View>
        ) : null}

        {/* Chat */}
        {move.chat_enabled ? (
          <>
            <FlatList
              ref={messagesRef}
              data={messages}
              keyExtractor={(item) => item.id}
              onScrollBeginDrag={collapseChat}
              contentContainerStyle={styles.messagesContent}
              renderItem={({ item }) => {
                const mine = item.sender_id === myId;
                return (
                  <View>
                    <View style={[styles.messageRow, mine && styles.messageRowMine]}>
                      {!mine ? (
                        <HoverPressable onPress={() => router.push(`/users/${item.sender_id}`)} lightenOpacity={0.15}>
                          <Avatar uri={item.sender.avatar_url} name={item.sender.display_name ?? item.sender.username} size={28} closeFriend={closeFriendIds.has(item.sender_id)} />
                        </HoverPressable>
                      ) : null}
                      <View
                        style={[
                          styles.bubble,
                          { borderWidth: border.rest.width, borderColor: border.rest.color },
                          mine ? { backgroundColor: colors.brand } : { backgroundColor: colors.bgCard },
                        ]}
                      >
                        {!mine ? (
                          <View style={styles.senderRow}>
                            <HoverPressable onPress={() => router.push(`/users/${item.sender_id}`)} style={styles.senderNameWrap} lightenOpacity={0.1}>
                              <Text style={[styles.senderName, { color: colors.textMuted, fontFamily: font.family.monoBold }]}>{item.sender.display_name ?? item.sender.username}</Text>
                            </HoverPressable>
                            <HoverPressable
                              onPress={() => setReportingMessageId((id) => (id === item.id ? null : item.id))}
                              style={styles.messageReportButton}
                              lightenOpacity={0.15}
                            >
                              <Text style={[styles.messageReportIcon, { color: colors.textMuted }]}>⚑</Text>
                            </HoverPressable>
                          </View>
                        ) : null}
                        <Text style={[styles.messageText, { color: colors.textPrimary, fontFamily: font.family.bodyRegular }]}>{item.content}</Text>
                      </View>
                    </View>
                    {reportingMessageId === item.id ? (
                      <View style={styles.messageReportPanelWrap}>
                        <ReportUserPanel
                          userId={item.sender_id}
                          name={item.sender.display_name ?? item.sender.username}
                          messageId={item.id}
                          onDone={() => setReportingMessageId(null)}
                        />
                      </View>
                    ) : null}
                  </View>
                );
              }}
              ListEmptyComponent={<Text style={[styles.emptyText, { color: colors.textMuted, fontFamily: font.family.bodyRegular }]}>{t('room.noMessagesYet')}</Text>}
            />

            {isActive ? (
              <GestureDetector gesture={composerPan}>
                <View style={[styles.composer, { borderTopWidth: border.rest.width, borderTopColor: border.rest.color, backgroundColor: colors.bg }]}>
                  <View style={styles.composerInput}>
                    <TextField
                      ref={composerInputRef}
                      value={messageText}
                      onChangeText={setMessageText}
                      placeholder={t('room.messagePlaceholder')}
                      onSubmitEditing={handleSend}
                    />
                  </View>
                  <Button label={t('room.send')} onPress={handleSend} size="md" />
                </View>
              </GestureDetector>
            ) : (
              <View style={styles.closedBanner}>
                <Text style={[styles.closedText, { color: colors.textMuted, fontFamily: font.family.bodyRegular }]}>{t('room.moveEnded')}</Text>
              </View>
            )}
          </>
        ) : (
          <View style={styles.center}>
            <Text style={[styles.emptyText, { color: colors.textMuted, fontFamily: font.family.bodyRegular }]}>{t('room.chatDisabled')}</Text>
          </View>
        )}
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  noPadding: { padding: 0 },
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 14, textAlign: 'center', paddingVertical: 24 },

  previewContent: { flex: 1, padding: 16, gap: 16 },
  previewHeader: { alignItems: 'center', gap: 4, paddingVertical: 16 },
  title: { fontSize: 22, lineHeight: 26 },
  headerTitle: { marginBottom: 2 },
  hostLine: { fontSize: 11, letterSpacing: 0.9 },
  description: { fontSize: 16 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingBottom: 12 },
  helperText: { fontSize: 11 },
  waitingText: { fontSize: 15, textAlign: 'center' },
  reportLinkWrap: { alignSelf: 'center', paddingHorizontal: 8, paddingVertical: 4 },
  reportLink: { fontSize: 11, letterSpacing: 0.9 },
  reportPanelWrap: { paddingHorizontal: 16, paddingTop: 12 },

  collapsibleHeader: {
    flexShrink: 0,
    overflow: 'hidden',
  },
  miniBarAbs: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: MINI_BAR_HEIGHT,
    zIndex: 2,
  },
  miniBar: {
    flex: 1,
    justifyContent: 'center',
  },
  miniBarPressable: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
  },
  miniBarTitle: {
    flex: 1,
    fontSize: 15,
  },
  headerBlock: {
    flexShrink: 0,
  },
  backStrip: {
    height: 44,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  backButton: {
    alignSelf: 'flex-start',
  },
  backText: {
    fontSize: 11,
    letterSpacing: 0.9,
  },
  headerMain: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    paddingBottom: 10,
  },
  headerLeft: {
    flex: 1,
    gap: 10,
  },
  headerRight: {
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
    gap: 2,
  },
  countdown: {
    fontSize: 36,
    lineHeight: 36,
  },
  countdownLabel: {
    fontSize: 10,
    letterSpacing: 0.9,
  },
  hostLineWrap: {
    alignSelf: 'flex-start',
  },
  memberCount: { fontSize: 11, letterSpacing: 0.7 },
  hostActionsRow: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 16, paddingBottom: 12 },
  endLinkWrap: { paddingHorizontal: 8, paddingVertical: 4 },
  endLink: { fontSize: 12, letterSpacing: 0.7 },
  deleteLink: { fontSize: 12, letterSpacing: 0.7 },

  goingBlock: { padding: 16, gap: 12 },
  goingHeaderRow: { flexDirection: 'row', alignItems: 'baseline', gap: 12 },
  goingCount: { fontSize: 24, lineHeight: 24 },
  avatarStackWrap: {},
  attendeeRow: { gap: 12 },
  attendeeTile: { alignItems: 'center', gap: 6, width: 56 },
  attendeeAvatarWrap: { position: 'relative' },
  attendeeName: { fontSize: 10, letterSpacing: 0.7, maxWidth: 56 },

  requestsSection: { paddingHorizontal: 16, paddingVertical: 12, gap: 10 },
  sectionTitle: { fontSize: 10, letterSpacing: 0.9 },
  requestRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  requestIdentityWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  requestName: { flex: 1, fontSize: 15 },

  messagesContent: { padding: 16, gap: 12, flexGrow: 1 },
  messageRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, maxWidth: '85%' },
  messageRowMine: { alignSelf: 'flex-end' },
  bubble: { paddingHorizontal: 12, paddingVertical: 8 },
  senderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 2 },
  senderNameWrap: { alignSelf: 'flex-start' },
  senderName: { fontSize: 11, letterSpacing: 0.7 },
  messageReportButton: { padding: 2, borderRadius: 4 },
  messageReportIcon: { fontSize: 11 },
  messageReportPanelWrap: { marginTop: 6, marginBottom: 6 },
  messageText: { fontSize: 14 },

  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 16 },
  composerInput: { flex: 1 },

  closedBanner: { padding: 16, alignItems: 'center' },
  closedText: { fontSize: 14 },

  kickBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kickText: { fontSize: 12, fontWeight: '700', lineHeight: 14 },
});
