import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';

import { HoverPressable } from '@/components/HoverPressable';
import { TextField } from '@/components/TextField';
import { useLocale } from '@/i18n/LocaleProvider';
import { notify } from '@/lib/alerts';
import { getCurrentLocation } from '@/lib/useLocation';
import { useTheme } from '@/theme/ThemeProvider';

export interface LocationValue {
  lat: number;
  lng: number;
}

interface LocationPickerProps {
  value: LocationValue | null;
  onChange: (value: LocationValue | null) => void;
}

const ZOOM = 16;
const TILE_SIZE = 256;
const CANVAS_SIZE = TILE_SIZE * 3;
const MARKER_SIZE = 18;

/** Standard Web Mercator slippy-map projection - same math the {z}/{x}/{y} tile scheme is built on. */
function project(lat: number, lng: number, zoom: number) {
  const n = 2 ** zoom;
  const latRad = (lat * Math.PI) / 180;
  const xtile = ((lng + 180) / 360) * n;
  const ytile = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;
  return { xtile, ytile };
}

/**
 * No interactive native map library wired up (would need react-native-maps
 * - a new native module requiring a fresh EAS build, plus a Google Maps API
 * key on Android). This gets a real, correctly-centered map without either:
 * a 3x3 grid of the same CARTO tiles LocationPicker.web.tsx already uses,
 * manually positioned from the pin's Web Mercator projection, with the pin
 * itself drawn as an overlay at the exact computed pixel. Static, not
 * click-to-pin - search and "use my location" remain how the pin moves.
 */
function StaticPinMap({ lat, lng }: { lat: number; lng: number }) {
  const { colors, border, scheme } = useTheme();
  const { xtile, ytile } = project(lat, lng, ZOOM);
  const tileX = Math.floor(xtile);
  const tileY = Math.floor(ytile);
  const pixelX = (xtile - tileX) * TILE_SIZE;
  const pixelY = (ytile - tileY) * TILE_SIZE;
  // Top-left of the *center* tile, in canvas coordinates, such that the
  // pin's exact fractional position lands on the canvas's own center.
  const originX = CANVAS_SIZE / 2 - pixelX;
  const originY = CANVAS_SIZE / 2 - pixelY;
  const baseUrl = scheme === 'dark' ? 'https://a.basemaps.cartocdn.com/dark_all' : 'https://a.basemaps.cartocdn.com/light_all';

  const tiles: { dx: number; dy: number; x: number; y: number }[] = [];
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      tiles.push({ dx, dy, x: tileX + dx, y: tileY + dy });
    }
  }

  return (
    <View style={[styles.mapWrap, { borderWidth: border.rest.width, borderColor: border.rest.color }]}>
      <View style={[styles.canvas, { backgroundColor: colors.bgElevated }]}>
        {tiles.map(({ dx, dy, x, y }) => (
          <Image
            key={`${x},${y}`}
            source={{ uri: `${baseUrl}/${ZOOM}/${x}/${y}.png` }}
            style={{ position: 'absolute', left: originX + dx * TILE_SIZE, top: originY + dy * TILE_SIZE, width: TILE_SIZE, height: TILE_SIZE }}
          />
        ))}
        <View
          style={[
            styles.marker,
            {
              left: CANVAS_SIZE / 2 - MARKER_SIZE / 2,
              top: CANVAS_SIZE / 2 - MARKER_SIZE / 2,
              backgroundColor: colors.accentBlue,
              borderColor: colors.border,
              borderWidth: border.rest.width + 1,
            },
          ]}
        />
      </View>
    </View>
  );
}

export function LocationPicker({ value, onChange }: LocationPickerProps) {
  const { t } = useLocale();
  const { colors, border, font } = useTheme();
  const [address, setAddress] = useState('');
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);

  // Debounced forward-geocoding: search fires 300ms after typing stops.
  useEffect(() => {
    const trimmed = address.trim();
    if (!trimmed) return;

    const timeout = setTimeout(async () => {
      setSearching(true);
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(trimmed)}`
        );
        const results = await response.json();
        if (results[0]) {
          onChange({ lat: parseFloat(results[0].lat), lng: parseFloat(results[0].lon) });
        }
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]);

  const handleUseMyLocation = async () => {
    setLocating(true);
    try {
      const here = await getCurrentLocation();
      onChange(here);
    } catch (err) {
      notify(
        t('locationPicker.couldNotGetLocation'),
        err instanceof Error ? err.message : t('locationPicker.checkPermission')
      );
    } finally {
      setLocating(false);
    }
  };

  return (
    <View style={styles.wrapper}>
      <View style={styles.searchRow}>
        <View style={styles.searchInput}>
          <TextField
            value={address}
            onChangeText={setAddress}
            placeholder={t('locationPicker.searchPlaceholder')}
            autoCapitalize="none"
          />
        </View>
        {searching ? <ActivityIndicator size="small" color={colors.textMuted} /> : null}
      </View>
      {value ? <StaticPinMap lat={value.lat} lng={value.lng} /> : null}
      <View style={styles.actionsRow}>
        <Text style={[styles.hint, { color: value ? colors.brand : colors.textMuted, fontFamily: font.family.bodyRegular }]}>
          {value ? `📍 ${t('locationPicker.pinnedAt', { lat: value.lat.toFixed(3), lng: value.lng.toFixed(3) })}` : t('locationPicker.noLocationSet')}
        </Text>
        <View style={styles.actionButtons}>
          <HoverPressable
            onPress={handleUseMyLocation}
            style={[styles.smallButton, { borderWidth: border.rest.width, borderColor: colors.brand }]}
            disabled={locating}
          >
            <Text style={[styles.smallButtonText, { color: colors.brand, fontFamily: font.family.monoBold }]}>
              {locating ? t('locationPicker.locating') : t('locationPicker.useMyLocation')}
            </Text>
          </HoverPressable>
          {value ? (
            <HoverPressable onPress={() => onChange(null)} style={[styles.smallButton, { borderWidth: border.rest.width, borderColor: border.rest.color }]}>
              <Text style={[styles.smallButtonText, { color: colors.textPrimary, fontFamily: font.family.monoBold }]}>{t('locationPicker.clear')}</Text>
            </HoverPressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 12,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchInput: {
    flex: 1,
  },
  mapWrap: {
    height: 200,
    overflow: 'hidden',
  },
  canvas: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    marginLeft: -(CANVAS_SIZE / 2),
    marginTop: -(CANVAS_SIZE / 2),
    width: CANVAS_SIZE,
    height: CANVAS_SIZE,
  },
  marker: {
    position: 'absolute',
    width: MARKER_SIZE,
    height: MARKER_SIZE,
    borderRadius: MARKER_SIZE / 2,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  hint: {
    fontSize: 12,
    flexShrink: 1,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  smallButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  smallButtonText: {
    fontSize: 10,
    letterSpacing: 0.8,
  },
});
