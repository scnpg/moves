import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, type ForwardedRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { Circle, CircleMarker, MapContainer, TileLayer, Tooltip, useMap } from 'react-leaflet';
import type { Map as LeafletMap } from 'leaflet';
import 'leaflet/dist/leaflet.css';

import type { EligibleMove } from '@/lib/database.types';
import { useTheme } from '@/theme/ThemeProvider';
import type { LiveMapHandle } from '@/components/LiveMap.types';

const MILES_TO_METERS = 1609.34;

// Web Mercator meters-per-pixel at zoom 0 (equator); halves each zoom level.
const EARTH_CIRCUMFERENCE_M = 156543.03392;
// Assumed map viewport width in px - can't reliably measure the real
// container this early (see the comment in RadiusCircle below), so this
// picks a reasonable "mostly mobile" default. Framing is approximate, not
// pixel-tight, but always in the right ballpark regardless of actual
// viewport size.
const ASSUMED_MAP_WIDTH_PX = 400;
// Fraction of the viewport width the circle's full diameter should occupy.
const TARGET_FILL = 0.8;

function zoomForRadius(lat: number, radiusMeters: number): number {
  const metersPerPixelAtZoom0 = EARTH_CIRCUMFERENCE_M * Math.cos((lat * Math.PI) / 180);
  const targetWidthMeters = (2 * radiusMeters) / TARGET_FILL;
  const zoom = Math.log2((ASSUMED_MAP_WIDTH_PX * metersPerPixelAtZoom0) / targetWidthMeters);
  return Math.min(17, Math.max(3, zoom));
}

interface LiveMapProps {
  moves: EligibleMove[];
  center: { lat: number; lng: number } | null;
  onSelectMove: (moveId: string) => void;
  /** Right-click on a pin - purely additive alongside the left-click-to-view behavior, so a Move can be reported without leaving the map or joining it. */
  onReportMove?: (move: EligibleMove) => void;
  /** Public-tab search radius, in miles - draws a coverage bubble and updates live while the slider drags (pure client-side geometry, no tile cost). */
  radiusMiles?: number | null;
  /** Only changes once a slider drag settles - the map only re-fits/re-zooms here, not on every drag frame, to avoid re-fetching a new set of tiles on every pixel of movement. */
  fitRadiusMiles?: number | null;
}

// Only used if we have neither the viewer's location nor any pin to center
// on - an empty map has to point somewhere. Violette's Lock, Potomac, MD.
const DEFAULT_CENTER: [number, number] = [39.0672, -77.3285];

function Recenter({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    // The map lives inside a fixed-height card that react-native-web lays
    // out after Leaflet's own initial size measurement, so Leaflet's
    // cached container size can be stale by the time this runs -
    // setView() then computes the wrong pixel origin and silently doesn't
    // move anything. invalidateSize() forces a fresh measurement first.
    map.invalidateSize();
    map.setView([lat, lng], map.getZoom(), { animate: false });
  }, [lat, lng, map]);
  return null;
}

/**
 * Coverage bubble for the Public tab's distance slider. The circle itself
 * redraws every frame while dragging (radiusMeters, pure SVG geometry - no
 * network cost), but the map only re-fits/re-zooms to frame it once the
 * drag settles (fitRadiusMeters) - zooming on every pixel of drag would
 * mean loading a fresh set of map tiles on every frame.
 */
function RadiusCircle({
  lat,
  lng,
  radiusMeters,
  fitRadiusMeters,
}: {
  lat: number;
  lng: number;
  radiusMeters: number;
  fitRadiusMeters: number;
}) {
  const map = useMap();
  const { colors } = useTheme();

  useEffect(() => {
    // Deliberately NOT map.fitBounds() - that computes its target zoom from
    // the container's *measured* pixel size, and on RN Web that
    // measurement is unreliable this early (same class of bug as the
    // mapHeight comment in (tabs)/index.tsx: a stale/zero size makes
    // fitBounds wildly over-zoom-out, e.g. a 11mi radius rendering as half
    // the northeast US). zoomForRadius() computes a target zoom from the
    // radius alone, so it can't be thrown off by a bad measurement.
    map.setView([lat, lng], zoomForRadius(lat, fitRadiusMeters), { animate: false });
  }, [lat, lng, fitRadiusMeters, map]);

  return (
    <Circle
      center={[lat, lng]}
      radius={radiusMeters}
      interactive={false}
      pathOptions={{ color: colors.brand, weight: 1.5, fillColor: colors.brand, fillOpacity: 0.06 }}
    />
  );
}

