/**
 * Weather Widget for Delivery Planning
 *
 * Displays current weather conditions, forecast, and delivery recommendations
 * to help plan and optimize delivery routes.
 */

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import Cloud from "lucide-react/dist/esm/icons/cloud";
import CloudRain from "lucide-react/dist/esm/icons/cloud-rain";
import CloudSnow from "lucide-react/dist/esm/icons/cloud-snow";
import CloudLightning from "lucide-react/dist/esm/icons/cloud-lightning";
import CloudFog from "lucide-react/dist/esm/icons/cloud-fog";
import CloudSun from "lucide-react/dist/esm/icons/cloud-sun";
import Sun from "lucide-react/dist/esm/icons/sun";
import Moon from "lucide-react/dist/esm/icons/moon";
import Wind from "lucide-react/dist/esm/icons/wind";
import Droplets from "lucide-react/dist/esm/icons/droplets";
import Thermometer from "lucide-react/dist/esm/icons/thermometer";
import AlertTriangle from "lucide-react/dist/esm/icons/alert-triangle";
import MapPin from "lucide-react/dist/esm/icons/map-pin";
import RefreshCw from "lucide-react/dist/esm/icons/refresh-cw";
import ChevronRight from "lucide-react/dist/esm/icons/chevron-right";
import Eye from "lucide-react/dist/esm/icons/eye";
import {
  useWeatherData,
  getSeverityVariant,
  formatTemperature,
  formatWindSpeed,
  type WeatherSeverity,
  type ForecastHour,
  type WeatherLocation,
} from '@/hooks/useWeatherData';
import { useAccount } from '@/contexts/AccountContext';
import { logger } from '@/lib/logger';
import { cn } from '@/lib/utils';

/**
 * Get weather icon component based on condition
 */
function WeatherIcon({
  conditionId,
  className,
  isDay = true,
}: {
  conditionId: number;
  className?: string;
  isDay?: boolean;
}) {
  // Thunderstorm (200-299)
  if (conditionId >= 200 && conditionId < 300) {
    return <CloudLightning className={className} />;
  }

  // Drizzle (300-399) or Rain (500-599)
  if ((conditionId >= 300 && conditionId < 400) || (conditionId >= 500 && conditionId < 600)) {
    return <CloudRain className={className} />;
  }

  // Snow (600-699)
  if (conditionId >= 600 && conditionId < 700) {
    return <CloudSnow className={className} />;
  }

  // Atmosphere (fog, mist, etc.) (700-799)
  if (conditionId >= 700 && conditionId < 800) {
    return <CloudFog className={className} />;
  }

  // Clear (800)
  if (conditionId === 800) {
    return isDay ? <Sun className={className} /> : <Moon className={className} />;
  }

  // Clouds (801-804)
  if (conditionId > 800 && conditionId < 900) {
    if (conditionId <= 802) {
      return <CloudSun className={className} />;
    }
    return <Cloud className={className} />;
  }

  return <Cloud className={className} />;
}

/**
 * Get severity background color for visual indicator
 */
function getSeverityBgColor(severity: WeatherSeverity): string {
  switch (severity) {
    case 'good':
      return 'bg-green-500/10 border-green-500/20';
    case 'moderate':
      return 'bg-yellow-500/10 border-yellow-500/20';
    case 'poor':
      return 'bg-orange-500/10 border-orange-500/20';
    case 'severe':
      return 'bg-red-500/10 border-red-500/20';
    default:
      return 'bg-gray-500/10 border-gray-500/20';
  }
}

/**
 * Get severity icon color
 */
