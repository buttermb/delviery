/**
 * Wholesale Client, Order & Inventory Zod schemas
 */

import { z } from 'zod';
import {
  uuidSchema,
  optionalTimestamp,
  jsonSchema,
  nonNegativeNumber,
} from '@/lib/schemas/common';

// ---------------------------------------------------------------------------
// Wholesale Client
// ---------------------------------------------------------------------------

export const wholesaleClientSchema = z.object({
  id: uuidSchema,
  tenant_id: uuidSchema,
  business_name: z.string().min(1).max(200),
  contact_name: z.string().min(1).max(200),
  email: z.string().email().max(255),
  phone: z.string().min(1),
  address: z.string().min(1),
  client_type: z.string().min(1),
  status: z.string().min(1),
  credit_limit: nonNegativeNumber,
  outstanding_balance: nonNegativeNumber,
  payment_terms: z.number().int().min(0),
  monthly_volume: nonNegativeNumber,
  reliability_score: z.number().min(0).max(100),
  is_tax_exempt: z.boolean().nullable().optional(),
  tax_exempt_certificate: z.string().nullable().optional(),
  license_expiration_date: z.string().nullable().optional(),
  license_status: z.string().nullable().optional(),
  license_alerts_sent: jsonSchema,
  last_order_date: z.string().nullable().optional(),
  last_payment_date: z.string().nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
  portal_token: z.string().nullable().optional(),
  coordinates: jsonSchema,
  version: z.number().int().nullable().optional(),
  deleted_at: z.string().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const wholesaleClientInsertSchema = wholesaleClientSchema
  .omit({
    id: true,
    created_at: true,
    updated_at: true,
    deleted_at: true,
    outstanding_balance: true,
    reliability_score: true,
    version: true,
    portal_token: true,
  })
  .partial()
  .required({
    tenant_id: true,
    business_name: true,
    contact_name: true,
    email: true,
    phone: true,
    address: true,
    client_type: true,
    status: true,
    credit_limit: true,
    payment_terms: true,
    monthly_volume: true,
  });

// ---------------------------------------------------------------------------
// Wholesale Order
// ---------------------------------------------------------------------------

export const wholesaleOrderSchema = z.object({
  id: uuidSchema,
  tenant_id: uuidSchema,
  client_id: uuidSchema,
  order_number: z.string().min(1),
  status: z.string().min(1),
  payment_status: z.string().min(1),
  total_amount: nonNegativeNumber,
  delivery_address: z.string(),
  delivery_notes: z.string().max(500).nullable().optional(),
  runner_id: uuidSchema.nullable().optional(),
  payment_due_date: z.string().nullable().optional(),
  assigned_at: z.string().nullable().optional(),
  confirmed_at: z.string().nullable().optional(),
  shipped_at: z.string().nullable().optional(),
  delivered_at: z.string().nullable().optional(),
  cancelled_at: z.string().nullable().optional(),
  orphaned_at: z.string().nullable().optional(),
  version: z.number().int().nullable().optional(),
  created_at: z.string(),
});

export const wholesaleOrderInsertSchema = wholesaleOrderSchema
  .omit({ id: true, created_at: true, version: true })
  .partial()
  .required({
    tenant_id: true,
    client_id: true,
    order_number: true,
    status: true,
    payment_status: true,
    total_amount: true,
    delivery_address: true,
  });

// ---------------------------------------------------------------------------
// Wholesale Inventory
// ---------------------------------------------------------------------------

export const wholesaleInventorySchema = z.object({
  id: uuidSchema,
  tenant_id: uuidSchema,
  product_name: z.string().min(1).max(200),
  category: z.string().min(1),
  strain_type: z.string().nullable().optional(),
  quantity_lbs: nonNegativeNumber,
  quantity_units: z.number().int().min(0),
  reorder_point: z.number().int().min(0),
  base_price: nonNegativeNumber.nullable().optional(),
  cost_per_lb: nonNegativeNumber.nullable().optional(),
  prices: jsonSchema,
  warehouse_location: z.string().min(1),
  image_url: z.string().nullable().optional(),
  images: z.array(z.string()).nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
  thc_percentage: z.number().min(0).max(100).nullable().optional(),
  cbd_percentage: z.number().min(0).max(100).nullable().optional(),
  terpenes: jsonSchema,
  effects: jsonSchema,
  flavors: jsonSchema,
  lineage: z.string().nullable().optional(),
  grow_info: z.string().nullable().optional(),
  last_restock_date: z.string().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const wholesaleInventoryInsertSchema = wholesaleInventorySchema
  .omit({ id: true, created_at: true, updated_at: true })
  .partial()
  .required({
    tenant_id: true,
    product_name: true,
    category: true,
    quantity_lbs: true,
    quantity_units: true,
    reorder_point: true,
    warehouse_location: true,
  });

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------

export type WholesaleClientSchema = z.infer<typeof wholesaleClientSchema>;
export type WholesaleClientInsert = z.infer<typeof wholesaleClientInsertSchema>;
export type WholesaleOrderSchema = z.infer<typeof wholesaleOrderSchema>;
export type WholesaleOrderInsert = z.infer<typeof wholesaleOrderInsertSchema>;
export type WholesaleInventorySchema = z.infer<typeof wholesaleInventorySchema>;
export type WholesaleInventoryInsert = z.infer<typeof wholesaleInventoryInsertSchema>;
