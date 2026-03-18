/**
 * Tenant, Account & Location Zod schemas
 */

import { z } from 'zod';
import {
  uuidSchema,
  optionalTimestamp,
  emailSchema,
  jsonSchema,
  nonNegativeNumber,
  optionalUrl,
} from '@/lib/schemas/common';

// ---------------------------------------------------------------------------
// Tenant
// ---------------------------------------------------------------------------

export const tenantSchema = z.object({
  id: uuidSchema,
  business_name: z.string().min(1).max(200),
  owner_name: z.string().min(1).max(200),
  owner_email: z.string().email().max(255),
  slug: z.string().min(1).max(100).nullable().optional(),
  status: z.string().nullable().optional(),
  business_tier: z.string().nullable().optional(),
  industry: z.string().nullable().optional(),
  company_size: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),

  // Subscription
  subscription_tier: z.string().nullable().optional(),
  subscription_status: z.string().nullable().optional(),
  stripe_customer_id: z.string().nullable().optional(),
  stripe_subscription_id: z.string().nullable().optional(),
  billing_cycle: z.string().nullable().optional(),
  is_free_tier: z.boolean().nullable().optional(),

  // Trial
  trial_ends_at: z.string().nullable().optional(),
  grace_period_ends_at: z.string().nullable().optional(),

  // Feature config
  features: jsonSchema,
  feature_toggles: jsonSchema,
  limits: jsonSchema,
  credits_enabled: z.boolean().nullable().optional(),

  // Onboarding
  onboarded: z.boolean().nullable().optional(),
  onboarding_completed: z.boolean().nullable().optional(),
  onboarding_completed_at: z.string().nullable().optional(),
  onboarding_skipped: z.boolean().nullable().optional(),
  demo_data_generated: z.boolean().nullable().optional(),
  payment_method_added: z.boolean().nullable().optional(),

  // Cancellation
  cancelled_at: z.string().nullable().optional(),
  cancellation_reason: z.string().nullable().optional(),
  cancellation_requested_at: z.string().nullable().optional(),
  cancellation_requested_by: z.string().nullable().optional(),
  cancellation_completed_at: z.string().nullable().optional(),

  // Metrics
  monthly_orders: z.number().int().nullable().optional(),
  monthly_revenue: nonNegativeNumber.nullable().optional(),
  mrr: nonNegativeNumber.nullable().optional(),
  compliance_verified: z.boolean().nullable().optional(),
  last_activity_at: z.string().nullable().optional(),
  detected_operation_size: z.string().nullable().optional(),
  last_size_detection_at: z.string().nullable().optional(),

  created_at: optionalTimestamp,
});

export const tenantInsertSchema = tenantSchema
  .omit({ id: true, created_at: true })
  .partial()
  .required({ business_name: true, owner_name: true, owner_email: true });

// ---------------------------------------------------------------------------
// Account
// ---------------------------------------------------------------------------

export const accountSchema = z.object({
  id: uuidSchema,
  company_name: z.string().min(1).max(200),
  slug: z.string().min(1).max(100),
  billing_email: z.string().email().nullable().optional(),
  status: z.string().nullable().optional(),
  plan_id: uuidSchema.nullable().optional(),
  tenant_id: uuidSchema.nullable().optional(),
  stripe_customer_id: z.string().nullable().optional(),
  stripe_subscription_id: z.string().nullable().optional(),
  trial_ends_at: z.string().nullable().optional(),
  metadata: jsonSchema,
  created_at: optionalTimestamp,
  updated_at: optionalTimestamp,
});

// ---------------------------------------------------------------------------
// Location
// ---------------------------------------------------------------------------

export const locationSchema = z.object({
  id: uuidSchema,
  account_id: uuidSchema,
  tenant_id: uuidSchema.nullable().optional(),
  name: z.string().min(1).max(200),
  address: z.string().min(1),
  city: z.string().max(100).nullable().optional(),
  state: z.string().max(50).nullable().optional(),
  zip_code: z.string().max(10).nullable().optional(),
  phone: z.string().nullable().optional(),
  email: z.string().email().nullable().optional(),
  license_number: z.string().nullable().optional(),
  coordinates: jsonSchema,
  operating_hours: jsonSchema,
  delivery_radius_miles: z.number().min(0).nullable().optional(),
  status: z.string().nullable().optional(),
  created_at: optionalTimestamp,
  updated_at: optionalTimestamp,
});

export const locationInsertSchema = locationSchema
  .omit({ id: true, created_at: true, updated_at: true })
  .partial()
  .required({ account_id: true, name: true, address: true });

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------

export type TenantSchema = z.infer<typeof tenantSchema>;
export type TenantInsert = z.infer<typeof tenantInsertSchema>;
export type AccountSchema = z.infer<typeof accountSchema>;
export type LocationSchema = z.infer<typeof locationSchema>;
export type LocationInsert = z.infer<typeof locationInsertSchema>;
