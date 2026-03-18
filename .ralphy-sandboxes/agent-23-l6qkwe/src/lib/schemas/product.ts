/**
 * Product & Catalog Zod schemas
 */

import { z } from 'zod';
import {
  uuidSchema,
  optionalTimestamp,
  jsonSchema,
  productCategoryEnum,
  nonNegativeNumber,
  optionalUrl,
} from '@/lib/schemas/common';

// ---------------------------------------------------------------------------
// Product
// ---------------------------------------------------------------------------

export const productSchema = z.object({
  id: uuidSchema,
  name: z.string().min(1).max(200),
  description: z.string().max(2000).nullable().optional(),
  price: z.number().min(0).max(999999),
  wholesale_price: z.number().min(0).max(999999).nullable().optional(),
  retail_price: z.number().min(0).max(999999).nullable().optional(),
  sale_price: z.number().min(0).max(999999).nullable().optional(),
  cost_per_unit: z.number().min(0).nullable().optional(),
  price_per_lb: z.number().min(0).nullable().optional(),
  prices: jsonSchema,
  category: z.string(),
  category_id: uuidSchema.nullable().optional(),
  sku: z.string().max(100).nullable().optional(),
  barcode: z.string().nullable().optional(),
  batch_number: z.string().nullable().optional(),
  stock_quantity: z.number().int().min(0).nullable().optional(),
  available_quantity: z.number().int().min(0).nullable().optional(),
  reserved_quantity: z.number().int().min(0).nullable().optional(),
  total_quantity: z.number().int().min(0).nullable().optional(),
  fronted_quantity: z.number().int().min(0).nullable().optional(),
  low_stock_alert: z.number().int().min(0).nullable().optional(),
  in_stock: z.boolean().nullable().optional(),
  image_url: optionalUrl,
  images: z.array(z.string()).nullable().optional(),
  menu_visibility: z.boolean(),
  merchant_id: uuidSchema.nullable().optional(),
  tenant_id: uuidSchema.nullable().optional(),
  vendor_name: z.string().max(100).nullable().optional(),
  strain_name: z.string().max(100).nullable().optional(),
  strain_type: z.string().nullable().optional(),
  strain_info: z.string().nullable().optional(),
  strain_lineage: z.string().nullable().optional(),
  thc_content: z.number().min(0).max(100).nullable().optional(),
  thc_percent: z.number().min(0).max(100).nullable().optional(),
  thca_percentage: z.number().min(0).max(100),
  cbd_content: z.number().min(0).max(100).nullable().optional(),
  cbd_percent: z.number().min(0).max(100).nullable().optional(),
  terpenes: jsonSchema,
  effects: z.array(z.string()).nullable().optional(),
  effects_timeline: jsonSchema,
  medical_benefits: z.array(z.string()).nullable().optional(),
  consumption_methods: z.array(z.string()).nullable().optional(),
  is_concentrate: z.boolean().nullable().optional(),
  weight_grams: z.number().min(0).nullable().optional(),
  growing_info: jsonSchema,
  usage_tips: z.string().nullable().optional(),
  lab_name: z.string().nullable().optional(),
  lab_results_url: optionalUrl,
  coa_url: optionalUrl,
  coa_pdf_url: optionalUrl,
  coa_qr_code_url: optionalUrl,
  test_date: z.string().nullable().optional(),
  average_rating: z.number().min(0).max(5).nullable().optional(),
  review_count: z.number().int().min(0).nullable().optional(),
  version: z.number().int().nullable().optional(),
  created_at: optionalTimestamp,
});

/** Schema for creating a new product (form input) */
export const productInsertSchema = productSchema
  .omit({ id: true, created_at: true, average_rating: true, review_count: true, version: true })
  .partial()
  .required({ name: true, price: true, category: true, thca_percentage: true, menu_visibility: true });

/** Schema for updating a product */
export const productUpdateSchema = productSchema.partial();

// ---------------------------------------------------------------------------
// Category
// ---------------------------------------------------------------------------

export const categorySchema = z.object({
  id: uuidSchema,
  name: z.string().min(1).max(100),
  description: z.string().max(500).nullable().optional(),
  parent_id: uuidSchema.nullable().optional(),
  tenant_id: uuidSchema,
  created_at: optionalTimestamp,
  updated_at: optionalTimestamp,
});

export const categoryInsertSchema = categorySchema
  .omit({ id: true, created_at: true, updated_at: true });

// ---------------------------------------------------------------------------
// Review
// ---------------------------------------------------------------------------

export const reviewSchema = z.object({
  id: uuidSchema,
  product_id: uuidSchema,
  user_id: uuidSchema,
  order_id: uuidSchema.nullable().optional(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(2000).nullable().optional(),
  photo_urls: z.array(z.string()).nullable().optional(),
  created_at: optionalTimestamp,
});

export const reviewInsertSchema = reviewSchema
  .omit({ id: true, created_at: true });

// ---------------------------------------------------------------------------
// Inventory
// ---------------------------------------------------------------------------

export const inventorySchema = z.object({
  id: uuidSchema,
  merchant_id: uuidSchema,
  product_id: uuidSchema,
  stock: z.number().int().min(0).nullable().optional(),
  updated_at: optionalTimestamp,
});

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------

export type ProductSchema = z.infer<typeof productSchema>;
export type ProductInsert = z.infer<typeof productInsertSchema>;
export type ProductUpdate = z.infer<typeof productUpdateSchema>;
export type CategorySchema = z.infer<typeof categorySchema>;
export type ReviewSchema = z.infer<typeof reviewSchema>;
export type InventorySchema = z.infer<typeof inventorySchema>;
