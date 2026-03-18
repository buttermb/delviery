/**
 * Customer, Profile & Address Zod schemas
 */

import { z } from 'zod';
import {
  uuidSchema,
  optionalTimestamp,
  emailSchema,
  phoneSchema,
  jsonSchema,
  nonNegativeNumber,
  optionalUrl,
} from '@/lib/schemas/common';

// ---------------------------------------------------------------------------
// Address
// ---------------------------------------------------------------------------

export const addressSchema = z.object({
  id: uuidSchema,
  user_id: uuidSchema.nullable().optional(),
  street: z.string().min(1).max(255),
  apartment: z.string().max(50).nullable().optional(),
  borough: z.string().min(1).max(100),
  city: z.string().min(1).max(100),
  state: z.string().min(1).max(50),
  zip_code: z.string().min(5).max(10),
  neighborhood: z.string().max(100).nullable().optional(),
  lat: z.number().nullable().optional(),
  lng: z.number().nullable().optional(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  coordinates: jsonSchema,
  is_default: z.boolean().nullable().optional(),
  verified: z.boolean().nullable().optional(),
  delivery_count: z.number().int().min(0).nullable().optional(),
  issue_count: z.number().int().min(0).nullable().optional(),
  risk_zone: z.string().nullable().optional(),
  created_at: optionalTimestamp,
});

export const addressInsertSchema = addressSchema
  .omit({ id: true, created_at: true, delivery_count: true, issue_count: true });

// ---------------------------------------------------------------------------
// Customer
// ---------------------------------------------------------------------------

export const customerSchema = z.object({
  id: uuidSchema,
  account_id: uuidSchema,
  first_name: z.string().min(1).max(100),
  last_name: z.string().min(1).max(100),
  email: z.string().email().max(255).nullable().optional(),
  phone: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  customer_type: z.string().nullable().optional(),
  business_name: z.string().nullable().optional(),
  date_of_birth: z.string().nullable().optional(),
  balance: nonNegativeNumber.nullable().optional(),
  loyalty_points: z.number().int().min(0).nullable().optional(),
  loyalty_tier: z.string().nullable().optional(),
  total_spent: nonNegativeNumber.nullable().optional(),
  total_orders: z.number().int().min(0).nullable().optional(),
  last_purchase_at: z.string().nullable().optional(),
  email_opt_in: z.boolean().nullable().optional(),
  marketing_opt_in: z.boolean().nullable().optional(),
  is_tax_exempt: z.boolean().nullable().optional(),
  deleted_at: z.string().nullable().optional(),

  // Medical fields
  medical_card_number: z.string().nullable().optional(),
  medical_card_expiration: z.string().nullable().optional(),
  medical_card_state: z.string().nullable().optional(),
  medical_card_photo_url: optionalUrl,

  // Preferences
  cbd_preference: z.string().nullable().optional(),
  flavor_preferences: z.array(z.string()).nullable().optional(),
  allergies: z.array(z.string()).nullable().optional(),

  // Caregiver
  caregiver_name: z.string().nullable().optional(),
  caregiver_phone: z.string().nullable().optional(),

  // Limits
  monthly_allotment_limit: z.number().nullable().optional(),

  // Encrypted fields (opaque)
  is_encrypted: z.boolean().nullable().optional(),
  encryption_metadata: jsonSchema,

  created_at: optionalTimestamp,
});

export const customerInsertSchema = customerSchema
  .omit({ id: true, created_at: true, deleted_at: true, balance: true, loyalty_points: true, total_spent: true, total_orders: true })
  .partial()
  .required({ first_name: true, last_name: true, account_id: true });

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

export const profileSchema = z.object({
  id: uuidSchema,
  user_id: uuidSchema,
  account_id: uuidSchema.nullable().optional(),
  first_name: z.string().max(100).nullable().optional(),
  last_name: z.string().max(100).nullable().optional(),
  full_name: z.string().max(200).nullable().optional(),
  phone: z.string().nullable().optional(),
  date_of_birth: z.string().nullable().optional(),

  // Verification
  age_verified: z.boolean().nullable().optional(),
  id_verified: z.boolean().nullable().optional(),
  selfie_verified: z.boolean().nullable().optional(),
  id_type: z.string().nullable().optional(),
  id_number: z.string().nullable().optional(),
  id_document_url: optionalUrl,
  id_expiry_date: z.string().nullable().optional(),
  verification_submitted_at: z.string().nullable().optional(),
  verification_approved_at: z.string().nullable().optional(),
  verification_rejected_at: z.string().nullable().optional(),
  verification_rejection_reason: z.string().nullable().optional(),

  // Risk & status
  account_status: z.string().nullable().optional(),
  trust_level: z.string().nullable().optional(),
  risk_score: z.number().nullable().optional(),
  login_attempts: z.number().int().nullable().optional(),
  last_login_at: z.string().nullable().optional(),

  // Usage stats
  total_orders: z.number().int().min(0).nullable().optional(),
  total_spent: nonNegativeNumber.nullable().optional(),
  average_order_value: nonNegativeNumber.nullable().optional(),
  lifetime_value: nonNegativeNumber.nullable().optional(),
  cancelled_orders: z.number().int().min(0).nullable().optional(),
  chargebacks: z.number().int().min(0).nullable().optional(),
  failed_payments: z.number().int().min(0).nullable().optional(),
  reported_issues: z.number().int().min(0).nullable().optional(),
  last_order_date: z.string().nullable().optional(),

  // Limits
  daily_limit: z.number().nullable().optional(),
  weekly_limit: z.number().nullable().optional(),
  order_limit: z.number().nullable().optional(),

  // Misc
  marketing_opt_in: z.boolean().nullable().optional(),
  referral_code: z.string().nullable().optional(),
  user_id_code: z.string().nullable().optional(),
  name_change_count: z.number().int().nullable().optional(),
  created_at: optionalTimestamp,
});

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------

export type AddressSchema = z.infer<typeof addressSchema>;
export type AddressInsert = z.infer<typeof addressInsertSchema>;
export type CustomerSchema = z.infer<typeof customerSchema>;
export type CustomerInsert = z.infer<typeof customerInsertSchema>;
export type ProfileSchema = z.infer<typeof profileSchema>;
