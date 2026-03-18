/**
 * Delivery Zone Types
 * Type definitions for polygon-based delivery zones with fees, minimums, and hours
 */

/**
 * Coordinate pair for polygon vertices [longitude, latitude]
 */
export type Coordinate = [number, number];

/**
 * Polygon as array of coordinates
 */
export type Polygon = Coordinate[];

/**
 * Delivery hours for a single day
 */
export interface DayHours {
  open: string;
  close: string;
  enabled: boolean;
}

/**
 * Weekly delivery hours schedule
 */
export interface DeliveryHours {
  monday: DayHours;
  tuesday: DayHours;
  wednesday: DayHours;
  thursday: DayHours;
  friday: DayHours;
  saturday: DayHours;
  sunday: DayHours;
}

/**
 * Default delivery hours
 */
export const DEFAULT_DELIVERY_HOURS: DeliveryHours = {
  monday: { open: '09:00', close: '21:00', enabled: true },
  tuesday: { open: '09:00', close: '21:00', enabled: true },
  wednesday: { open: '09:00', close: '21:00', enabled: true },
  thursday: { open: '09:00', close: '21:00', enabled: true },
  friday: { open: '09:00', close: '21:00', enabled: true },
  saturday: { open: '10:00', close: '18:00', enabled: true },
  sunday: { open: '10:00', close: '18:00', enabled: false },
};

/**
 * Delivery zone database record
 */
export interface DeliveryZone {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  color: string;
  polygon: Polygon;
  zip_codes: string[];
  delivery_fee: number;
  minimum_order: number;
  delivery_hours: DeliveryHours;
  estimated_time_min: number;
  estimated_time_max: number;
  is_active: boolean;
  priority: number;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

/**
 * Delivery zone form data for create/update
 */
export interface DeliveryZoneFormData {
  name: string;
  description?: string;
  color: string;
  polygon: Polygon;
  zip_codes: string[];
  delivery_fee: number;
  minimum_order: number;
  delivery_hours: DeliveryHours;
  estimated_time_min: number;
  estimated_time_max: number;
  is_active: boolean;
  priority: number;
}

/**
 * Zone match result from validation functions
 */
export interface ZoneMatchResult {
  zone_id: string;
  zone_name: string;
  delivery_fee: number;
  minimum_order: number;
  delivery_hours: DeliveryHours;
  estimated_time_min: number;
  estimated_time_max: number;
}

/**
 * Zone validation result
 */
export interface ZoneValidationResult {
  isValid: boolean;
  zone: ZoneMatchResult | null;
  error?: string;
  isOutsideAllZones?: boolean;
  isBelowMinimum?: boolean;
  isOutsideDeliveryHours?: boolean;
}
