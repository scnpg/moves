import { StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { HoverPressable } from '@/components/HoverPressable';
import { useLocale } from '@/i18n/LocaleProvider';
import { useTheme } from '@/theme/ThemeProvider';

interface ContactInviteRowProps {
  name: string;
  invited: boolean;
  /** Caps a "pick 3" flow - greys the button out without changing its label. */
  disabled?: boolean;
  onInvite: () => void;
}

/** A device contact with no Moves account yet, plus an SMS-invite action - shared by the Search screen and the onboarding "connect" slide. */
export function ContactInviteRow({ name, invited, disabled, onInvite }: ContactInviteRowProps) {
  const { t } = useLocale();
  const { colors, border, font } = useTheme();
  const muted = invited || disabled;

  return (
    <View style={styles.row}>
      <Avatar name={name} size={44} />
      <Text style={[styles.name, { color: colors.textPrimary, fontFamily: font.family.bodySemibold }]} numberOfLines={1}>
        {name}
      </Text>
      <HoverPressable
        onPress={onInvite}
        disabled={muted}
        style={[
          styles.action,
          muted
            ? { borderWidth: border.soft.width, borderColor: border.soft.color }
            : { backgroundColor: colors.brand, borderWidth: border.rest.width, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.actionText, { color: muted ? colors.textMuted : colors.onAccent, fontFamily: font.family.monoBold }]}>
          {invited ? t('search.invited') : t('search.invite')}
        </Text>
      </HoverPressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  name: {
    flex: 1,
    fontSize: 15,
  },
  action: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  actionText: {
    fontSize: 10,
    letterSpacing: 0.8,
  },
});
