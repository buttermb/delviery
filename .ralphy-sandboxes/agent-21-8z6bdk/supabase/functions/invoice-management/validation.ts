import { z } from '../_shared/deps.ts';

const invoiceLineItemSchema = z.object({
  product_id: z.string().uuid().optional(),
  description: z.string().min(1).max(500),
  quantity: z.number().positive().max(10000),
  unit_price: z.number().nonnegative().max(1000000),
  total: z.number().nonnegative().max(1000000),
});

const invoiceDataSchema = z.object({
  client_id: z.string().uuid().optional(),
  account_id: z.string().uuid().optional(),
  invoice_number: z.string().max(100).optional(),
  invoice_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  issue_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  line_items: z.array(invoiceLineItemSchema).optional(),
  status: z.enum(['draft', 'sent', 'paid', 'overdue', 'cancelled']).optional(),
  notes: z.string().max(2000).optional(),
  terms: z.string().max(2000).optional(),
  subtotal: z.number().nonnegative().max(1000000000).optional(),
  tax: z.number().nonnegative().max(1000000000).optional(),
  total: z.number().nonnegative().max(1000000000).optional(),
  amount_paid: z.number().nonnegative().max(1000000000).optional(),
  billing_period_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  billing_period_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  stripe_invoice_id: z.string().max(255).optional(),
  stripe_payment_intent_id: z.string().max(255).optional(),
});

export const invoiceManagementSchema = z.object({
  action: z.enum(['create', 'update', 'delete', 'get', 'list', 'send', 'mark_paid']),
  tenant_id: z.string().uuid().optional(),
  invoice_id: z.string().uuid().optional(),
  invoice_data: invoiceDataSchema.optional(),
});

export type InvoiceManagementInput = z.infer<typeof invoiceManagementSchema>;

export function validateInvoiceManagement(body: unknown): InvoiceManagementInput {
  return invoiceManagementSchema.parse(body);
}
