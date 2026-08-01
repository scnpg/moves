import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { Badge } from '@/components/Badge';
import { Card } from '@/components/Card';
import type { EligibleMove } from '@/lib/database.types';
import { formatDistance, formatWhen } from '@/lib/format';
import { color, degreeLabel, font, spacing } from '@/theme/tokens';

interface MoveCardProps {
  move: EligibleMove;
  hostIsCloseFriend?: boolean;
  onPress: () => void;
}

export function MoveCard({ move, hostIsCloseFriend, onPress }: MoveCardProps) {
  const distance = formatDistance(move.distance_m);

  return (
    <Pressable onPress={onPress}>
      <Card style={styles.card}>
        <View style={styles.header}>
          <Avatar
            uri={move.host_avatar_url}
            name={move.host_display_name ?? move.host_username}
            size={40}
            closeFriend={hostIsCloseFriend}
          />
          <View style={styles.headerText}>
            <Text style={styles.title} numberOfLines={1}>
              {move.title}
            </Text>
            <Text style={styles.host} numberOfLines={1}>
              Hosted by {move.host_display_name ?? move.host_username}
            </Text>
          </View>
        </View>

        {move.description ? (
          <Text style={styles.description} numberOfLines={2}>
            {move.description}
          </Text>
        ) : null}

        <View style={styles.metaRow}>
          <Badge label={formatWhen(move.starts_at, move.expires_at)} tone="brand" />
          <Badge label={degreeLabel[move.degree_limit]} />
          {move.requires_approval ? <Badge label="Approval required" tone="warning" /> : null}
          {move.is_full ? <Badge label="Full" tone="danger" /> : null}
        </View>

        <View style={styles.footerRow}>
          <Text style={styles.footerText}>
            {move.max_members ? `${move.approved_count}/${move.max_members} joined` : `${move.approved_count} joined`}
          </Text>
          {distance ? <Text style={styles.footerText}>{distance}</Text> : null}
        </View>
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
  },
  title: {
    color: color.textPrimary,
    fontSize: font.size.md,
    fontWeight: font.weight.semibold,
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
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerText: {
    color: color.textMuted,
    fontSize: font.size.xs,
  },
});
