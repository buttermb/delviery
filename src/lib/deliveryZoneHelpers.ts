/**
 * Utility functions for Smart Delivery Zones
 * Geocoding, distance calculation, fee suggestion, and zone naming
 */

import { logger } from '@/lib/logger';

import type { ZipChip } from '@/types/setup-wizard';

/** Geocode a ZIP code via Mapbox forward geocoding (US postcodes only) */
export async function geocodeZipCode(
  zip: string,
  token: string
): Promise<{ city: string; state: string; lat: number; lng: number } | null> {
  try {
    const safeFetch = fetch.bind(window);
    const response = await safeFetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(zip)}.json?access_token=${token}&types=postcode&country=us&limit=1`
    );

    if (!response.ok) {
      logger.error('Mapbox geocoding request failed', { status: response.status });
      return null;
    }

    const data = await response.json();
    const feature = data.features?.[0];
    if (!feature) return null;

    const [lng, lat] = feature.center as [number, number];

    // Extract city and state from context
    let city = '';
    let state = '';
    for (const ctx of feature.context ?? []) {
      if (ctx.id?.startsWith('place.')) {
        city = ctx.text ?? '';
      } else if (ctx.id?.startsWith('region.')) {
        state = ctx.short_code?.replace('US-', '') ?? ctx.text ?? '';
      }
    }

    // Fallback: use the feature text itself as city if context didn't provide one
    if (!city) {
      city = feature.text ?? zip;
    }

    return { city, state, lat, lng };
  } catch (error) {
    logger.error('Failed to geocode ZIP code', error instanceof Error ? error : new Error(String(error)));
    return null;
  }
}

/** Haversine distance between two lat/lng points, in miles */
export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 3958.8; // Earth radius in miles
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Suggest a delivery fee based on distance in miles */
export function suggestDeliveryFee(distanceMiles: number): number {
  if (distanceMiles <= 5) return 4;
  if (distanceMiles <= 10) return 7;
  if (distanceMiles <= 20) return 12;
  return 18;
}

/** Generate a zone name from the most common city in the ZIP chips */
export function generateZoneName(zipChips: ZipChip[]): string {
  const validChips = zipChips.filter((c) => c.status === 'valid' && c.city);
  if (validChips.length === 0) return '';

  // Count city occurrences
  const cityCounts = new Map<string, number>();
  for (const chip of validChips) {
    cityCounts.set(chip.city, (cityCounts.get(chip.city) ?? 0) + 1);
  }

  // Find most common city
  let topCity = '';
  let topCount = 0;
  for (const [city, count] of cityCounts) {
    if (count > topCount) {
      topCity = city;
      topCount = count;
    }
  }

  const uniqueCities = cityCounts.size;
  if (uniqueCities > 1) {
    return `${topCity} & Nearby`;
  }
  return topCity;
}
