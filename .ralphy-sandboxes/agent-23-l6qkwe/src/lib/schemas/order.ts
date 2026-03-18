/**
 * Order & Order Item Zod schemas
 */

import { z } from 'zod';
import {
  uuidSchema,
  optionalTimestamp,
  jsonSchema,
  nonNegativeNumber,
} from '@/lib/schemas/common';

// ---------------------------------------------------------------------------
// Order Item
// ---------------------------------------------------------------------------

export const orderItemSchema = z.object({
  id: uuidSchema,
  order_id: uuidSchema,
  product_id: uuidSchema,
  product_name: z.string().min(1).max(200),
  quantity: z.number().int().positive().max(1000),
  price: z.number().min(0),
  created_at: optionalTimestamp,
});

export const orderItemInsertSchema = orderItemSchema
  .omit({ id: true, created_at: true });

// ---------------------------------------------------------------------------
// Order
// ---------------------------------------------------------------------------

export const orderSchema = z.object({
  id: uuidSchema,
  order_number: z.string().nullable().optional(),
  account_id: uuidSchema.nullable().optional(),
  merchant_id: uuidSchema.nullable().optional(),
  customer_id: uuidSchema.nullable().optional(),
  customer_name: z.string().nullable().optional(),
  customer_phone: z.string().nullable().optional(),
  courier_id: uuidSchema.nullable().optional(),
  cashier_id: uuidSchema.nullable().optional(),
  address_id: uuidSchema.nullable().optional(),

  // Status & type
  status: z.string().min(1),
  order_type: z.string().nullable().optional(),
  payment_method: z.string().min(1),
  payment_status: z.string().nullable().optional(),

  // Delivery info
  delivery_address: z.string(),
  delivery_borough: z.string(),
  delivery_fee: nonNegativeNumber,
  delivery_notes: z.string().max(500).nullable().optional(),
  delivery_scheduled_at: z.string().nullable().optional(),
  scheduled_delivery_time: z.string().nullable().optional(),
  special_instructions: z.string().max(500).nullable().optional(),
  distance_miles: z.number().nullable().optional(),

  // Financial
  discount_amount: nonNegativeNumber.nullable().optional(),
  discount_reason: z.string().nullable().optional(),

  // Location
  customer_lat: z.number().nullable().optional(),
  customer_lng: z.number().nullable().optional(),
  customer_location_accuracy: z.number().nullable().optional(),
  customer_location_enabled: z.boolean().nullable().optional(),
  customer_location_updated_at: z.string().nullable().optional(),
  pickup_lat: z.number().nullable().optional(),
  pickup_lng: z.number().nullable().optional(),
  dropoff_lat: z.number().nullable().optional(),
  dropoff_lng: z.number().nullable().optional(),

  // ETA
  estimated_delivery: z.string().nullable().optional(),
  eta_minutes: z.number().nullable().optional(),
  eta_updated_at: z.string().nullable().optional(),

  // Courier
  courier_assigned_at: z.string().nullable().optional(),
  courier_accepted_at: z.string().nullable().optional(),
  courier_rating: z.number().min(0).max(5).nullable().optional(),
  courier_feedback: z.string().nullable().optional(),

  // Verification
  requires_id_check: z.boolean().nullable().optional(),
  proof_of_delivery_url: z.string().nullable().optional(),
  customer_signature_url: z.string().nullable().optional(),

  // Flagging
  flagged_at: z.string().nullable().optional(),
  flagged_by: z.string().nullable().optional(),
  flagged_reason: z.string().nullable().optional(),

  // Timestamps
  accepted_at: z.string().nullable().optional(),
  delivered_at: z.string().nullable().optional(),
  created_at: optionalTimestamp,

  // Notifications
  last_notification_sent_at: z.string().nullable().optional(),
  notification_sent_stage_1: z.boolean().nullable().optional(),
  notification_sent_stage_2: z.boolean().nullable().optional(),
  notification_sent_stage_3: z.boolean().nullable().optional(),
  notification_sent_stage_4: z.boolean().nullable().optional(),
  notification_sent_stage_5: z.boolean().nullable().optional(),
  notification_sent_stage_6: z.boolean().nullable().optional(),
  notification_sent_stage_7: z.boolean().nullable().optional(),
  notification_sent_stage_8: z.boolean().nullable().optional(),
});

/** Minimal schema for placing a new order (form input) */
export const orderCreateSchema = z.object({
  items: z.array(z.object({
    productId: uuidSchema,
    quantity: z.number().int().positive().max(100),
  })).min(1).max(50),
  addressId: uuidSchema,
  paymentMethod: z.string().min(1),
  deliveryNotes: z.string().max(500).optional(),
});

export const orderUpdateSchema = orderSchema.partial();

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------

export type OrderSchema = z.infer<typeof orderSchema>;
export type OrderItemSchema = z.infer<typeof orderItemSchema>;
export type OrderCreate = z.infer<typeof orderCreateSchema>;
