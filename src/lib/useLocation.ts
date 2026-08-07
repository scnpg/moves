import { useEffect, useState } from 'react';
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

/** Ambient location for feed sorting / map centering - best-effort, fetched once on mount. */
export function useUserLocation() {
  const [coords, setCoords] = useState<Coords | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchHighAccuracyPosition()
      .then((c) => {
        if (!cancelled) setCoords(c);
      })
      .catch(() => {
        if (!cancelled) setPermissionDenied(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { coords, permissionDenied };
}

/**
 * On-demand fresh fetch for "use my location" buttons - always requests a
 * new high-accuracy reading at call time rather than reusing whatever the
 * ambient hook above happened to capture when the screen first mounted.
 */
export function getCurrentLocation(): Promise<Coords> {
  return fetchHighAccuracyPosition();
}
