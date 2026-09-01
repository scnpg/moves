import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState, type ForwardedRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MapView, { Circle, Marker, PROVIDER_DEFAULT, type Region } from 'react-native-maps';

import { HoverPressable } from '@/components/HoverPressable';
import type { LiveMapHandle } from '@/components/LiveMap.types';
import type { EligibleMove } from '@/lib/database.types';
import { useTheme } from '@/theme/ThemeProvider';

const MILES_TO_METERS = 1609.34;
// A native Circle overlay isn't a cheap resizable shape like the web SVG
// version - every radius change tears down and rebuilds a real MKCircle
// (MKCircle.radius is read-only after creation, so react-native-maps has no
// choice but to create a new one and swap it into the map's overlays on every
// change - confirmed in AIRMapCircle.m's setRadius:/update methods), and the
// slider reports far more updates per second than that can keep up with,
// which is what reads as jitter. Capping how often the overlay actually
// rebuilds (while always landing on the latest value) trades a little
// latency for consistently smooth-ish motion.
//
// A custom animated-view replacement (smoothly resizing a plain View via
// Reanimated instead of touching MKCircle at all) was tried and would have
// been genuinely fluid, but hit an unresolved react-native-maps bug: Marker
// content sized only via Reanimated (bypassing React's own layout pass)
// never gets picked up by AIRMapMarker's reactSetFrame:, so the marker's
// native bounds stay clipped near zero regardless of the view's actual
// rendered size - confirmed down to a plain static-size View not rendering
// either. Fixing that properly needs a custom native Swift overlay renderer
// (MKCircle's own radius immutability means even hand-written Swift can't
// animate a single MKCircle - it needs a custom-drawn shape instead), which
// is real scope beyond a throttle tweak. Revisit as a dedicated Expo Local
// Module if this still feels worth it later.
const RADIUS_UPDATE_INTERVAL_MS = 50;

/** Caps how often `value` propagates through, but always eventually lands on the latest value (trailing update), so a settled drag never gets stuck showing a stale radius. */
function useThrottledValue<T>(value: T, intervalMs: number): T {
  const [throttled, setThrottled] = useState(value);
  const lastUpdateRef = useRef(0);

  useEffect(() => {
    const elapsed = Date.now() - lastUpdateRef.current;
    if (elapsed >= intervalMs) {
      lastUpdateRef.current = Date.now();
      setThrottled(value);
      return;
    }
    const timeout = setTimeout(() => {
      lastUpdateRef.current = Date.now();
      setThrottled(value);
    }, intervalMs - elapsed);
    return () => clearTimeout(timeout);
  }, [value, intervalMs]);

  return throttled;
}

// Only used if we have neither the viewer's location nor any pin to center
// on - an empty map has to point somewhere. Violette's Lock, Potomac, MD.
const DEFAULT_CENTER = { latitude: 39.0672, longitude: -77.3285 };
// Roughly a ~1mi-wide viewport at the default zoom - arbitrary but tight
// enough to not look like a directionless world map on first paint.
const DEFAULT_DELTA = 0.02;
// Each zoom step halves/doubles the current span - clamped so the +/-
// buttons can't zoom in past a house-sized view or out past a whole-Earth
// one, where MapKit's own region math gets unreliable.
const ZOOM_STEP_FACTOR = 2;
const MIN_DELTA = 0.0008;
const MAX_DELTA = 80;

interface LiveMapProps {
  moves: EligibleMove[];
  center: { lat: number; lng: number } | null;
  onSelectMove: (moveId: string) => void;
  /** Long-press on a pin - purely additive alongside the tap-to-view behavior, so a Move can be reported without leaving the map or joining it. */
  onReportMove?: (move: EligibleMove) => void;
  /** Public-tab search radius, in miles - draws a coverage bubble (see LiveMap.web.tsx for the web equivalent). */
  radiusMiles?: number | null;
  /** Only changes once a slider drag settles - the map only re-fits/re-zooms here, not on every drag frame. */
  fitRadiusMiles?: number | null;
  /** This component's own rendered height, in points - needed alongside obscuredBottom to know what fraction of the map is actually visible. */
  mapHeight?: number;
  /** Height, in points, of the BottomSheet currently covering the bottom of this map - recenter() needs this to center on the visible portion, not the full (partly hidden) view. */
  obscuredBottom?: number;
}

