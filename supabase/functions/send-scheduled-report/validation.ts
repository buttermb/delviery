import { z } from '../_shared/deps.ts';

export const sendScheduledReportSchema = z.object({
  schedule_id: z.string().uuid('Invalid schedule ID format'),
  force: z.boolean().optional().default(false),
});

export type SendScheduledReportInput = z.infer<typeof sendScheduledReportSchema>;

export function validateSendScheduledReport(body: unknown): SendScheduledReportInput {
  return sendScheduledReportSchema.parse(body);
}

/** Allowlisted tables that reports can query. Must match report_data_sources.source_table */
export const ALLOWED_DATA_SOURCES = new Set([
  'orders',
  'products',
  'customers',
  'wholesale_orders',
  'wholesale_clients',
  'wholesale_inventory',
  'pos_transactions',
  'pos_shifts',
  'marketplace_orders',
]);
