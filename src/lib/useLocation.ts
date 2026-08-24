import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import * as Location from 'expo-location';

interface Coords {
  lat: number;
  lng: number;
}

async function fetchHighAccuracyPosition(): Promise<Coords> {
  // Native (iOS/Android) genuinely needs the explicit request - the OS
  // permission dialog only appears in response to it, unlike a browser.
  // Web deliberately skips it: expo-location's web shim
  // (node_modules/expo-location/build/ExpoLocation.web.js) pre-checks
  // navigator.permissions.query({name: 'geolocation'}), which Safari
  // (desktop and iOS) doesn't reliably support - the call either throws or
  // the property doesn't exist, and the shim only has a fallback for the
  // latter case, so on Safari the whole permission check throws before the
  // user is ever actually prompted, surfacing as "denied" even on a
  // first-ever visit. getCurrentPositionAsync() below doesn't go through
  // that path at all on web - it calls
  // navigator.geolocation.getCurrentPosition() directly, which every
  // browser (Safari included) already knows how to prompt for on its own.
  if (Platform.OS !== 'web') {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      throw new Error('Location permission denied.');
    }
  }
  // expo-location's web shim only sets the browser's enableHighAccuracy flag
  // when accuracy > Balanced - omitting this option (as the old code did)
  // silently falls back to low-accuracy, cell/wifi-based positioning.
  const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
  return { lat: position.coords.latitude, lng: position.coords.longitude };
}

const LOCATION_TIMEOUT_MS = 15000;

/**
 * Ambient location for feed sorting / map centering, and (via `retry`) the
 * app-wide "location required" gate in src/app/_layout.tsx - the whole app
 * is location-driven, so this is the single source of truth both use.
 */
export function useUserLocation() {
  const [coords, setCoords] = useState<Coords | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [loading, setLoading] = useState(true);

  const attempt = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setPermissionDenied(false);

    // getCurrentPositionAsync() has no built-in timeout and can hang
    // indefinitely (weak GPS signal, indoors, simulator with no location
    // set - all common right after a fresh signup) - stop blocking the UI
    // on it after LOCATION_TIMEOUT_MS so the "enable location" retry screen
    // appears instead of spinning forever. The request keeps running in the
    // background and still resolves into coords/permissionDenied below if
    // it finishes late.
    const timeoutId = setTimeout(() => {
      if (!cancelled) setLoading(false);
    }, LOCATION_TIMEOUT_MS);

    fetchHighAccuracyPosition()
      .then((c) => {
        if (cancelled) return;
        clearTimeout(timeoutId);
        setCoords(c);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        clearTimeout(timeoutId);
        setPermissionDenied(true);
        setLoading(false);
      });

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, []);

  useEffect(() => attempt(), [attempt]);

  return { coords, permissionDenied, loading, retry: attempt };
}

/**
 * On-demand fresh fetch for "use my location" buttons - always requests a
 * new high-accuracy reading at call time rather than reusing whatever the
 * ambient hook above happened to capture when the screen first mounted.
 */
export function getCurrentLocation(): Promise<Coords> {
  return fetchHighAccuracyPosition();
}
