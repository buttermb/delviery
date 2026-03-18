/**
 * Disposable Menu Zod schemas
 */

import { z } from 'zod';
import {
  uuidSchema,
  jsonSchema,
  menuStatusEnum,
  menuAccessTypeEnum,
} from '@/lib/schemas/common';

// ---------------------------------------------------------------------------
// Disposable Menu
// ---------------------------------------------------------------------------

export const disposableMenuSchema = z.object({
  id: uuidSchema,
  tenant_id: uuidSchema,
  name: z.string().min(1).max(200),
  title: z.string().max(200).nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
  business_name: z.string().nullable().optional(),
  custom_message: z.string().nullable().optional(),
  status: menuStatusEnum,

  // Access
  access_type: z.string().nullable().optional(),
  access_code: z.string().nullable().optional(),
  access_code_hash: z.string().min(1),
  access_code_rotation_days: z.number().int().positive().nullable().optional(),

  // Encryption
  encrypted_url_token: z.string().min(1),
  encryption_version: z.number().int(),
  is_encrypted: z.boolean(),
  encrypted_name: z.string().nullable().optional(),
  encrypted_description: z.string().nullable().optional(),
  encrypted_appearance_settings: z.string().nullable().optional(),
  encrypted_security_settings: z.string().nullable().optional(),
  encrypted_max_order_quantity: z.string().nullable().optional(),
  encrypted_min_order_quantity: z.string().nullable().optional(),

  // Settings
  appearance_settings: jsonSchema,
  appearance_style: z.string().nullable().optional(),
  security_settings: jsonSchema,
  notification_settings: jsonSchema,

  // Display options
  show_availability: z.boolean().nullable().optional(),
  show_contact_info: z.boolean().nullable().optional(),
  show_minimum_order: z.boolean().nullable().optional(),
  show_product_images: z.boolean().nullable().optional(),

  // Limits
  min_order_quantity: z.number().int().min(0).nullable().optional(),
  max_order_quantity: z.number().int().positive().nullable().optional(),
  view_limit_per_customer: z.number().int().positive().nullable().optional(),
  view_limit_period: z.string().nullable().optional(),

  // Burn
  auto_burn_hours: z.number().positive().nullable().optional(),
  burn_reason: z.string().nullable().optional(),
  burned_at: z.string().nullable().optional(),

  // Security
  device_locking_enabled: z.boolean().nullable().optional(),
  screenshot_protection_enabled: z.boolean().nullable().optional(),
  screenshot_watermark_enabled: z.boolean().nullable().optional(),

  // Expiration
  expiration_date: z.string().nullable().optional(),
  never_expires: z.boolean(),

  created_by: uuidSchema.nullable().optional(),
  created_at: z.string(),
});

export const disposableMenuInsertSchema = disposableMenuSchema
  .omit({ id: true, created_at: true, burned_at: true, burn_reason: true })
  .partial()
  .required({
    tenant_id: true,
    name: true,
    status: true,
    access_code_hash: true,
    encrypted_url_token: true,
    encryption_version: true,
    is_encrypted: true,
    never_expires: true,
  });

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------

export type DisposableMenuSchema = z.infer<typeof disposableMenuSchema>;
export type DisposableMenuInsert = z.infer<typeof disposableMenuInsertSchema>;
