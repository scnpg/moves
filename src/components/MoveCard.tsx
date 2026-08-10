import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { Avatar } from '@/components/Avatar';
import { Badge } from '@/components/Badge';
import { useLocale } from '@/i18n/LocaleProvider';
import type { EligibleMove } from '@/lib/database.types';
import { formatDistance } from '@/lib/format';
import { countdownTargetFor, deriveMoveStatus, type MoveCardStatus } from '@/lib/moveStatus';
import { formatCountdown } from '@/lib/format';
import { useTheme } from '@/theme/ThemeProvider';

interface MoveCardProps {
  move: EligibleMove;
  hostIsCloseFriend?: boolean;
  onPress: () => void;
  /** Condensed single-row layout for lists nested inside another screen (e.g. profile's active moves). */
  compact?: boolean;
}

const DEGREE_TONE = { 0: 'violet', 1: 'green', 2: 'blue', 3: 'pink', 4: 'red' } as const;

/** Live-ticking "M:SS" style string, remounting the crossfade whenever it changes. Stops ticking once ended. */
function useLiveCountdown(targetIso: string, status: MoveCardStatus): string {
  const [text, setText] = useState(() => formatCountdown(targetIso));

  useEffect(() => {
    setText(formatCountdown(targetIso));
    if (status === 'ended') return;
    const id = setInterval(() => setText(formatCountdown(targetIso)), 1000);
    return () => clearInterval(id);
  }, [targetIso, status]);

  return text;
}

/** The one eased moment in the whole design system: a 200ms opacity crossfade on every digit change. */
function CrossfadeText({ text, style }: { text: string; style: object[] | object }) {
  const opacity = useSharedValue(1);

  useEffect(() => {
    opacity.value = 0;
    opacity.value = withTiming(1, { duration: 200, easing: Easing.linear });
  }, [text, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.Text style={[style, animatedStyle]} key={text}>
      {text}
    </Animated.Text>
  );
}

function statusPillColors(theme: ReturnType<typeof useTheme>, status: MoveCardStatus) {
  const { colors } = theme;
  switch (status) {
    case 'live':
      return { bg: colors.accentGreenFlat, fg: colors.onAccent, dot: true };
    case 'starting':
      return { bg: colors.bgCard, fg: colors.textPrimary, dot: false };
    case 'ending':
      return { bg: colors.border, fg: colors.bgCard, dot: false };
    case 'full':
      return { bg: colors.bgElevated, fg: colors.textPrimary, dot: false };
    case 'ended':
      return { bg: colors.bgElevated, fg: colors.textMuted, dot: false };
  }
}

export function MoveCard({ move, hostIsCloseFriend, onPress, compact }: MoveCardProps) {
  const { t } = useLocale();
  const theme = useTheme();
  const { colors, border, card, font } = theme;

  const status = deriveMoveStatus(move);
  const countdownTarget = countdownTargetFor(status, move);
  const countdown = useLiveCountdown(countdownTarget, status);
  const distance = formatDistance(move.distance_m, t, theme.unitSystem);
  const hostName = move.host_display_name ?? move.host_username;

  const statusLabel =
    status === 'live'
      ? t('moveCard.statusLive')
      : status === 'starting'
        ? t('moveCard.statusStarting', {
            time: new Date(move.starts_at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }),
          })
        : status === 'ending'
          ? t('moveCard.statusEnding')
          : status === 'full'
            ? t('moveCard.statusFull')
            : t('moveCard.statusEnded');

  const pill = statusPillColors(theme, status);
  const cardBorder = status === 'live' ? card.live : card.rest;

  if (compact) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [styles.compactRow, pressed && { opacity: 0.7 }, { backgroundColor: colors.bgCard }]}>
        <Avatar uri={move.host_avatar_url} name={hostName} size={36} tint={move.degree_limit} />
        <Text style={[styles.compactTitle, { color: colors.textPrimary, fontFamily: font.family.bodySemibold }]} numberOfLines={1}>
          {move.title}
        </Text>
        <CrossfadeText text={countdown} style={[styles.compactCountdown, { color: colors.textPrimary, fontFamily: font.family.monoBold }]} />
      </Pressable>
    );
  }

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [pressed && { opacity: 0.85 }]}>
      <View style={[styles.card, { backgroundColor: colors.bgCard, borderWidth: cardBorder.width, borderColor: cardBorder.color }]}>
        <View style={[styles.statusStrip, { borderBottomWidth: border.soft.width, borderBottomColor: border.soft.color }]}>
          <View style={[styles.statusPill, { backgroundColor: pill.bg, borderWidth: border.rest.width, borderColor: colors.border }]}>
            {pill.dot ? <View style={[styles.statusDot, { backgroundColor: pill.fg }]} /> : null}
            <Text style={[styles.statusPillText, { color: pill.fg, fontFamily: font.family.monoRegular }]}>{statusLabel}</Text>
          </View>
          <View style={status === 'ending' ? [styles.countdownEndingBlock, { backgroundColor: colors.border }] : undefined}>
            <CrossfadeText
              text={countdown}
              style={[
                styles.countdownText,
                { color: status === 'ending' ? colors.bgCard : colors.textPrimary, fontFamily: font.family.monoBold },
              ]}
            />
          </View>
        </View>

        <View style={styles.content}>
          <View style={styles.header}>
            <Avatar
              uri={move.host_avatar_url}
              name={hostName}
              size={44}
              closeFriend={hostIsCloseFriend}
              hosting={status === 'live'}
              tint={move.degree_limit}
            />
            <View style={styles.headerText}>
              <Text style={[styles.title, { color: colors.textPrimary, fontFamily: font.family.bodySemibold }]} numberOfLines={2}>
                {move.title}
              </Text>
              {move.description ? (
                <Text style={[styles.description, { color: colors.textSecondary, fontFamily: font.family.bodyRegular }]} numberOfLines={1}>
                  {move.description}
                </Text>
              ) : (
                <Text style={[styles.host, { color: colors.textMuted, fontFamily: font.family.bodyRegular }]} numberOfLines={1}>
                  {t('common.hostedByName', { name: hostName })}
                </Text>
              )}
            </View>
          </View>

          <View style={styles.metaRow}>
            <Badge label={t(`degree.badge.${move.degree_limit}`)} tone={DEGREE_TONE[move.degree_limit]} />
            <Text style={[styles.metaText, { color: colors.textMuted, fontFamily: font.family.monoRegular }]}>
              {t('moveCard.peopleIn', { count: move.approved_count })}
            </Text>
            {move.requires_approval ? <Badge label={t('moveCard.approval')} tone="yellow" /> : null}
            {move.is_full ? <Badge label={t('moveCard.full')} tone="ink" /> : null}
            {distance ? <Text style={[styles.metaText, { color: colors.textMuted, fontFamily: font.family.monoRegular }]}>{distance}</Text> : null}
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
  },
  statusStrip: {
    height: 36,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusPill: {
    height: 22,
    borderRadius: 999,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
  },
  statusPillText: {
    fontSize: 11,
    letterSpacing: 0.9,
  },
  countdownEndingBlock: {
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  countdownText: {
    fontSize: 13,
    letterSpacing: 0.5,
  },
  content: {
    padding: 16,
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 16,
  },
  host: {
    fontSize: 12,
  },
  description: {
    fontSize: 14,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  metaText: {
    fontSize: 11,
  },
  compactRow: {
    height: 72,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  compactTitle: {
    flex: 1,
    fontSize: 15,
  },
  compactCountdown: {
    fontSize: 13,
  },
});
