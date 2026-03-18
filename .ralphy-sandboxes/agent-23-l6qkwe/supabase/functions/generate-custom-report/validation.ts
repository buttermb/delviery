import { z } from '../_shared/deps.ts';

/**
 * Validation schema for the generate-custom-report edge function
 */
export const generateCustomReportSchema = z.object({
  reportId: z.string().uuid('Invalid report ID format'),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  format: z.enum(['json', 'csv', 'pdf']).optional().default('json'),
  filters: z.record(z.unknown()).optional().default({}),
});

export type GenerateCustomReportInput = z.infer<typeof generateCustomReportSchema>;

export function validateGenerateCustomReport(body: unknown): GenerateCustomReportInput {
  return generateCustomReportSchema.parse(body);
}

/**
 * Filter condition schema for report configuration
 */
export const filterConditionSchema = z.object({
  field: z.string(),
  operator: z.enum([
    'equals',
    'not_equals',
    'contains',
    'not_contains',
    'greater_than',
    'less_than',
    'greater_or_equal',
    'less_or_equal',
    'is_null',
    'is_not_null',
    'in',
    'not_in',
  ]),
  value: z.unknown(),
  data_source: z.string().optional(),
});

export type FilterCondition = z.infer<typeof filterConditionSchema>;

/**
 * Date range configuration schema
 */
export const dateRangeSchema = z.object({
  preset: z.enum([
    'today',
    'yesterday',
    'this_week',
    'last_week',
    'this_month',
    'last_month',
    'this_quarter',
    'last_quarter',
    'this_year',
    'last_year',
    'custom',
  ]).optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
});

export type DateRange = z.infer<typeof dateRangeSchema>;

/**
 * Report filters schema
 */
export const reportFiltersSchema = z.object({
  conditions: z.array(filterConditionSchema).optional().default([]),
  date_range: dateRangeSchema.optional(),
  selected_fields: z.array(z.string()).optional().default([]),
});

export type ReportFilters = z.infer<typeof reportFiltersSchema>;
