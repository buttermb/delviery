import { z } from '../_shared/deps.ts';

export const generateCustomReportSchema = z.object({
  reportId: z.string().uuid('Invalid report ID format'),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  format: z.enum(['json', 'csv', 'pdf']).optional().default('json'),
  filters: z.record(z.unknown()).optional().default({}),
});

export type GenerateCustomReportInput = z.infer<typeof generateCustomReportSchema>;

export function validateGenerateCustomReport(body: unknown): GenerateCustomReportInput {
  return generateCustomReportSchema.parse(body);
}
