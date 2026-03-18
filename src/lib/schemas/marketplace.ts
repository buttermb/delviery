/**
 * Marketplace Zod schemas
 */

import { z } from 'zod';
import {
  uuidSchema,
  optionalTimestamp,
  jsonSchema,
  nonNegativeNumber,
  optionalUrl,
} from '@/lib/schemas/common';

// ---------------------------------------------------------------------------
// Marketplace Listing
// ---------------------------------------------------------------------------

export const marketplaceListingSchema = z.object({
  id: uuidSchema,
  seller_tenant_id: uuidSchema,
  marketplace_profile_id: uuidSchema.nullable().optional(),
  product_name: z.string().min(1).max(200),
  description: z.string().max(2000).nullable().optional(),
  product_type: z.string().nullable().optional(),
  strain_name: z.string().nullable().optional(),
  base_price: nonNegativeNumber,
  quantity_available: z.number().int().min(0),
  unit_of_measure: z.string().nullable().optional(),
  thc_content: z.number().min(0).max(100).nullable().optional(),
  cbd_content: z.number().min(0).max(100).nullable().optional(),
  images: z.array(z.string()).nullable().optional(),
  lab_results_url: optionalUrl,
  lab_results_encrypted: z.string().nullable().optional(),
  available_states: z.array(z.string()).nullable().optional(),
  status: z.string().nullable().optional(),
  created_at: optionalTimestamp,
  updated_at: optionalTimestamp,
});

export const marketplaceListingInsertSchema = marketplaceListingSchema
  .omit({ id: true, created_at: true, updated_at: true })
  .partial()
  .required({ seller_tenant_id: true, product_name: true, base_price: true, quantity_available: true });

// ---------------------------------------------------------------------------
// Marketplace Order
// ---------------------------------------------------------------------------

export const marketplaceOrderSchema = z.object({
  id: uuidSchema,
  order_number: z.string().min(1),
  buyer_tenant_id: uuidSchema,
  seller_tenant_id: uuidSchema,
  buyer_user_id: uuidSchema.nullable().optional(),
  seller_profile_id: uuidSchema.nullable().optional(),
  store_id: uuidSchema.nullable().optional(),
  status: z.string().nullable().optional(),
  payment_status: z.string().nullable().optional(),
  payment_terms: z.string().nullable().optional(),

  // Customer info
  customer_name: z.string().nullable().optional(),
  customer_email: z.string().email().nullable().optional(),
  customer_phone: z.string().nullable().optional(),

  // Financials
  subtotal: nonNegativeNumber,
  tax: nonNegativeNumber.nullable().optional(),
  shipping_cost: nonNegativeNumber.nullable().optional(),
  platform_fee: nonNegativeNumber.nullable().optional(),
  total_amount: nonNegativeNumber,

  // Shipping
  shipping_address: jsonSchema,
  shipping_method: z.string().nullable().optional(),
  tracking_number: z.string().nullable().optional(),
  tracking_token: z.string().nullable().optional(),

  // Notes
  buyer_notes: z.string().nullable().optional(),
  seller_notes: z.string().nullable().optional(),
  delivery_notes: z.string().nullable().optional(),

  // Items (denormalized)
  items: jsonSchema,

  // Stripe
  stripe_payment_intent_id: z.string().nullable().optional(),
  stripe_session_id: z.string().nullable().optional(),

  // Timestamps
  confirmed_at: z.string().nullable().optional(),
  shipped_at: z.string().nullable().optional(),
  delivered_at: z.string().nullable().optional(),
  paid_at: z.string().nullable().optional(),
  created_at: optionalTimestamp,
  updated_at: optionalTimestamp,
});

// ---------------------------------------------------------------------------
// Marketplace Order Item
// ---------------------------------------------------------------------------

export const marketplaceOrderItemSchema = z.object({
  id: uuidSchema,
  order_id: uuidSchema,
  listing_id: uuidSchema.nullable().optional(),
  product_name: z.string().min(1),
  product_type: z.string().nullable().optional(),
  quantity: z.number().int().positive(),
  unit_price: nonNegativeNumber,
  total_price: nonNegativeNumber,
  created_at: optionalTimestamp,
});

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------

export type MarketplaceListingSchema = z.infer<typeof marketplaceListingSchema>;
export type MarketplaceListingInsert = z.infer<typeof marketplaceListingInsertSchema>;
export type MarketplaceOrderSchema = z.infer<typeof marketplaceOrderSchema>;
export type MarketplaceOrderItemSchema = z.infer<typeof marketplaceOrderItemSchema>;
