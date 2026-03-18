/**
 * Invoice & Payment Zod schemas
 */

import { z } from 'zod';
import {
  uuidSchema,
  optionalTimestamp,
  jsonSchema,
  nonNegativeNumber,
} from '@/lib/schemas/common';

// ---------------------------------------------------------------------------
// Invoice (platform-level)
// ---------------------------------------------------------------------------

export const invoiceSchema = z.object({
  id: uuidSchema,
  tenant_id: uuidSchema,
  client_id: uuidSchema.nullable().optional(),
  invoice_number: z.string().min(1),
  issue_date: z.string(),
  due_date: z.string(),
  subtotal: nonNegativeNumber,
  tax: nonNegativeNumber.nullable().optional(),
  total: nonNegativeNumber,
  amount_due: nonNegativeNumber,
  amount_paid: nonNegativeNumber.nullable().optional(),
  status: z.string().nullable().optional(),
  line_items: jsonSchema,
  billing_period_start: z.string().nullable().optional(),
  billing_period_end: z.string().nullable().optional(),
  paid_at: z.string().nullable().optional(),
  stripe_invoice_id: z.string().nullable().optional(),
  stripe_payment_intent_id: z.string().nullable().optional(),
  created_at: optionalTimestamp,
  updated_at: optionalTimestamp,
});

export const invoiceInsertSchema = invoiceSchema
  .omit({ id: true, created_at: true, updated_at: true, amount_paid: true, paid_at: true })
  .partial()
  .required({ tenant_id: true, invoice_number: true, issue_date: true, due_date: true, subtotal: true, total: true, amount_due: true });

// ---------------------------------------------------------------------------
// CRM Invoice
// ---------------------------------------------------------------------------

export const crmInvoiceSchema = z.object({
  id: uuidSchema,
  account_id: uuidSchema,
  client_id: uuidSchema,
  invoice_number: z.string().min(1),
  invoice_date: z.string(),
  due_date: z.string(),
  subtotal: nonNegativeNumber,
  tax_amount: nonNegativeNumber.nullable().optional(),
  tax_rate: z.number().min(0).max(100).nullable().optional(),
  total: nonNegativeNumber,
  amount_paid: nonNegativeNumber.nullable().optional(),
  status: z.string().nullable().optional(),
  line_items: jsonSchema,
  payment_history: jsonSchema,
  public_token: z.string().min(1),
  public_view_count: z.number().int().min(0).nullable().optional(),
  last_viewed_at: z.string().nullable().optional(),
  paid_at: z.string().nullable().optional(),
  is_recurring: z.boolean().nullable().optional(),
  recurring_schedule_id: uuidSchema.nullable().optional(),
  template_id: uuidSchema.nullable().optional(),
  credit_memo_id: uuidSchema.nullable().optional(),
  created_from_pre_order_id: uuidSchema.nullable().optional(),
  overpayment_amount: nonNegativeNumber.nullable().optional(),
  created_at: optionalTimestamp,
  updated_at: optionalTimestamp,
});

export const crmInvoiceInsertSchema = crmInvoiceSchema
  .omit({ id: true, created_at: true, updated_at: true, amount_paid: true, paid_at: true, public_view_count: true })
  .partial()
  .required({ account_id: true, client_id: true, invoice_number: true, invoice_date: true, due_date: true, subtotal: true, total: true, public_token: true });

// ---------------------------------------------------------------------------
// CRM Pre-Order
// ---------------------------------------------------------------------------

export const crmPreOrderSchema = z.object({
  id: uuidSchema,
  account_id: uuidSchema,
  client_id: uuidSchema,
  pre_order_number: z.string().min(1),
  status: z.string().nullable().optional(),
  line_items: jsonSchema,
  subtotal: nonNegativeNumber,
  tax: nonNegativeNumber.nullable().optional(),
  total: nonNegativeNumber,
  converted_at: z.string().nullable().optional(),
  converted_to_invoice_id: uuidSchema.nullable().optional(),
  created_at: optionalTimestamp,
  updated_at: optionalTimestamp,
});

export const crmPreOrderInsertSchema = crmPreOrderSchema
  .omit({ id: true, created_at: true, updated_at: true, converted_at: true, converted_to_invoice_id: true })
  .partial()
  .required({ account_id: true, client_id: true, pre_order_number: true, subtotal: true, total: true });

// ---------------------------------------------------------------------------
// POS Transaction
// ---------------------------------------------------------------------------

export const posTransactionSchema = z.object({
  id: uuidSchema,
  tenant_id: uuidSchema,
  transaction_number: z.string().min(1),
  receipt_number: z.string().nullable().optional(),
  shift_id: uuidSchema.nullable().optional(),
  cashier_id: uuidSchema.nullable().optional(),
  cashier_name: z.string().nullable().optional(),
  terminal_id: z.string().nullable().optional(),
  customer_name: z.string().nullable().optional(),
  customer_email: z.string().email().nullable().optional(),
  customer_phone: z.string().nullable().optional(),
  items: jsonSchema,
  subtotal: nonNegativeNumber,
  tax_amount: nonNegativeNumber.nullable().optional(),
  discount_amount: nonNegativeNumber.nullable().optional(),
  total_amount: nonNegativeNumber,
  payment_method: z.string().min(1),
  payment_status: z.string().min(1),
  notes: z.string().nullable().optional(),
  voided_at: z.string().nullable().optional(),
  voided_by: z.string().nullable().optional(),
  void_reason: z.string().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------

export type InvoiceSchema = z.infer<typeof invoiceSchema>;
export type InvoiceInsert = z.infer<typeof invoiceInsertSchema>;
export type CrmInvoiceSchema = z.infer<typeof crmInvoiceSchema>;
export type CrmPreOrderSchema = z.infer<typeof crmPreOrderSchema>;
export type PosTransactionSchema = z.infer<typeof posTransactionSchema>;
