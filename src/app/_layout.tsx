import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/AppHeader';
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
      <AlertProvider>
        <AuthProvider>
          <RootNavigation />
        </AuthProvider>
      </AlertProvider>
    </SafeAreaProvider>
  );
}

function RootNavigation() {
  const { session, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const inAuthGroup = segments[0] === '(auth)';

    if (!session && !inAuthGroup) {
      router.replace('/(auth)/sign-in');
    } else if (session && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [session, loading, segments, router]);

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
        <Stack.Screen name="moves/create" options={{ presentation: 'modal' }} />
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
