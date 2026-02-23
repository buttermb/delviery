/**
 * Checkout Zone Validation Hook
 * Validates delivery addresses against both legacy JSONB zones and new table zones
 * Provides unified zone matching for storefront checkout
 */

import { useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { isPointInPolygon, isWithinDeliveryHours, validateOrderForZone } from '@/lib/utils/zoneValidation';
import type { DeliveryZone, DeliveryHours, ZoneMatchResult, ZoneValidationResult } from '@/types/delivery-zone';

/**
 * Legacy zone format from marketplace_stores.delivery_zones JSONB
 */
interface LegacyZone {
  zip_code: string;
  fee: number;
  min_order?: number;
}

interface UseCheckoutZoneValidationOptions {
  tenantId: string | null;
  storeId?: string | null;
}

/**
 * Hook for validating addresses against delivery zones during checkout
 * Supports both legacy JSONB zones and new polygon-based zones
 */
export function useCheckoutZoneValidation({ tenantId, storeId }: UseCheckoutZoneValidationOptions) {
  // Fetch zones from the new delivery_zones table
  const { data: tableZones = [], isLoading: isLoadingTableZones } = useQuery({
    queryKey: ['checkout-delivery-zones', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];

      const { data, error } = await (supabase as any)
        .from('delivery_zones')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .order('priority', { ascending: false });

      if (error) {
        logger.error('Failed to fetch delivery zones for checkout', error);
        return [];
      }

      return (data || []) as DeliveryZone[];
    },
    enabled: !!tenantId,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  /**
   * Find matching zone by ZIP code
   * Checks both legacy JSONB zones and new table zones
   */
  const findZoneByZip = useCallback(
    (zipCode: string, legacyZones: LegacyZone[] = []): ZoneMatchResult | null => {
      if (!zipCode) return null;

      // First check new table zones (higher priority)
      for (const zone of tableZones) {
        if (zone.zip_codes && zone.zip_codes.includes(zipCode)) {
          return {
            zone_id: zone.id,
            zone_name: zone.name,
            delivery_fee: zone.delivery_fee,
            minimum_order: zone.minimum_order,
            delivery_hours: zone.delivery_hours,
            estimated_time_min: zone.estimated_time_min,
            estimated_time_max: zone.estimated_time_max,
          };
        }
      }

      // Fall back to legacy JSONB zones
      const legacyMatch = legacyZones.find((z) => z.zip_code === zipCode);
      if (legacyMatch) {
        return {
          zone_id: `legacy-${legacyMatch.zip_code}`,
          zone_name: `ZIP ${legacyMatch.zip_code}`,
          delivery_fee: legacyMatch.fee,
          minimum_order: legacyMatch.min_order || 0,
          delivery_hours: null as unknown as DeliveryHours, // Legacy zones don't have hours
          estimated_time_min: 30,
          estimated_time_max: 60,
        };
      }

      return null;
    },
    [tableZones]
  );

  /**
   * Find matching zone by coordinates (polygon check)
   * Only checks new table zones (legacy zones don't support polygons)
   */
  const findZoneByCoordinates = useCallback(
    (lat: number, lng: number): ZoneMatchResult | null => {
      for (const zone of tableZones) {
        if (zone.polygon && zone.polygon.length >= 3) {
          if (isPointInPolygon(lat, lng, zone.polygon)) {
            return {
              zone_id: zone.id,
              zone_name: zone.name,
              delivery_fee: zone.delivery_fee,
              minimum_order: zone.minimum_order,
              delivery_hours: zone.delivery_hours,
              estimated_time_min: zone.estimated_time_min,
              estimated_time_max: zone.estimated_time_max,
            };
          }
        }
      }

      return null;
    },
    [tableZones]
  );

  /**
   * Validate an address for checkout
   * Returns validation result with zone info or error
   */
  const validateAddress = useCallback(
    (params: {
      zipCode: string;
      lat?: number | null;
      lng?: number | null;
      subtotal: number;
      legacyZones?: LegacyZone[];
      checkDeliveryHours?: boolean;
    }): ZoneValidationResult => {
      const { zipCode, lat, lng, subtotal, legacyZones = [], checkDeliveryHours = false } = params;

      // Try to find zone by coordinates first (more accurate)
      let zone: ZoneMatchResult | null = null;

      if (lat && lng) {
        zone = findZoneByCoordinates(lat, lng);
      }

      // Fall back to ZIP code matching
      if (!zone && zipCode) {
        zone = findZoneByZip(zipCode, legacyZones);
      }

      // If no zones are configured (both table and legacy), allow delivery
      if (tableZones.length === 0 && legacyZones.length === 0) {
        return {
          isValid: true,
          zone: null,
        };
      }

      // Validate against zone requirements
      return validateOrderForZone(zone, subtotal, checkDeliveryHours);
    },
    [tableZones, findZoneByCoordinates, findZoneByZip]
  );

  /**
   * Get delivery fee for an address
   */
  const getDeliveryFee = useCallback(
    (params: {
      zipCode: string;
      lat?: number | null;
      lng?: number | null;
      subtotal: number;
      freeDeliveryThreshold?: number;
      defaultDeliveryFee?: number;
      legacyZones?: LegacyZone[];
    }): number => {
      const {
        zipCode,
        lat,
        lng,
        subtotal,
        freeDeliveryThreshold = 100,
        defaultDeliveryFee = 5,
        legacyZones = [],
      } = params;

      // Free delivery above threshold
      if (subtotal >= freeDeliveryThreshold) {
        return 0;
      }

      // Try to find zone by coordinates first
      let zone: ZoneMatchResult | null = null;

      if (lat && lng) {
        zone = findZoneByCoordinates(lat, lng);
      }

      // Fall back to ZIP code matching
      if (!zone && zipCode) {
        zone = findZoneByZip(zipCode, legacyZones);
      }

      // Return zone fee or default
      return zone ? zone.delivery_fee : defaultDeliveryFee;
    },
    [findZoneByCoordinates, findZoneByZip]
  );

  /**
   * Check if any zones are configured
   */
  const hasZonesConfigured = useMemo(() => tableZones.length > 0, [tableZones]);

  return {
    // Zone data
    zones: tableZones,
    isLoading: isLoadingTableZones,
    hasZonesConfigured,

    // Validation functions
    validateAddress,
    findZoneByZip,
    findZoneByCoordinates,
    getDeliveryFee,
  };
}

export default useCheckoutZoneValidation;
