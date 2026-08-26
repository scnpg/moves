import { useEffect, useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Link } from 'expo-router';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { LanguageToggle } from '@/components/LanguageToggle';
import { Screen } from '@/components/Screen';
import { SunburstBackdrop } from '@/components/Streamline';
import { TextField } from '@/components/TextField';
import { signIn, signInWithApple } from '@/features/auth/api';
import { useLocale } from '@/i18n/LocaleProvider';
import { notify } from '@/lib/alerts';
import { useTheme } from '@/theme/ThemeProvider';

export default function SignInScreen() {
  const { t } = useLocale();
  const insets = useSafeAreaInsets();
  const { colors, border, font, scheme } = useTheme();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [appleAvailable, setAppleAvailable] = useState(false);

  useEffect(() => {
    AppleAuthentication.isAvailableAsync().then(setAppleAvailable);
  }, []);

  const handleSignIn = async () => {
    if (!identifier || !password) return;
    setLoading(true);
    try {
      await signIn({ identifier: identifier.trim(), password });
    } catch (err) {
      notify(t('auth.signInFailed'), err instanceof Error ? err.message : t('auth.pleaseTryAgain'));
    } finally {
      setLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    if (appleLoading) return;
    setAppleLoading(true);
    try {
      await signInWithApple();
    } catch (err) {
      notify(t('auth.signInFailed'), err instanceof Error ? err.message : t('auth.pleaseTryAgain'));
    } finally {
      setAppleLoading(false);
    }
  };

  return (
    <Screen>
      <View style={[styles.langCorner, { top: insets.top + 8 }]}>
        <LanguageToggle />
      </View>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.logoWrap}>
            <SunburstBackdrop />
            <Image
              source={
                scheme === 'dark'
                  ? require('../../../assets/images/movesletterlogo-trimmed-dark.png')
                  : require('../../../assets/images/movesletterlogo-trimmed.png')
              }
              style={styles.title}
              resizeMode="contain"
            />
            <Text style={[styles.tagline, { color: colors.textPrimary, fontFamily: font.family.bodyRegular }]}>
              {t('auth.tagline')}
            </Text>
          </View>

          <View style={styles.form}>
            <TextField
              label={t('auth.emailOrUsername')}
              value={identifier}
              onChangeText={setIdentifier}
              autoCapitalize="none"
              placeholder={t('auth.emailOrUsernamePlaceholder')}
            />
            <TextField
              label={t('auth.password')}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder={t('auth.passwordPlaceholder')}
            />
            <Button label={t('auth.signIn')} onPress={handleSignIn} loading={loading} size="lg" />
          </View>

          {appleAvailable ? (
            <View style={styles.appleSection}>
              <View style={styles.dividerRow}>
                <View style={[styles.dividerLine, { backgroundColor: border.rest.color }]} />
                <Text style={[styles.dividerText, { color: colors.textMuted, fontFamily: font.family.bodyRegular }]}>{t('auth.or')}</Text>
                <View style={[styles.dividerLine, { backgroundColor: border.rest.color }]} />
              </View>
              <AppleAuthentication.AppleAuthenticationButton
                buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                buttonStyle={scheme === 'dark' ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                cornerRadius={8}
                style={[styles.appleButton, appleLoading && styles.appleButtonLoading]}
                onPress={handleAppleSignIn}
              />
            </View>
          ) : null}

          <Link href="/(auth)/sign-up" style={styles.link}>
            <Text style={[styles.linkText, { color: colors.textSecondary, fontFamily: font.family.bodyRegular }]}>
              {t('auth.newHere')}{' '}
              <Text style={[styles.linkTextStrong, { color: colors.textPrimary, fontFamily: font.family.bodySemibold }]}>
                {t('auth.createAccount')}
              </Text>
            </Text>
          </Link>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  langCorner: {
    position: 'absolute',
    right: 24,
    zIndex: 1,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
    gap: 24,
  },
  logoWrap: {
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  title: {
    width: 220,
    height: 44,
    alignSelf: 'center',
  },
  tagline: {
    fontSize: 16,
    textAlign: 'center',
  },
  form: {
    gap: 16,
  },
  appleSection: {
    gap: 16,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontSize: 12,
  },
  appleButton: {
    width: '100%',
    height: 48,
  },
  appleButtonLoading: {
    opacity: 0.5,
  },
  link: {
    alignSelf: 'center',
    marginTop: 8,
  },
  linkText: {
    fontSize: 14,
  },
  linkTextStrong: {
    textDecorationLine: 'underline',
  },
});
