import { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { CircleMarker, MapContainer, TileLayer, Tooltip, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

import type { EligibleMove } from '@/lib/database.types';
import { borderWidth, color, degreeColor, radius, spacing } from '@/theme/tokens';

interface LiveMapProps {
  moves: EligibleMove[];
  center: { lat: number; lng: number } | null;
  onSelectMove: (moveId: string) => void;
}

// Only used if we have neither the viewer's location nor any pin to center
// on - an empty map has to point somewhere.
const DEFAULT_CENTER: [number, number] = [40.7128, -74.006];

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
 * Real interactive map (Leaflet, no API key needed). Tiles are CartoDB's
 * "Positron" basemap - muted grayscale rather than default OSM's saturated
 * colors - so the flat-colored pins read clearly instead of competing with
 * a busy map underneath. Pins use each move's fuzzy_lat/fuzzy_lng - a
 * ~1.1km-precision point that's visible regardless of membership - never
 * the exact location, which stays gated behind approved membership
 * everywhere else in the app.
 */
export function LiveMap({ moves, center, onSelectMove }: LiveMapProps) {
  const pins = useMemo(
    () => moves.filter((m): m is EligibleMove & { fuzzy_lat: number; fuzzy_lng: number } =>
      m.fuzzy_lat != null && m.fuzzy_lng != null
    ),
    [moves]
  );

  const mapCenter: [number, number] = center
    ? [center.lat, center.lng]
    : pins[0]
      ? [pins[0].fuzzy_lat, pins[0].fuzzy_lng]
      : DEFAULT_CENTER;

  return (
    <View style={styles.panel}>
      <MapContainer
        center={mapCenter}
        zoom={13}
        style={{ height: '100%', width: '100%', touchAction: 'none' } as object}
        scrollWheelZoom={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        />
        <Recenter lat={mapCenter[0]} lng={mapCenter[1]} />
        {center ? (
          <CircleMarker
            center={[center.lat, center.lng]}
            radius={6}
            pathOptions={{ color: '#111111', weight: 1.5, fillColor: '#FFFFFF', fillOpacity: 0.9 }}
          />
        ) : null}
        {pins.map((move) => (
          <CircleMarker
            key={move.id}
            center={[move.fuzzy_lat, move.fuzzy_lng]}
            radius={8}
            pathOptions={{
              color: '#111111',
              weight: 1.5,
              fillColor: degreeColor[move.degree_limit],
              fillOpacity: 0.8,
            }}
            eventHandlers={{ click: () => onSelectMove(move.id) }}
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

const styles = StyleSheet.create({
  panel: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    height: 240,
    borderWidth: borderWidth.base,
    borderColor: color.border,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
});