function getSeverityIconColor(severity: WeatherSeverity): string {
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
 * Format hour from timestamp
 */
function formatHour(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('en-US', {
    hour: 'numeric',
    hour12: true,
  });
}

/**
 * Check if it's daytime (rough estimate)
 */
function isDaytime(): boolean {
  const hour = new Date().getHours();
  return hour >= 6 && hour < 20;
}

/**
 * Forecast item component
 */
function ForecastItem({ forecast }: { forecast: ForecastHour }) {
  const conditionId = forecast.conditions[0]?.id || 800;

  return (
    <div className="flex flex-col items-center gap-1 text-center min-w-[60px]">
      <span className="text-xs text-muted-foreground">{formatHour(forecast.timestamp)}</span>
      <WeatherIcon conditionId={conditionId} className="h-5 w-5 text-muted-foreground" />
      <span className="text-sm font-medium">{formatTemperature(forecast.temperature)}</span>
      {forecast.precipitationChance > 0 && (
        <span className="text-xs text-blue-500 flex items-center gap-0.5">
          <Droplets className="h-3 w-3" />
          {forecast.precipitationChance}%
        </span>
      )}
    </div>
  );
}

export function WeatherWidget() {
  const { account } = useAccount();
  const [location, setLocation] = useState<WeatherLocation | null>(null);
  const [isRequestingLocation, setIsRequestingLocation] = useState(false);

  // Try to get location from account or geolocation
  useEffect(() => {
    // If account has a default location, use it
    // For now, we'll try browser geolocation
    const savedLocation = localStorage.getItem('weather_location');
    if (savedLocation) {
      try {
        setLocation(JSON.parse(savedLocation));
      } catch {
        // Invalid saved location, will request new one
      }
    }
  }, [account]);

  const { data: weather, isLoading, error, refetch, isFetching } = useWeatherData({
    location,
    enabled: !!location,
  });

  /**
   * Request user's location via browser geolocation
   */
  const requestLocation = () => {
    if (!navigator.geolocation) {
      logger.warn('Geolocation not supported');
      return;
    }

    setIsRequestingLocation(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const newLocation: WeatherLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        setLocation(newLocation);
        localStorage.setItem('weather_location', JSON.stringify(newLocation));
        setIsRequestingLocation(false);
      },
      (err) => {
        logger.error('Geolocation error', err);
        setIsRequestingLocation(false);
        // Set a default location (e.g., Los Angeles for cannabis distribution)
        const defaultLocation: WeatherLocation = {
          latitude: 34.0522,
          longitude: -118.2437,
          name: 'Los Angeles, CA',
        };
        setLocation(defaultLocation);
        localStorage.setItem('weather_location', JSON.stringify(defaultLocation));
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    );
  };

  // Request location on mount if not available
  useEffect(() => {
    if (!location && !isRequestingLocation) {
      requestLocation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Loading state
  if (isLoading || isRequestingLocation) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Cloud className="h-5 w-5 text-blue-500" />
            Weather & Delivery
          </h3>
        </div>
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Skeleton className="h-16 w-16 rounded-lg" />
            <div className="space-y-2">
              <Skeleton className="h-8 w-24" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
          <Skeleton className="h-4 w-full" />
          <div className="flex gap-4 overflow-hidden">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-14 flex-shrink-0" />
            ))}
          </div>
        </div>
      </Card>
    );
  }

  // No location state
  if (!location) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Cloud className="h-5 w-5 text-blue-500" />
            Weather & Delivery
          </h3>
        </div>
        <div className="text-center py-6">
          <MapPin className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-50" />
          <p className="text-sm text-muted-foreground mb-4">
            Enable location to see weather conditions for delivery planning
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={requestLocation}
            disabled={isRequestingLocation}
          >
            <MapPin className="h-4 w-4 mr-2" />
            Enable Location
          </Button>
        </div>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Cloud className="h-5 w-5 text-blue-500" />
            Weather & Delivery
          </h3>
        </div>
        <div className="text-center py-6">
          <AlertTriangle className="h-10 w-10 mx-auto mb-3 text-destructive opacity-70" />
          <p className="text-sm text-muted-foreground mb-2">
            Unable to load weather data
          </p>
          <p className="text-xs text-muted-foreground mb-4">
            {error instanceof Error ? error.message : 'Please try again'}
          </p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
      </Card>
    );
  }

  // No data state
  if (!weather) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Cloud className="h-5 w-5 text-blue-500" />
            Weather & Delivery
          </h3>
        </div>
        <div className="text-center py-6 text-muted-foreground text-sm">
          <Cloud className="h-8 w-8 mx-auto mb-2 opacity-50" />
          No weather data available
        </div>
      </Card>
    );
  }

  const currentCondition = weather.current.conditions[0];
  const isDay = isDaytime();

  return (
    <Card className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Cloud className="h-5 w-5 text-blue-500" />
          Weather & Delivery
        </h3>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          <RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} />
        </Button>
      </div>

      {/* Current Weather */}
      <div className="flex items-start gap-4 mb-4">
        <div className="flex items-center justify-center h-16 w-16 rounded-lg bg-muted">
          <WeatherIcon
            conditionId={currentCondition?.id || 800}
            className="h-10 w-10 text-muted-foreground"
            isDay={isDay}
          />
        </div>
        <div className="flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold">
              {formatTemperature(weather.current.temperature, weather.units)}
            </span>
            <span className="text-sm text-muted-foreground capitalize">
              {currentCondition?.description || 'Unknown'}
            </span>
          </div>
          <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
            <MapPin className="h-3 w-3" />
            <span>{weather.location.name}</span>
          </div>
        </div>
      </div>

      {/* Weather Details */}
      <div className="grid grid-cols-4 gap-2 mb-4 text-sm">
        <div className="flex flex-col items-center p-2 rounded-lg bg-muted/50">
          <Thermometer className="h-4 w-4 text-muted-foreground mb-1" />
          <span className="text-xs text-muted-foreground">Feels</span>
          <span className="font-medium">{formatTemperature(weather.current.feelsLike, weather.units)}</span>
        </div>
        <div className="flex flex-col items-center p-2 rounded-lg bg-muted/50">
          <Wind className="h-4 w-4 text-muted-foreground mb-1" />
          <span className="text-xs text-muted-foreground">Wind</span>
          <span className="font-medium">{formatWindSpeed(weather.current.windSpeed, weather.units)}</span>
        </div>
        <div className="flex flex-col items-center p-2 rounded-lg bg-muted/50">
          <Droplets className="h-4 w-4 text-muted-foreground mb-1" />
          <span className="text-xs text-muted-foreground">Humidity</span>
          <span className="font-medium">{weather.current.humidity}%</span>
        </div>
        <div className="flex flex-col items-center p-2 rounded-lg bg-muted/50">
          <Eye className="h-4 w-4 text-muted-foreground mb-1" />
          <span className="text-xs text-muted-foreground">Visibility</span>
          <span className="font-medium">{Math.round(weather.current.visibility / 1609)}mi</span>
        </div>
      </div>

      {/* Delivery Conditions */}
      <div
        className={cn(
          'rounded-lg border p-3 mb-4',
          getSeverityBgColor(weather.deliveryCondition)
        )}
      >
        <div className="flex items-center gap-2 mb-1">
          <Badge variant={getSeverityVariant(weather.deliveryCondition)}>
            {weather.deliveryCondition.charAt(0).toUpperCase() + weather.deliveryCondition.slice(1)} Conditions
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {weather.deliveryRecommendation}
        </p>
      </div>

      {/* Alerts */}
      {weather.alerts.length > 0 && (
        <div className="space-y-2 mb-4">
          {weather.alerts.slice(0, 2).map((alert, index) => (
            <div
              key={index}
              className="flex items-start gap-2 text-sm p-2 rounded-lg bg-muted/50"
            >
              <AlertTriangle
                className={cn('h-4 w-4 mt-0.5 flex-shrink-0', getSeverityIconColor(alert.severity))}
              />
              <div>
                <span className="font-medium">{alert.message}</span>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {alert.recommendation}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Hourly Forecast */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-muted-foreground">Next Hours</span>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-2 px-2">
          {weather.forecast.slice(0, 6).map((hour, index) => (
            <ForecastItem key={index} forecast={hour} />
          ))}
        </div>
      </div>
    </Card>
  );
}
