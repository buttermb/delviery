/**
 * useWeatherData Hook
 *
 * Fetches weather data for delivery planning via the fetch-weather edge function.
 * Provides current conditions, forecast, and delivery recommendations.
 */

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { STORAGE_KEYS, safeStorage, safeJsonParse } from '@/constants/storageKeys';

export type WeatherSeverity = 'good' | 'moderate' | 'poor' | 'severe';

export interface WeatherCondition {
  id: number;
  main: string;
  description: string;
  icon: string;
}

export interface CurrentWeather {
  temperature: number;
  feelsLike: number;
  humidity: number;
  windSpeed: number;
  windDirection: number;
  visibility: number;
  conditions: WeatherCondition[];
  cloudiness: number;
  precipitation?: number;
}

export interface ForecastHour {
  timestamp: number;
  dateTime: string;
  temperature: number;
  feelsLike: number;
  humidity: number;
  windSpeed: number;
  conditions: WeatherCondition[];
  precipitationChance: number;
  precipitation?: number;
}

export interface DeliveryAlert {
  severity: WeatherSeverity;
  type: string;
  message: string;
  recommendation: string;
}

export interface WeatherData {
  current: CurrentWeather;
  forecast: ForecastHour[];
  alerts: DeliveryAlert[];
  deliveryCondition: WeatherSeverity;
  deliveryRecommendation: string;
  location: {
    name: string;
    country: string;
  };
  units: 'metric' | 'imperial';
  fetchedAt: string;
}

export interface WeatherLocation {
  latitude: number;
  longitude: number;
  name?: string;
}

interface UseWeatherDataOptions {
  location?: WeatherLocation | null;
  enabled?: boolean;
}

/**
 * Get weather icon based on condition code
 */
export function getWeatherIconName(conditionId: number, isDay = true): string {
  // Thunderstorm (200-299)
  if (conditionId >= 200 && conditionId < 300) return 'cloud-lightning';

  // Drizzle (300-399) or Rain (500-599)
  if ((conditionId >= 300 && conditionId < 400) || (conditionId >= 500 && conditionId < 600)) {
    if (conditionId >= 520) return 'cloud-rain';
    return 'cloud-drizzle';
  }

  // Snow (600-699)
  if (conditionId >= 600 && conditionId < 700) return 'cloud-snow';

  // Atmosphere (fog, mist, etc.) (700-799)
  if (conditionId >= 700 && conditionId < 800) return 'cloud-fog';

  // Clear (800)
  if (conditionId === 800) return isDay ? 'sun' : 'moon';

  // Clouds (801-804)
  if (conditionId > 800 && conditionId < 900) {
    if (conditionId <= 802) return isDay ? 'cloud-sun' : 'cloud-moon';
    return 'cloud';
  }

  return 'cloud';
}

/**
 * Get severity color for delivery conditions
 */
export function getSeverityColor(severity: WeatherSeverity): string {
  switch (severity) {
    case 'good':
      return 'text-green-500';
    case 'moderate':
      return 'text-yellow-500';
    case 'poor':
      return 'text-orange-500';
    case 'severe':
      return 'text-red-500';
    default:
      return 'text-gray-500';
  }
}

/**
 * Get severity badge variant
 */
export function getSeverityVariant(severity: WeatherSeverity): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (severity) {
    case 'good':
      return 'default';
    case 'moderate':
      return 'secondary';
    case 'poor':
    case 'severe':
      return 'destructive';
    default:
      return 'outline';
  }
}

/**
 * Format temperature with unit
 */
export function formatTemperature(temp: number, units: 'metric' | 'imperial' = 'imperial'): string {
  return `${Math.round(temp)}°${units === 'metric' ? 'C' : 'F'}`;
}

/**
 * Format wind speed with unit
 */
export function formatWindSpeed(speed: number, units: 'metric' | 'imperial' = 'imperial'): string {
  return `${Math.round(speed)} ${units === 'metric' ? 'm/s' : 'mph'}`;
}

/**
 * Get saved location from localStorage
 */
export function getSavedLocation(): WeatherLocation | null {
  const saved = safeStorage.getItem(STORAGE_KEYS.WEATHER_LOCATION);
  return safeJsonParse<WeatherLocation>(saved, null as unknown as WeatherLocation);
}

/**
 * Save location to localStorage
 */
export function saveLocation(location: WeatherLocation): void {
  safeStorage.setItem(STORAGE_KEYS.WEATHER_LOCATION, JSON.stringify(location));
}

/**
 * Hook to fetch weather data for delivery planning
 */
export function useWeatherData(options: UseWeatherDataOptions = {}) {
  const { location, enabled = true } = options;

  // Try to get saved location if none provided
  const effectiveLocation = location ?? getSavedLocation();

  return useQuery<WeatherData>({
    queryKey: queryKeys.weather.current(
      effectiveLocation ? `${effectiveLocation.latitude},${effectiveLocation.longitude}` : undefined
    ),
    queryFn: async () => {
      if (!effectiveLocation) {
        throw new Error('Location required');
      }

      logger.debug('Fetching weather data', {
        latitude: effectiveLocation.latitude,
        longitude: effectiveLocation.longitude,
      });

      const { data, error } = await supabase.functions.invoke('fetch-weather', {
        body: {
          latitude: effectiveLocation.latitude,
          longitude: effectiveLocation.longitude,
          units: 'imperial',
        },
      });

      if (error) {
        logger.error('Weather fetch failed', error);
        throw error;
      }

      if (!data?.success) {
        const errorMessage = data?.error || 'Failed to fetch weather data';
        logger.error('Weather API error', { error: errorMessage });
        throw new Error(errorMessage);
      }

      // Save location if fetch was successful
      if (effectiveLocation) {
        saveLocation(effectiveLocation);
      }

      return data.data as WeatherData;
    },
    enabled: enabled && !!effectiveLocation,
    staleTime: 10 * 60 * 1000, // 10 minutes
    refetchInterval: 30 * 60 * 1000, // Refresh every 30 minutes
    retry: 2,
  });
}
