/**
 * CRM Client & Support Zod schemas
 */

import { z } from 'zod';
import {
  uuidSchema,
  optionalTimestamp,
  jsonSchema,
  nonNegativeNumber,
} from '@/lib/schemas/common';

// ---------------------------------------------------------------------------
// CRM Client
// ---------------------------------------------------------------------------

export const crmClientSchema = z.object({
  id: uuidSchema,
  account_id: uuidSchema,
  name: z.string().min(1).max(200),
  email: z.string().email().nullable().optional(),
  phone: z.string().nullable().optional(),
  status: z.string().nullable().optional(),
  open_balance: nonNegativeNumber.nullable().optional(),
  notified_about_menu_update: z.boolean().nullable().optional(),
  portal_last_login: z.string().nullable().optional(),
  portal_password_hash: z.string().nullable().optional(),
  deleted_at: z.string().nullable().optional(),
  created_at: optionalTimestamp,
  updated_at: optionalTimestamp,
});

export const crmClientInsertSchema = crmClientSchema
  .omit({ id: true, created_at: true, updated_at: true, deleted_at: true, open_balance: true, portal_password_hash: true })
  .partial()
  .required({ account_id: true, name: true });

// ---------------------------------------------------------------------------
// Support Ticket
// ---------------------------------------------------------------------------

export const supportTicketSchema = z.object({
  id: uuidSchema,
  account_id: uuidSchema,
  tenant_id: uuidSchema.nullable().optional(),
  ticket_number: z.string().min(1),
  subject: z.string().min(1).max(200),
  description: z.string().min(1).max(5000),
  category: z.string().nullable().optional(),
  priority: z.string().nullable().optional(),
  status: z.string().nullable().optional(),
  user_id: uuidSchema.nullable().optional(),
  assigned_to: uuidSchema.nullable().optional(),
  metadata: jsonSchema,
  resolved_at: z.string().nullable().optional(),
  created_at: optionalTimestamp,
  updated_at: optionalTimestamp,
});

export const supportTicketInsertSchema = supportTicketSchema
  .omit({ id: true, created_at: true, updated_at: true, resolved_at: true })
  .partial()
  .required({ account_id: true, ticket_number: true, subject: true, description: true });

// ---------------------------------------------------------------------------
// Appointment
// ---------------------------------------------------------------------------

export const appointmentSchema = z.object({
  id: uuidSchema,
  account_id: uuidSchema,
  customer_id: uuidSchema,
  appointment_type: z.string().min(1),
  scheduled_at: z.string(),
  duration_minutes: z.number().int().positive().nullable().optional(),
  status: z.string().nullable().optional(),
  location_id: uuidSchema.nullable().optional(),
  staff_member_id: uuidSchema.nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  reminder_sent_at: z.string().nullable().optional(),
  created_at: optionalTimestamp,
  updated_at: optionalTimestamp,
});

export const appointmentInsertSchema = appointmentSchema
  .omit({ id: true, created_at: true, updated_at: true, reminder_sent_at: true })
  .partial()
  .required({ account_id: true, customer_id: true, appointment_type: true, scheduled_at: true });

// ---------------------------------------------------------------------------
// Coupon Code
// ---------------------------------------------------------------------------

export const couponCodeSchema = z.object({
  id: uuidSchema,
  code: z.string().min(1).max(50),
  description: z.string().max(500).nullable().optional(),
  discount_type: z.string().min(1),
  discount_value: z.number().positive(),
  min_purchase: nonNegativeNumber.nullable().optional(),
  max_discount: nonNegativeNumber.nullable().optional(),
  start_date: z.string().nullable().optional(),
  end_date: z.string().nullable().optional(),
  never_expires: z.boolean().nullable().optional(),
  total_usage_limit: z.number().int().positive().nullable().optional(),
  per_user_limit: z.number().int().positive().nullable().optional(),
  used_count: z.number().int().min(0).nullable().optional(),
  auto_apply: z.boolean().nullable().optional(),
  status: z.string().nullable().optional(),
  created_by: uuidSchema.nullable().optional(),
  created_at: optionalTimestamp,
  updated_at: optionalTimestamp,
});

export const couponCodeInsertSchema = couponCodeSchema
  .omit({ id: true, created_at: true, updated_at: true, used_count: true })
  .partial()
  .required({ code: true, discount_type: true, discount_value: true });

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------

export type CrmClientSchema = z.infer<typeof crmClientSchema>;
export type CrmClientInsert = z.infer<typeof crmClientInsertSchema>;
export type SupportTicketSchema = z.infer<typeof supportTicketSchema>;
export type AppointmentSchema = z.infer<typeof appointmentSchema>;
export type CouponCodeSchema = z.infer<typeof couponCodeSchema>;
