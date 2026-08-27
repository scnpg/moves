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

/** Host-issued bypass link (see InviteLinkPanel) - distinct from joinMoveUrl(), which is share_token, a fixed property of Private-tier Moves only. */
export function inviteLinkUrl(token: string): string {
  return `${appOrigin()}/invite/${token}`;
}

export function referralSignUpUrl(referrerId: string): string {
  return `${appOrigin()}/sign-up?ref=${referrerId}`;
}

/**
 * Unlike the other links here, this one is meant to be opened by someone
 * who most likely already has the app (sharing your own profile), so it
 * points straight at the native app via its URL scheme on native rather
 * than the GitHub Pages web build - referralSignUpUrl()/joinMoveUrl()
 * intentionally stay web links since those need to work for people who
 * don't have the app yet.
 */
export function profileShareUrl(userId: string): string {
  if (Platform.OS !== 'web') {
    return `moves://users/${userId}`;
  }
  return `${appOrigin()}/users/${userId}`;
}

/** AsyncStorage key for a share token captured while signed out, processed right after sign-in. */
export const PENDING_JOIN_TOKEN_KEY = 'moves:pending_join_token';

/** Same idea as PENDING_JOIN_TOKEN_KEY, for a bypass invite link's token instead. */
export const PENDING_INVITE_TOKEN_KEY = 'moves:pending_invite_token';
