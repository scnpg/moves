import { useCallback, useEffect, useState } from 'react';
import * as Location from 'expo-location';

interface Coords {
  lat: number;
  lng: number;
}

async function fetchHighAccuracyPosition(): Promise<Coords> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    throw new Error('Location permission denied.');
  }
  // expo-location's web shim only sets the browser's enableHighAccuracy flag
  // when accuracy > Balanced - omitting this option (as the old code did)
  // silently falls back to low-accuracy, cell/wifi-based positioning.
  const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
  return { lat: position.coords.latitude, lng: position.coords.longitude };
}

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
    fetchHighAccuracyPosition()
      .then((c) => {
        if (!cancelled) setCoords(c);
      })
      .catch(() => {
        if (!cancelled) setPermissionDenied(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
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
