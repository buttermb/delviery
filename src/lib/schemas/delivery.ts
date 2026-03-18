/**
 * Delivery & Courier Zod schemas
 */

import { z } from 'zod';
import {
  uuidSchema,
  optionalTimestamp,
  vehicleTypeEnum,
  optionalUrl,
  jsonSchema,
} from '@/lib/schemas/common';

// ---------------------------------------------------------------------------
// Courier
// ---------------------------------------------------------------------------

export const courierSchema = z.object({
  id: uuidSchema,
  user_id: uuidSchema,
  tenant_id: uuidSchema.nullable().optional(),
  full_name: z.string().min(1).max(200),
  email: z.string().email().max(255),
  phone: z.string().min(1),
  license_number: z.string().min(1),
  vehicle_type: z.string(),
  vehicle_make: z.string().nullable().optional(),
  vehicle_model: z.string().nullable().optional(),
  vehicle_plate: z.string().nullable().optional(),
  profile_photo_url: optionalUrl,

  // Status
  is_active: z.boolean().nullable().optional(),
  is_online: z.boolean().nullable().optional(),
  age_verified: z.boolean().nullable().optional(),

  // Location
  current_lat: z.number().nullable().optional(),
  current_lng: z.number().nullable().optional(),
  last_location_update: z.string().nullable().optional(),

  // Stats
  rating: z.number().min(0).max(5).nullable().optional(),
  on_time_rate: z.number().min(0).max(100).nullable().optional(),
  total_deliveries: z.number().int().min(0).nullable().optional(),
  commission_rate: z.number().min(0).max(100).nullable().optional(),

  // PIN
  admin_pin: z.string().nullable().optional(),
  admin_pin_verified: z.boolean().nullable().optional(),
  pin_hash: z.string().nullable().optional(),
  pin_set_at: z.string().nullable().optional(),
  pin_last_verified_at: z.string().nullable().optional(),

  // Notification prefs
  notification_sound: z.boolean().nullable().optional(),
  notification_vibrate: z.boolean().nullable().optional(),

  created_at: optionalTimestamp,
  updated_at: optionalTimestamp,
});

export const courierInsertSchema = courierSchema
  .omit({
    id: true,
    created_at: true,
    updated_at: true,
    rating: true,
    total_deliveries: true,
    on_time_rate: true,
    admin_pin: true,
    pin_hash: true,
  })
  .partial()
  .required({ user_id: true, full_name: true, email: true, phone: true, license_number: true, vehicle_type: true });

// ---------------------------------------------------------------------------
// Delivery
// ---------------------------------------------------------------------------

export const deliverySchema = z.object({
  id: uuidSchema,
  order_id: uuidSchema,
  courier_id: uuidSchema,
  tenant_id: uuidSchema.nullable().optional(),

  // Coordinates
  pickup_lat: z.number(),
  pickup_lng: z.number(),
  dropoff_lat: z.number(),
  dropoff_lng: z.number(),

  // Times
  estimated_pickup_time: z.string().nullable().optional(),
  actual_pickup_time: z.string().nullable().optional(),
  estimated_dropoff_time: z.string().nullable().optional(),
  actual_dropoff_time: z.string().nullable().optional(),

  // Evidence
  delivery_notes: z.string().max(500).nullable().optional(),
  delivery_photo_url: optionalUrl,
  pickup_photo_url: optionalUrl,
  signature_url: optionalUrl,
  id_verification_url: optionalUrl,
  manifest_url: optionalUrl,

  created_at: optionalTimestamp,
});

export const deliveryInsertSchema = deliverySchema
  .omit({ id: true, created_at: true })
  .partial()
  .required({ order_id: true, courier_id: true, pickup_lat: true, pickup_lng: true, dropoff_lat: true, dropoff_lng: true });

// ---------------------------------------------------------------------------
// Wholesale Delivery
// ---------------------------------------------------------------------------

export const wholesaleDeliverySchema = z.object({
  id: uuidSchema,
  order_id: uuidSchema,
  runner_id: uuidSchema,
  tenant_id: uuidSchema,
  client_id: uuidSchema.nullable().optional(),
  status: z.string().min(1),
  total_value: z.number().nullable().optional(),
  total_weight: z.number().nullable().optional(),
  collection_amount: z.number().nullable().optional(),
  notes: z.string().nullable().optional(),
  current_location: jsonSchema,
  scheduled_pickup_time: z.string().nullable().optional(),
  assigned_at: z.string(),
  picked_up_at: z.string().nullable().optional(),
  delivered_at: z.string().nullable().optional(),
  failed_at: z.string().nullable().optional(),
  created_at: z.string(),
});

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------

export type CourierSchema = z.infer<typeof courierSchema>;
export type CourierInsert = z.infer<typeof courierInsertSchema>;
export type DeliverySchema = z.infer<typeof deliverySchema>;
export type DeliveryInsert = z.infer<typeof deliveryInsertSchema>;
export type WholesaleDeliverySchema = z.infer<typeof wholesaleDeliverySchema>;
