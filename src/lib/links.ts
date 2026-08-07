import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Same origin-resolution logic as emailRedirectTo() in features/auth/api.ts,
// plus a hardcoded prod fallback for native contexts where there's no
// window - this app's only real deployment is the GitHub Pages web build.
const PROD_ORIGIN = 'https://scnpg.github.io/moves';

function appOrigin(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const isLocalDev = ['localhost', '127.0.0.1'].includes(window.location.hostname);
    if (isLocalDev) return window.location.origin;
    const baseUrl = Constants.expoConfig?.experiments?.baseUrl ?? '';
    return `${window.location.origin}${baseUrl}`;
  }
  return PROD_ORIGIN;
}

export function joinMoveUrl(shareToken: string): string {
  return `${appOrigin()}/join/${shareToken}`;
}

export function referralSignUpUrl(referrerId: string): string {
  return `${appOrigin()}/sign-up?ref=${referrerId}`;
}

export function profileShareUrl(userId: string): string {
  return `${appOrigin()}/users/${userId}`;
}

/** AsyncStorage key for a share token captured while signed out, processed right after sign-in. */
export const PENDING_JOIN_TOKEN_KEY = 'moves:pending_join_token';
