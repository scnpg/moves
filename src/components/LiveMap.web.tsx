import { useEffect, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CircleMarker, MapContainer, TileLayer, Tooltip, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

import { HoverPressable } from '@/components/HoverPressable';
import type { EligibleMove } from '@/lib/database.types';
import { borderWidth, color, degreeColor, font, radius, spacing } from '@/theme/tokens';

interface LiveMapProps {
  moves: EligibleMove[];
  center: { lat: number; lng: number } | null;
  onSelectMove: (moveId: string) => void;
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

/** Floating button that jumps the view back to the viewer's own location - for after panning/zooming away while browsing pins. */
function RecenterButton({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  return (
    <HoverPressable
      onPress={() => {
        map.invalidateSize();
        map.setView([lat, lng], map.getZoom());
      }}
      style={styles.recenterButton}
      lightenOpacity={0.25}
    >
      <Text style={styles.recenterIcon}>◎</Text>
    </HoverPressable>
  );
}

/**
 * Real interactive map (Leaflet, no API key needed). Tiles are CartoDB's
 * "Positron" basemap - muted grayscale rather than default OSM's saturated
 * colors - so the flat-colored pins read clearly instead of competing with
 * a busy map underneath. Pins use each move's exact lat/lng when the RPC
 * decided it's safe to send (host or approved member - get_eligible_moves_
 * for_user() already gates that), falling back to fuzzy_lat/fuzzy_lng - a
 * ~1.1km-precision point - for everyone else. The client never re-fuzzes
 * data the server already cleared for exact display.
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
      ? [pins[0].lat ?? pins[0].fuzzy_lat, pins[0].lng ?? pins[0].fuzzy_lng]
      : DEFAULT_CENTER;

  return (
    <View style={styles.panel}>
      <MapContainer
        center={mapCenter}
        zoom={17}
        style={{ height: '100%', width: '100%', touchAction: 'none' } as object}
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        />
        <Recenter lat={mapCenter[0]} lng={mapCenter[1]} />
        {center ? (
          <>
            <CircleMarker
              center={[center.lat, center.lng]}
              radius={6}
              pathOptions={{ color: '#111111', weight: 1.5, fillColor: '#FFFFFF', fillOpacity: 0.9 }}
            />
            <RecenterButton lat={center.lat} lng={center.lng} />
          </>
        ) : null}
        {pins.map((move) => (
          <CircleMarker
            key={move.id}
            center={[move.lat ?? move.fuzzy_lat, move.lng ?? move.fuzzy_lng]}
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
  recenterButton: {
    position: 'absolute',
    right: spacing.sm,
    bottom: spacing.sm,
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    borderWidth: borderWidth.base,
    borderColor: color.border,
    backgroundColor: color.bg,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  } as object,
  recenterIcon: {
    fontSize: 18,
    fontWeight: font.weight.bold,
    color: color.accentBlue,
    lineHeight: 20,
  },
});
