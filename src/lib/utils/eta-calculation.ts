// @ts-nocheck
import { logger } from '@/lib/logger';
/**
 * ETA Calculation Utility
 * Uses Mapbox Directions API to calculate estimated time of arrival
 */

/**
 * Get Mapbox token from environment or tenant settings
 */
async function getMapboxToken(): Promise<string | null> {
  // First try environment variable
  const envToken = import.meta.env.VITE_MAPBOX_TOKEN;
  if (envToken) return envToken;

  // Then try tenant settings
  try {
    const { supabase } = await import('@/integrations/supabase/client');
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: tenantUser } = await supabase
      .from('tenant_users')
      .select('tenant_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!tenantUser) return null;

    const { data: settings } = await supabase
      .from('account_settings')
      .select('integration_settings')
      .eq('account_id', tenantUser.tenant_id)
      .maybeSingle();

    const integrationSettings = settings?.integration_settings as Record<string, any> | null;
    if (integrationSettings && typeof integrationSettings === 'object' && integrationSettings.mapbox_token) {
      return integrationSettings.mapbox_token as string;
    }
  } catch (error) {
    logger.error('Failed to load Mapbox token', error, { component: 'eta-calculation' });
  }

  return null;
}

export interface ETAResult {
  duration: number; // in seconds
  distance: number; // in meters
  eta: Date; // estimated arrival time
  formatted: string; // human-readable ETA (e.g., "15 mins")
}

/**
 * Calculate ETA from driver location to destination
 * @param driverLocation - [longitude, latitude] of driver
 * @param destination - [longitude, latitude] of destination
 * @returns ETA result or null if calculation fails
 */
export async function calculateETA(
  driverLocation: [number, number],
  destination: [number, number]
): Promise<ETAResult | null> {
  const MAPBOX_TOKEN = await getMapboxToken();

  if (!MAPBOX_TOKEN || MAPBOX_TOKEN === '') {
    logger.warn('Mapbox token not configured, using fallback ETA calculation', undefined, { component: 'eta-calculation' });
    return calculateFallbackETA(driverLocation, destination);
  }

  try {
    const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${driverLocation[0]},${driverLocation[1]};${destination[0]},${destination[1]}?access_token=${MAPBOX_TOKEN}&geometries=geojson`;

    const safeFetch = fetch.bind(window);
    const response = await safeFetch(url);

    if (!response.ok) {
      throw new Error(`Mapbox API error: ${response.status}`);
    }

    const data = await response.json();

    if (!data.routes || data.routes.length === 0) {
      throw new Error('No routes found');
    }

    const route = data.routes[0];
    const duration = route.duration; // seconds
    const distance = route.distance; // meters
    const eta = new Date(Date.now() + duration * 1000);

    return {
      duration,
      distance,
      eta,
      formatted: formatDuration(duration),
    };
  } catch (error) {
    logger.error('Error calculating ETA:', error);
    // Fallback to simple calculation
    return calculateFallbackETA(driverLocation, destination);
  }
}

/**
 * Fallback ETA calculation using haversine distance
 * Assumes average speed of 30 km/h in city traffic
 */
function calculateFallbackETA(
  driverLocation: [number, number],
  destination: [number, number]
): ETAResult {
  const distance = calculateHaversineDistance(
    driverLocation[1], // lat1
    driverLocation[0], // lng1
    destination[1], // lat2
    destination[0] // lng2
  );

  // Assume average speed of 30 km/h (8.33 m/s) in city traffic
  const averageSpeed = 8.33; // meters per second
  const duration = Math.round(distance / averageSpeed); // seconds

  const eta = new Date(Date.now() + duration * 1000);

  return {
    duration,
    distance,
    eta,
    formatted: formatDuration(duration),
  };
}

/**
 * Calculate distance between two points using Haversine formula
 * @returns distance in meters
 */
function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

/**
 * Format duration in seconds to human-readable string
 */
function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`;
  }

  const minutes = Math.round(seconds / 60);

  if (minutes < 60) {
    return `${minutes} min${minutes !== 1 ? 's' : ''}`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (remainingMinutes === 0) {
    return `${hours} hr${hours !== 1 ? 's' : ''}`;
  }

  return `${hours} hr ${remainingMinutes} min`;
}