/**
 * Real interactive map on iOS via Apple's own MapKit (react-native-maps,
 * PROVIDER_DEFAULT) - no API key or billing account needed, unlike Google
 * Maps. Mirrors LiveMap.web.tsx's data handling: pins use each move's exact
 * lat/lng when the RPC decided it's safe to send, falling back to
 * fuzzy_lat/fuzzy_lng - a ~1.1km-precision point - for everyone else.
 */
function LiveMapImpl(
  { moves, center, onSelectMove, onReportMove, radiusMiles, mapHeight, obscuredBottom }: LiveMapProps,
  ref: ForwardedRef<LiveMapHandle>
) {
  const { colors, border, signal, scheme } = useTheme();
  const mapRef = useRef<MapView | null>(null);
  // Tracks the map's live region as the user pans/zooms (ref, not state - a
  // region change shouldn't trigger a re-render) so recenter() can keep the
  // user's current zoom level instead of snapping back to DEFAULT_DELTA.
  const currentRegionRef = useRef<Region | null>(null);
  const throttledRadiusMiles = useThrottledValue(radiusMiles, RADIUS_UPDATE_INTERVAL_MS);

  const pins = useMemo(
    () =>
      moves.filter(
        (m): m is EligibleMove & { fuzzy_lat: number; fuzzy_lng: number } =>
          m.fuzzy_lat != null && m.fuzzy_lng != null
      ),
    [moves]
  );

  const mapCenter = center
    ? { latitude: center.lat, longitude: center.lng }
    : pins[0]
      ? { latitude: pins[0].lat ?? pins[0].fuzzy_lat, longitude: pins[0].lng ?? pins[0].fuzzy_lng }
      : DEFAULT_CENTER;

  // A region's own latitude/longitude land at the vertical center of this
  // MapView's full height - but the BottomSheet visually covers its bottom
  // obscuredBottom points, so centering there puts the target in the middle
  // of a mostly-hidden area, well below the middle of what's actually
  // visible. Shifting the center south by half the obscured height
  // (converted from points to degrees at the given zoom) pushes it up to
  // the middle of the visible portion instead.
  function visibleCenterLatitude(latitude: number, latitudeDelta: number): number {
    if (!mapHeight || !obscuredBottom) return latitude;
    return latitude - (obscuredBottom / 2) * (latitudeDelta / mapHeight);
  }

  useImperativeHandle(
    ref,
    () => ({
      recenter: () => {
        if (!center || !mapRef.current) return;
        // Keep whatever zoom level the user is currently viewing at - only
        // the center coordinate should change, not how far zoomed in they are.
        const { latitudeDelta, longitudeDelta } = currentRegionRef.current ?? {
          latitudeDelta: DEFAULT_DELTA,
          longitudeDelta: DEFAULT_DELTA,
        };
        mapRef.current.animateToRegion(
          { latitude: visibleCenterLatitude(center.lat, latitudeDelta), longitude: center.lng, latitudeDelta, longitudeDelta },
          300
        );
      },
    }),
    [center, mapHeight, obscuredBottom]
  );

  function zoomBy(factor: number) {
    if (!mapRef.current) return;
    const current = currentRegionRef.current ?? { ...mapCenter, latitudeDelta: DEFAULT_DELTA, longitudeDelta: DEFAULT_DELTA };
    const latitudeDelta = Math.min(MAX_DELTA, Math.max(MIN_DELTA, current.latitudeDelta * factor));
    const longitudeDelta = Math.min(MAX_DELTA, Math.max(MIN_DELTA, current.longitudeDelta * factor));
    mapRef.current.animateToRegion(
      { latitude: current.latitude, longitude: current.longitude, latitudeDelta, longitudeDelta },
      200
    );
  }

  return (
    <View style={styles.panel}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_DEFAULT}
        userInterfaceStyle={scheme}
        style={styles.map}
        initialRegion={{
          ...mapCenter,
          latitude: visibleCenterLatitude(mapCenter.latitude, DEFAULT_DELTA),
          latitudeDelta: DEFAULT_DELTA,
          longitudeDelta: DEFAULT_DELTA,
        }}
        onRegionChangeComplete={(region) => {
          currentRegionRef.current = region;
        }}
        onLongPress={(e) => {
          // Marker itself has no onLongPress in this react-native-maps
          // version (only onPress/onCalloutPress) - long-pressing the map
          // and finding whichever pin is closest instead, within a radius
          // that scales with the current zoom (a fixed degree threshold
          // would be too strict zoomed out, too loose zoomed in).
          if (!onReportMove || pins.length === 0) return;
          const { latitude, longitude } = e.nativeEvent.coordinate;
          const threshold = (currentRegionRef.current?.latitudeDelta ?? DEFAULT_DELTA) * 0.05;
          let closest: (typeof pins)[number] | null = null;
          let closestDist = Infinity;
          for (const move of pins) {
            const lat = move.lat ?? move.fuzzy_lat;
            const lng = move.lng ?? move.fuzzy_lng;
            const dist = Math.hypot(lat - latitude, lng - longitude);
            if (dist < closestDist) {
              closestDist = dist;
              closest = move;
            }
          }
          if (closest && closestDist <= threshold) {
            onReportMove(closest);
          }
        }}
      >
        {center && throttledRadiusMiles != null ? (
          <Circle
            // Bound to the throttled radius (see useThrottledValue above),
            // not the live-dragging raw value - a native map overlay
            // re-creates real platform views on every radius change, unlike
            // the web version's cheap SVG redraw, and updating it on every
            // drag frame made the app stutter.
            center={{ latitude: center.lat, longitude: center.lng }}
            radius={throttledRadiusMiles * MILES_TO_METERS}
            strokeWidth={1.5}
            strokeColor={colors.brand}
            fillColor={`${colors.brand}18`}
          />
        ) : null}
        {center ? (
          <Marker coordinate={{ latitude: center.lat, longitude: center.lng }} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={[styles.selfDot, { borderColor: colors.border, backgroundColor: colors.bgCard }]} />
          </Marker>
        ) : null}
        {pins.map((move) => (
          <Marker
            key={move.id}
            coordinate={{ latitude: move.lat ?? move.fuzzy_lat, longitude: move.lng ?? move.fuzzy_lng }}
            title={move.title}
            anchor={{ x: 0.5, y: 0.5 }}
            onPress={() => onSelectMove(move.id)}
          >
            <View
              style={[
                styles.pinDot,
                { borderColor: colors.border, backgroundColor: signal.degree[move.degree_limit] },
              ]}
            />
          </Marker>
        ))}
      </MapView>

      <View style={styles.zoomControls}>
        <HoverPressable
          onPress={() => zoomBy(1 / ZOOM_STEP_FACTOR)}
          accessibilityRole="button"
          accessibilityLabel="Zoom in"
          style={[
            styles.zoomButton,
            styles.zoomButtonTop,
            { backgroundColor: colors.bgCard, borderColor: colors.border, borderWidth: border.rest.width },
          ]}
          lightenOpacity={0.25}
        >
          <Text style={[styles.zoomIcon, { color: colors.textPrimary }]}>+</Text>
        </HoverPressable>
        <HoverPressable
          onPress={() => zoomBy(ZOOM_STEP_FACTOR)}
          accessibilityRole="button"
          accessibilityLabel="Zoom out"
          style={[
            styles.zoomButton,
            { backgroundColor: colors.bgCard, borderColor: colors.border, borderWidth: border.rest.width },
          ]}
          lightenOpacity={0.25}
        >
          <Text style={[styles.zoomIcon, { color: colors.textPrimary }]}>−</Text>
        </HoverPressable>
      </View>
    </View>
  );
}

export const LiveMap = forwardRef(LiveMapImpl);

const styles = StyleSheet.create({
  panel: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  selfDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1.5,
  },
  pinDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
  },
  zoomControls: {
    position: 'absolute',
    top: 12,
    left: 12,
  },
  zoomButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomButtonTop: {
    marginBottom: 8,
  },
  zoomIcon: {
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 24,
  },
});
