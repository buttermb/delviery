import { z } from '../_shared/deps.ts';

/** Allowed data types that map to real tables */
export const ALLOWED_DATA_TYPES = [
  'orders',
  'customers',
  'products',
  'inventory',
  'deliveries',
] as const;

/** Allowed export formats */
export const ALLOWED_FORMATS = ['csv', 'json', 'excel'] as const;

export const processDataExportSchema = z.object({
  exportId: z.string().uuid('Invalid export ID format'),
});

export type ProcessDataExportInput = z.infer<typeof processDataExportSchema>;

export function validateProcessDataExport(body: unknown): ProcessDataExportInput {
  return processDataExportSchema.parse(body);
}
