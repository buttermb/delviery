/**
 * Vendor & Supplier Zod schemas
 */

import { z } from 'zod';
import {
  uuidSchema,
  optionalTimestamp,
  jsonSchema,
  nonNegativeNumber,
} from '@/lib/schemas/common';

// ---------------------------------------------------------------------------
// Vendor
// ---------------------------------------------------------------------------

export const vendorSchema = z.object({
  id: uuidSchema,
  account_id: uuidSchema,
  name: z.string().min(1).max(200),
  contact_name: z.string().max(200).nullable().optional(),
  contact_email: z.string().email().nullable().optional(),
  contact_phone: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  state: z.string().nullable().optional(),
  zip_code: z.string().max(10).nullable().optional(),
  license_number: z.string().nullable().optional(),
  tax_id: z.string().nullable().optional(),
  payment_terms: z.string().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  status: z.string().nullable().optional(),
  created_at: optionalTimestamp,
  updated_at: optionalTimestamp,
});

export const vendorInsertSchema = vendorSchema
  .omit({ id: true, created_at: true, updated_at: true })
  .partial()
  .required({ account_id: true, name: true });

// ---------------------------------------------------------------------------
// Purchase Order
// ---------------------------------------------------------------------------

export const purchaseOrderSchema = z.object({
  id: uuidSchema,
  account_id: uuidSchema,
  vendor_id: uuidSchema,
  po_number: z.string().min(1),
  status: z.string().nullable().optional(),
  subtotal: nonNegativeNumber,
  tax: nonNegativeNumber.nullable().optional(),
  shipping: nonNegativeNumber.nullable().optional(),
  total: nonNegativeNumber,
  location_id: uuidSchema.nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  expected_delivery_date: z.string().nullable().optional(),
  received_date: z.string().nullable().optional(),
  created_by: uuidSchema.nullable().optional(),
  approved_by: uuidSchema.nullable().optional(),
  created_at: optionalTimestamp,
  updated_at: optionalTimestamp,
});

export const purchaseOrderInsertSchema = purchaseOrderSchema
  .omit({ id: true, created_at: true, updated_at: true })
  .partial()
  .required({ account_id: true, vendor_id: true, po_number: true, subtotal: true, total: true });

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------

export type VendorSchema = z.infer<typeof vendorSchema>;
export type VendorInsert = z.infer<typeof vendorInsertSchema>;
export type PurchaseOrderSchema = z.infer<typeof purchaseOrderSchema>;
export type PurchaseOrderInsert = z.infer<typeof purchaseOrderInsertSchema>;
