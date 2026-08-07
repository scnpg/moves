import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { AppHeader } from '@/components/AppHeader';
import { LocaleProvider } from '@/i18n/LocaleProvider';
import { PENDING_JOIN_TOKEN_KEY } from '@/lib/links';
import { isPlaceholderUsername } from '@/lib/username';
import { AlertProvider } from '@/providers/AlertProvider';
import { AuthProvider, useAuth } from '@/providers/AuthProvider';
import { color } from '@/theme/tokens';

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Danfo: require('../../assets/fonts/Danfo-Regular.ttf'),
  });

  if (!fontsLoaded && !fontError) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={color.brand} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <LocaleProvider>
        <AlertProvider>
          <AuthProvider>
            <RootNavigation />
          </AuthProvider>
        </AlertProvider>
      </LocaleProvider>
    </SafeAreaProvider>
  );
}

function RootNavigation() {
  const { session, profile, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const inAuthGroup = segments[0] === '(auth)';
    // /join/:token has its own signed-out preview (get_move_by_share_token
    // is anon-callable) - don't bounce visitors to sign-in before they see it.
    const onJoinRoute = segments[0] === 'join';
    // /users/:id has its own signed-out preview too (get_public_profile is
    // anon-callable) - for shared profile links/QR codes.
    const onUsersRoute = segments[0] === 'users';
    const onCompleteProfile = segments[0] === 'complete-profile';
    // A phone-first signup (see PhoneAuth) lands with a placeholder
    // username from handle_new_user()'s fallback - profile loads a beat
    // after session does, so this re-fires and self-corrects once it does,
    // wherever they ended up in the meantime.
    const needsUsername = !!session && isPlaceholderUsername(profile?.username);

    if (!session && !inAuthGroup && !onJoinRoute && !onUsersRoute) {
      router.replace('/(auth)/sign-in');
    } else if (session && needsUsername && !onCompleteProfile) {
      router.replace('/complete-profile');
    } else if (session && inAuthGroup) {
      // A token stashed by join/[share_token].tsx (visitor tapped "Sign in
      // to join" while signed out) takes priority over the default landing.
      AsyncStorage.getItem(PENDING_JOIN_TOKEN_KEY).then((token) => {
        router.replace(token ? `/join/${token}` : '/(tabs)');
      });
    }
  }, [session, profile?.username, loading, segments, router]);

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={color.brand} size="large" />
      </View>
    );
  }

  // The sign-in screen carries its own full-size hero logo, so the slim
  // global bar (which would just navigate back to this same screen) is
  // redundant there.
  const onSignIn = segments.join('/') === '(auth)/sign-in';

  return (
    <View style={styles.flex}>
      <StatusBar style="dark" />
      {!onSignIn ? <AppHeader /> : null}
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.bg } }}>
        <Stack.Screen name="room/create" options={{ presentation: 'modal' }} />
      </Stack>
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
    backgroundColor: color.bg,
  },
});
