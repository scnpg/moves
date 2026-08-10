import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { useLocale } from '@/i18n/LocaleProvider';
import { useTheme } from '@/theme/ThemeProvider';

interface LocationRequiredScreenProps {
  loading: boolean;
  denied: boolean;
  onRetry: () => void;
}

/**
 * Full-screen block shown in place of the tab UI whenever a signed-in user
 * has no resolved location - Moves is a location-first app (nearby feed,
 * map centering, Move creation), so there's no useful degraded mode to fall
 * back to instead of just asking again.
 */
export function LocationRequiredScreen({ loading, denied, onRetry }: LocationRequiredScreenProps) {
  const { t } = useLocale();
  const { colors, font } = useTheme();

  return (
    <View style={[styles.wrap, { backgroundColor: colors.bg }]}>
      <Text style={styles.icon}>📍</Text>
      <Text style={[styles.title, { color: colors.textPrimary, fontFamily: font.family.heroDisplay }]}>
        {t('locationGate.title')}
      </Text>
      <Text style={[styles.body, { color: colors.textSecondary, fontFamily: font.family.bodyRegular }]}>
        {denied ? t('locationGate.deniedBody') : t('locationGate.body')}
      </Text>
      {loading ? (
        <ActivityIndicator color={colors.brand} style={styles.spinner} />
      ) : (
        <Button label={t('locationGate.enableButton')} onPress={onRetry} style={styles.button} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  icon: {
    fontSize: 40,
    marginBottom: 4,
  },
  title: {
    fontSize: 24,
    textAlign: 'center',
  },
  body: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 8,
  },
  spinner: {
    marginTop: 8,
  },
  button: {
    marginTop: 8,
    minWidth: 200,
  } as object,
});
