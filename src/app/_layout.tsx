import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SpaceGrotesk_500Medium, SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk';
import { Inter_400Regular, Inter_600SemiBold } from '@expo-google-fonts/inter';

import { AppHeader } from '@/components/AppHeader';
import { LocationRequiredScreen } from '@/components/LocationRequiredScreen';
import { OnboardingCarousel } from '@/components/OnboardingCarousel';
import { completeOnboarding } from '@/features/profile/api';
import { LocaleProvider } from '@/i18n/LocaleProvider';
import { PENDING_INVITE_TOKEN_KEY, PENDING_JOIN_TOKEN_KEY } from '@/lib/links';
import { useUserLocation } from '@/lib/useLocation';
import { isPlaceholderUsername } from '@/lib/username';
import { AlertProvider } from '@/providers/AlertProvider';
import { AuthProvider, useAuth } from '@/providers/AuthProvider';
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Danfo: require('../../assets/fonts/Danfo-Regular.ttf'),
    SpaceGrotesk_500Medium,
    SpaceGrotesk_700Bold,
    Inter_400Regular,
    Inter_600SemiBold,
  });

  if (!fontsLoaded && !fontError) {
    // ThemeProvider isn't mounted yet at this point, so useTheme() isn't
    // available - hardcode the light-mode brand green rather than block
    // font loading on the theme system.
    return (
      <View style={styles.loading}>
        <ActivityIndicator color="#35DE83" size="large" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.flex}>
      <SafeAreaProvider>
        <ThemeProvider>
          <LocaleProvider>
            <AlertProvider>
              <AuthProvider>
                <RootNavigation />
              </AuthProvider>
            </AlertProvider>
          </LocaleProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function RootNavigation() {
  const { session, profile, loading, refreshProfile } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const { colors, scheme } = useTheme();
  const { coords, permissionDenied, loading: locationLoading, retry: retryLocation } = useUserLocation();

  const inAuthGroup = segments[0] === '(auth)';
  // /join/:token has its own signed-out preview (get_move_by_share_token
  // is anon-callable) - don't bounce visitors to sign-in before they see it.
  const onJoinRoute = segments[0] === 'join';
  // /invite/:token is the same idea, for a host-issued bypass link instead
  // of a Move's own share_token (get_move_by_invite_link is anon-callable).
  const onInviteRoute = segments[0] === 'invite';
  // /users/:id has its own signed-out preview too (get_public_profile is
  // anon-callable) - for shared profile links/QR codes.
  const onUsersRoute = segments[0] === 'users';
  const onCompleteProfile = segments[0] === 'complete-profile';
  // /reset-password establishes its own short-lived recovery session from
  // the emailed link (see that screen) - it has to survive both the
  // signed-out redirect below (there's no session yet on first load, right
  // up until the screen parses the link) and, once that recovery session
  // lands, every other signed-in gate that would otherwise whisk them off
  // to onboarding/location/tabs before they've actually set a new password.
  const onResetPasswordRoute = segments[0] === 'reset-password';
  // Privacy Policy / Terms of Service need to work signed-out too - they're
  // the URLs App Store Connect / Play Console link to, and a visitor
  // reading them before signing up shouldn't get bounced to sign-in first.
  const onLegalRoute = segments[0] === 'privacy' || segments[0] === 'terms';
  // A referral/edge-case signup can land with a placeholder username from
  // handle_new_user()'s fallback - profile loads a beat after session
  // does, so this re-fires and self-corrects once it does, wherever they
  // ended up in the meantime. A moderator confirming a reported username as
  // the actual violation (see resolve_moderation_case() in the moderation
  // migration) reuses the exact same "pick a username" screen/flow to make
  // the change - profiles.username_reset_required clears itself the moment
  // the username actually changes (see clear_username_reset_flag()).
  const needsUsername = !!session && (isPlaceholderUsername(profile?.username) || !!profile?.username_reset_required);

  useEffect(() => {
    if (loading) return;
    if (!session && !inAuthGroup && !onJoinRoute && !onInviteRoute && !onUsersRoute && !onLegalRoute && !onResetPasswordRoute) {
      router.replace('/(auth)/sign-in');
    } else if (session && needsUsername && !onCompleteProfile && !onResetPasswordRoute) {
      router.replace('/complete-profile');
    } else if (session && inAuthGroup) {
      // A token stashed by join/[share_token].tsx or invite/[token].tsx
      // (visitor tapped "Sign in to join" while signed out) takes priority
      // over the default landing.
      Promise.all([AsyncStorage.getItem(PENDING_JOIN_TOKEN_KEY), AsyncStorage.getItem(PENDING_INVITE_TOKEN_KEY)]).then(
        ([joinToken, inviteToken]) => {
          router.replace(joinToken ? `/join/${joinToken}` : inviteToken ? `/invite/${inviteToken}` : '/(tabs)');
        }
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, needsUsername, onCompleteProfile, inAuthGroup, onJoinRoute, onInviteRoute, onUsersRoute, onLegalRoute, onResetPasswordRoute, loading, router]);

  if (loading) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.bg }]}>
        <ActivityIndicator color={colors.brand} size="large" />
      </View>
    );
  }

  // The sign-in screen carries its own full-size hero logo, so the slim
  // global bar (which would just navigate back to this same screen) is
  // redundant there.
  const onSignIn = segments.join('/') === '(auth)/sign-in';

  // Same route exclusions as the location gate below, and gated ahead of
  // it deliberately - finishing onboarding (Skip or the last slide's Get
  // Started) drops straight into that gate, so location permission is the
  // very next thing asked for. profile can be briefly null right after
  // sign-up (loadProfile() hasn't resolved yet) - same "self-corrects a
  // beat later" tolerance as needsUsername above, not worth a separate
  // loading state for one frame.
  const needsOnboarding =
    !!session &&
    !inAuthGroup &&
    !onJoinRoute &&
    !onInviteRoute &&
    !onUsersRoute &&
    !onLegalRoute &&
    !onResetPasswordRoute &&
    !needsUsername &&
    !!profile &&
    !profile.onboarding_completed;

  const handleFinishOnboarding = async () => {
    if (!session?.user) return;
    try {
      await completeOnboarding(session.user.id);
    } catch {
      // Non-fatal - worst case the user sees onboarding again next launch.
    }
    await refreshProfile();
  };

  // Moves is location-first (nearby feed, map centering, Move creation all
  // need it) - once past sign-in/legal/preview routes, block the rest of
  // the app behind a resolved location rather than let every screen handle
  // a null-coords fallback individually.
  const needsLocationGate =
    !!session &&
    !inAuthGroup &&
    !onJoinRoute &&
    !onInviteRoute &&
    !onUsersRoute &&
    !onLegalRoute &&
    !onResetPasswordRoute &&
    !needsUsername &&
    !needsOnboarding;

  return (
    <View style={styles.flex}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      {!onSignIn ? <AppHeader /> : null}
      {needsOnboarding ? (
        <OnboardingCarousel onComplete={handleFinishOnboarding} coords={coords} locationLoading={locationLoading} />
      ) : needsLocationGate && !coords ? (
        <LocationRequiredScreen loading={locationLoading} denied={permissionDenied} onRetry={retryLocation} />
      ) : (
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
          <Stack.Screen name="room/create" options={{ presentation: 'modal' }} />
        </Stack>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
