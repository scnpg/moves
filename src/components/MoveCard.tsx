import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { Badge } from '@/components/Badge';
import { Card } from '@/components/Card';
import { useLocale } from '@/i18n/LocaleProvider';
import type { EligibleMove } from '@/lib/database.types';
import { formatDistance, formatTimeRemaining, formatWhen } from '@/lib/format';
import { color, degreeColor, font, spacing } from '@/theme/tokens';

interface MoveCardProps {
  move: EligibleMove;
  hostIsCloseFriend?: boolean;
  onPress: () => void;
}

const DEGREE_TONE = { 0: 'violet', 1: 'green', 2: 'blue', 3: 'pink', 4: 'red' } as const;

export function MoveCard({ move, hostIsCloseFriend, onPress }: MoveCardProps) {
  const { t } = useLocale();
  const distance = formatDistance(move.distance_m, t);
  const isLive = new Date(move.starts_at).getTime() <= Date.now();

  return (
    <Pressable onPress={onPress}>
      <Card style={styles.card} accentColor={degreeColor[move.degree_limit]}>
        <View style={styles.header}>
          <Avatar
            uri={move.host_avatar_url}
            name={move.host_display_name ?? move.host_username}
            size={44}
            closeFriend={hostIsCloseFriend}
            hosting={isLive}
            tint={move.degree_limit}
          />
          <View style={styles.headerText}>
            <Text style={styles.title} numberOfLines={1}>
              {move.title}
            </Text>
            {move.description ? (
              <Text style={styles.description} numberOfLines={1}>
                {move.description}
              </Text>
            ) : (
              <Text style={styles.host} numberOfLines={1}>
                {t('common.hostedByName', { name: move.host_display_name ?? move.host_username })}
              </Text>
            )}
          </View>
        </View>

        <View style={styles.metaRow}>
          <Badge label={t(`degree.badge.${move.degree_limit}`)} tone={DEGREE_TONE[move.degree_limit]} />
          <Text style={styles.metaText}>
            {t('moveCard.peopleIn', { count: move.approved_count })} ·{' '}
            {isLive ? formatTimeRemaining(move.expires_at, t) : formatWhen(move.starts_at, move.expires_at, t)}
          </Text>
          {move.requires_approval ? <Badge label={t('moveCard.approval')} tone="yellow" /> : null}
          {move.is_full ? <Badge label={t('moveCard.full')} tone="ink" /> : null}
        </View>

        {distance ? <Text style={styles.distanceText}>{distance}</Text> : null}
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  title: {
    color: color.textPrimary,
    fontSize: font.size.md,
    fontWeight: font.weight.heavy,
  },
  host: {
    color: color.textMuted,
    fontSize: font.size.xs,
  },
  description: {
    color: color.textSecondary,
    fontSize: font.size.sm,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  metaText: {
    fontFamily: font.family.mono,
    color: color.textMuted,
    fontSize: font.size.xs,
  },
  distanceText: {
    fontFamily: font.family.mono,
    color: color.textMuted,
    fontSize: font.size.xs,
  },
});