/**
 * Hands the underlying Leaflet Map instance up to the parent via a plain
 * ref - react-leaflet v5 no longer forwards MapContainer's own ref to the
 * Leaflet instance, so a child that calls useMap() (only valid inside
 * MapContainer's subtree) is the supported way to reach it from outside.
 */
function MapRefBridge({ mapRef }: { mapRef: React.MutableRefObject<LeafletMap | null> }) {
  const map = useMap();
  useEffect(() => {
    mapRef.current = map;
  }, [map, mapRef]);
  return null;
}

/**
 * Real interactive map (Leaflet, no API key needed). Tiles switch between
 * CartoDB's "Positron" (light) and "Dark Matter" (dark) grayscale basemaps
 * to match the app's theme - flat-colored pins read clearly against either
 * without competing with a busy map underneath. Pins use each move's exact
 * lat/lng when the RPC decided it's safe to send (host or approved member -
 * get_eligible_moves_for_user() already gates that), falling back to
 * fuzzy_lat/fuzzy_lng - a ~1.1km-precision point - for everyone else. The
 * client never re-fuzzes data the server already cleared for exact display.
 */
function LiveMapImpl(
  { moves, center, onSelectMove, onReportMove, radiusMiles, fitRadiusMiles }: LiveMapProps,
  ref: ForwardedRef<LiveMapHandle>
) {
  const { colors, border, signal, scheme } = useTheme();
  const mapRef = useRef<LeafletMap | null>(null);

  useImperativeHandle(
    ref,
    () => ({
      recenter: () => {
        if (!center || !mapRef.current) return;
        mapRef.current.invalidateSize();
        mapRef.current.setView([center.lat, center.lng], mapRef.current.getZoom());
      },
    }),
    [center]
  );

  const pins = useMemo(
    () => moves.filter((m): m is EligibleMove & { fuzzy_lat: number; fuzzy_lng: number } =>
      m.fuzzy_lat != null && m.fuzzy_lng != null
    ),
    [moves]
  );

  const mapCenter: [number, number] = center
    ? [center.lat, center.lng]
    : pins[0]
      ? [pins[0].lat ?? pins[0].fuzzy_lat, pins[0].lng ?? pins[0].fuzzy_lng]
      : DEFAULT_CENTER;

  const tileUrl =
    scheme === 'dark'
      ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
      : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';

  return (
    <View style={[styles.panel, { borderWidth: border.rest.width, borderColor: colors.border }]}>
      <MapContainer
        key={scheme}
        center={mapCenter}
        zoom={17}
        style={{ height: '100%', width: '100%', touchAction: 'none' } as object}
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url={tileUrl}
        />
        <Recenter lat={mapCenter[0]} lng={mapCenter[1]} />
        <MapRefBridge mapRef={mapRef} />
        {center && radiusMiles != null && fitRadiusMiles != null ? (
          <RadiusCircle
            lat={center.lat}
            lng={center.lng}
            radiusMeters={radiusMiles * MILES_TO_METERS}
            fitRadiusMeters={fitRadiusMiles * MILES_TO_METERS}
          />
        ) : null}
        {center ? (
          <CircleMarker
            center={[center.lat, center.lng]}
            radius={6}
            pathOptions={{ color: colors.border, weight: 1.5, fillColor: colors.bgCard, fillOpacity: 0.9 }}
          />
        ) : null}
        {pins.map((move) => (
          <CircleMarker
            key={move.id}
            center={[move.lat ?? move.fuzzy_lat, move.lng ?? move.fuzzy_lng]}
            radius={8}
            pathOptions={{
              color: colors.border,
              weight: 1.5,
              fillColor: signal.degree[move.degree_limit],
              fillOpacity: 0.85,
            }}
            eventHandlers={{
              click: () => onSelectMove(move.id),
              contextmenu: (e) => {
                e.originalEvent.preventDefault();
                onReportMove?.(move);
              },
            }}
          >
            <Tooltip direction="top" offset={[0, -8]}>
              {move.title}
            </Tooltip>
          </CircleMarker>
        ))}
      </MapContainer>
    </View>
  );
}

export const LiveMap = forwardRef(LiveMapImpl);

const styles = StyleSheet.create({
  panel: {
    flex: 1,
  },
});
