/**
 * Common/shared Zod schemas and primitives
 *
 * Reusable building blocks for entity schemas.
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

export const uuidSchema = z.string().uuid();
export const timestampSchema = z.string().datetime({ offset: true }).or(z.string().datetime());
export const optionalTimestamp = timestampSchema.nullable().optional();
export const jsonSchema: z.ZodType<Record<string, unknown> | unknown[] | null> = z
  .union([z.record(z.unknown()), z.array(z.unknown()), z.null()])
  .nullable()
  .optional() as z.ZodType<Record<string, unknown> | unknown[] | null>;

export const emailSchema = z.string().email().max(255);
export const phoneSchema = z
  .string()
  .min(1, 'Phone number is required')
  .refine((val) => {
    let digits = val.replace(/\D/g, '');
    if (digits.length === 11 && digits.startsWith('1')) digits = digits.slice(1);
    return digits.length === 10;
  }, 'Please enter a valid 10-digit US phone number');

export const urlSchema = z.string().url();
export const optionalUrl = urlSchema.optional().nullable().or(z.literal(''));
export const nonEmptyString = z.string().min(1).max(255);
export const positiveNumber = z.number().positive();
export const nonNegativeNumber = z.number().nonnegative();
export const positiveInt = z.number().int().positive();
export const nonNegativeInt = z.number().int().nonnegative();
export const hexColorSchema = z.string().regex(/^#[0-9A-Fa-f]{6}$/);

// ---------------------------------------------------------------------------
// Database enums (mirrors Database["public"]["Enums"])
// ---------------------------------------------------------------------------

export const adminRoleEnum = z.enum(['super_admin', 'admin', 'compliance_officer', 'support']);

export const appRoleEnum = z.enum([
  'admin',
  'courier',
  'user',
  'super_admin',
  'owner',
  'member',
  'viewer',
]);

export const burnTypeEnum = z.enum(['soft', 'hard']);
export const eventSeverityEnum = z.enum(['low', 'medium', 'high', 'critical']);
export const menuAccessTypeEnum = z.enum(['invite_only', 'shared_link', 'hybrid']);

export const menuOrderStatusEnum = z.enum([
  'pending',
  'confirmed',
  'rejected',
  'processing',
  'preparing',
  'ready_for_pickup',
  'in_transit',
  'completed',
  'cancelled',
  'delivered',
]);

export const menuStatusEnum = z.enum(['active', 'soft_burned', 'hard_burned']);

export const orderStatusEnum = z.enum([
  'pending',
  'accepted',
  'preparing',
  'out_for_delivery',
  'delivered',
  'cancelled',
]);

export const paymentMethodEnum = z.enum(['cash', 'crypto']);
export const paymentStatusEnum = z.enum(['pending', 'completed', 'failed', 'refunded']);
export const posTransactionStatusEnum = z.enum(['completed', 'voided', 'refunded', 'pending']);

export const productCategoryEnum = z.enum([
  'flower',
  'edibles',
  'vapes',
  'concentrates',
  'pre-rolls',
]);

export const securityEventTypeEnum = z.enum([
  'failed_access_code',
  'geofence_violation',
  'screenshot_attempt',
  'new_device_detected',
  'excessive_views',
  'suspicious_ip',
  'link_sharing_detected',
]);

export const vehicleTypeEnum = z.enum(['car', 'bike', 'scooter', 'ebike']);
export const verificationMethodEnum = z.enum(['jumio', 'manual_scan', 'automatic']);

// ---------------------------------------------------------------------------
// Convenience types
// ---------------------------------------------------------------------------

export type AdminRole = z.infer<typeof adminRoleEnum>;
export type AppRole = z.infer<typeof appRoleEnum>;
export type OrderStatus = z.infer<typeof orderStatusEnum>;
export type PaymentMethod = z.infer<typeof paymentMethodEnum>;
export type PaymentStatus = z.infer<typeof paymentStatusEnum>;
export type ProductCategory = z.infer<typeof productCategoryEnum>;
export type MenuStatus = z.infer<typeof menuStatusEnum>;
export type MenuOrderStatus = z.infer<typeof menuOrderStatusEnum>;
export type VehicleType = z.infer<typeof vehicleTypeEnum>;
