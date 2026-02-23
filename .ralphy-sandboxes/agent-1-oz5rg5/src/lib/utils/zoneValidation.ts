/**
 * Zone Validation Utilities
 * Client-side utilities for validating addresses against delivery zones
 */

import type {
  Coordinate,
  Polygon,
  DeliveryHours,
  DayHours,
  ZoneMatchResult,
  ZoneValidationResult,
} from '@/types/delivery-zone';
import { formatCurrency } from '@/lib/formatters';

/**
 * Check if a point is inside a polygon using ray casting algorithm
 */
export function isPointInPolygon(lat: number, lng: number, polygon: Polygon): boolean {
  if (!polygon || polygon.length < 3) return false;

  let inside = false;
  const n = polygon.length;

  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i][0]; // longitude
    const yi = polygon[i][1]; // latitude
    const xj = polygon[j][0];
    const yj = polygon[j][1];

    if ((yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }

  return inside;
}

/**
 * Check if a ZIP code is in a zone's ZIP code list
 */
export function isZipInZone(zipCode: string, zoneZipCodes: string[]): boolean {
  if (!zoneZipCodes || zoneZipCodes.length === 0) return false;
  return zoneZipCodes.includes(zipCode);
}

/**
 * Get day name from date
 */
export function getDayName(date: Date = new Date()): keyof DeliveryHours {
  const days: (keyof DeliveryHours)[] = [
    'sunday',
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
  ];
  return days[date.getDay()];
}

/**
 * Parse time string (HH:MM) to minutes since midnight
 */
function parseTimeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Check if current time is within delivery hours for a specific day
 */
export function isWithinDeliveryHours(
  deliveryHours: DeliveryHours,
  date: Date = new Date()
): { isOpen: boolean; opensAt?: string; closesAt?: string } {
  const dayName = getDayName(date);
  const dayHours = deliveryHours[dayName];

  if (!dayHours || !dayHours.enabled) {
    return { isOpen: false };
  }

  const now = date.getHours() * 60 + date.getMinutes();
  const openTime = parseTimeToMinutes(dayHours.open);
  const closeTime = parseTimeToMinutes(dayHours.close);

  const isOpen = now >= openTime && now < closeTime;

  return {
    isOpen,
    opensAt: dayHours.open,
    closesAt: dayHours.close,
  };
}

/**
 * Get next available delivery time
 */
export function getNextAvailableTime(deliveryHours: DeliveryHours): {
  day: string;
  opensAt: string;
  closesAt: string;
} | null {
  const days: (keyof DeliveryHours)[] = [
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
    'sunday',
  ];

  const now = new Date();
  const currentDay = getDayName(now);
  const currentDayIndex = days.indexOf(currentDay);

  // Check remaining time today and upcoming days
  for (let i = 0; i < 7; i++) {
    const dayIndex = (currentDayIndex + i) % 7;
    const day = days[dayIndex];
    const dayHours = deliveryHours[day];

    if (dayHours?.enabled) {
      // For today, check if we're before closing time
      if (i === 0) {
        const nowMinutes = now.getHours() * 60 + now.getMinutes();
        const closeMinutes = parseTimeToMinutes(dayHours.close);
        if (nowMinutes < closeMinutes) {
          const openMinutes = parseTimeToMinutes(dayHours.open);
          if (nowMinutes >= openMinutes) {
            return { day, opensAt: dayHours.open, closesAt: dayHours.close };
          }
        }
        continue;
      }

      return { day, opensAt: dayHours.open, closesAt: dayHours.close };
    }
  }

  return null;
}

/**
 * Format delivery time estimate
 */
export function formatDeliveryTimeEstimate(minMinutes: number, maxMinutes: number): string {
  if (minMinutes === maxMinutes) {
    return `~${minMinutes} min`;
  }
  return `${minMinutes}-${maxMinutes} min`;
}

/**
 * Validate an order against a zone's requirements
 */
export function validateOrderForZone(
  zone: ZoneMatchResult | null,
  subtotal: number,
  checkDeliveryHours: boolean = true
): ZoneValidationResult {
  // No zone found
  if (!zone) {
    return {
      isValid: false,
      zone: null,
      error: 'This address is outside our delivery zones.',
      isOutsideAllZones: true,
    };
  }

  // Check minimum order
  if (zone.minimum_order > 0 && subtotal < zone.minimum_order) {
    return {
      isValid: false,
      zone,
      error: `This zone requires a minimum order of ${formatCurrency(zone.minimum_order)}.`,
      isBelowMinimum: true,
    };
  }

  // Check delivery hours if requested
  if (checkDeliveryHours && zone.delivery_hours) {
    const hoursCheck = isWithinDeliveryHours(zone.delivery_hours);
    if (!hoursCheck.isOpen) {
      const next = getNextAvailableTime(zone.delivery_hours);
      const nextTimeStr = next
        ? `We deliver ${next.day} from ${next.opensAt} to ${next.closesAt}.`
        : 'No delivery times available.';
      return {
        isValid: false,
        zone,
        error: `We're not currently delivering to this zone. ${nextTimeStr}`,
        isOutsideDeliveryHours: true,
      };
    }
  }

  // All validations passed
  return {
    isValid: true,
    zone,
  };
}

/**
 * Calculate the center point of a polygon
 */
export function getPolygonCenter(polygon: Polygon): Coordinate | null {
  if (!polygon || polygon.length === 0) return null;

  let sumLng = 0;
  let sumLat = 0;

  for (const [lng, lat] of polygon) {
    sumLng += lng;
    sumLat += lat;
  }

  return [sumLng / polygon.length, sumLat / polygon.length];
}

/**
 * Calculate bounding box of a polygon
 */
export function getPolygonBounds(
  polygon: Polygon
): { minLng: number; maxLng: number; minLat: number; maxLat: number } | null {
  if (!polygon || polygon.length === 0) return null;

  let minLng = Infinity;
  let maxLng = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;

  for (const [lng, lat] of polygon) {
    minLng = Math.min(minLng, lng);
    maxLng = Math.max(maxLng, lng);
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
  }

  return { minLng, maxLng, minLat, maxLat };
}
