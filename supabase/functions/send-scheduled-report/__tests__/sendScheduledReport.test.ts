/**
 * send-scheduled-report Edge Function Tests
 *
 * Verifies:
 * 1. Correct database column names (enabled, schedule_type, schedule_config)
 * 2. Input validation (schedule_id required, UUID format)
 * 3. CORS handling
 * 4. Proper type-safe data access
 * 5. calculateNextRun logic
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// ── Helpers ────────────────────────────────────────────────────────────────

function readSource(filename = 'index.ts'): string {
  const sourcePath = path.resolve(__dirname, '..', filename);
  return fs.readFileSync(sourcePath, 'utf-8');
}

// ── Index.ts Tests ─────────────────────────────────────────────────────────

describe('send-scheduled-report edge function', () => {
  const source = readSource();

  describe('imports and setup', () => {
    it('should import serve, createClient, corsHeaders from shared deps', () => {
      expect(source).toContain("import { serve, createClient, corsHeaders } from '../_shared/deps.ts'");
    });

    it('should import validation function and type', () => {
      expect(source).toContain("import { validateSendScheduledReport, type SendScheduledReportInput } from './validation.ts'");
    });
  });

  describe('CORS handling', () => {
    it('should handle OPTIONS preflight requests', () => {
      expect(source).toContain("req.method === 'OPTIONS'");
    });

    it('should return corsHeaders for OPTIONS requests', () => {
      expect(source).toContain('headers: corsHeaders');
    });

    it('should include corsHeaders in all responses', () => {
      const corsHeaderCount = (source.match(/corsHeaders/g) || []).length;
      // OPTIONS response + 404 + success + error = at least 4 uses
      expect(corsHeaderCount).toBeGreaterThanOrEqual(4);
    });
  });

  describe('database column names', () => {
    it('should use "enabled" column (not "is_active")', () => {
      expect(source).toContain(".eq('enabled', true)");
      expect(source).not.toContain("is_active");
    });

    it('should use "schedule_type" column (not "frequency")', () => {
      expect(source).toContain('schedule.schedule_type');
      expect(source).not.toMatch(/schedule\.frequency\b/);
    });

    it('should extract time_of_day from schedule_config JSONB (not direct column)', () => {
      expect(source).toContain('schedule.schedule_config');
      expect(source).toContain('time_of_day');
      expect(source).not.toMatch(/schedule\.time_of_day\b/);
    });

    it('should filter by tenant_id when fetching data', () => {
      expect(source).toContain(".eq('tenant_id', schedule.tenant_id)");
    });
  });

  describe('query construction', () => {
    it('should select scheduled report with custom_reports join', () => {
      expect(source).toContain(".from('scheduled_reports')");
      expect(source).toContain(".select('*, custom_reports(*)')");
    });

    it('should use maybeSingle() for optional data', () => {
      expect(source).toContain('.maybeSingle()');
    });

    it('should filter by schedule_id and enabled', () => {
      expect(source).toContain(".eq('id', schedule_id)");
      expect(source).toContain(".eq('enabled', true)");
    });

    it('should return 404 when schedule not found', () => {
      expect(source).toContain('status: 404');
      expect(source).toContain('Scheduled report not found or inactive');
    });
  });

  describe('type-safe data access', () => {
    it('should cast reportData values with proper typing', () => {
      // reportData should have typed arrays, not unknown
      expect(source).toContain('Record<string, Record<string, unknown>[]>');
    });

    it('should cast data sources and metrics arrays', () => {
      expect(source).toContain('as string[]');
    });

    it('should use nullish coalescing for safe array access', () => {
      expect(source).toContain('reportData.wholesale_orders ?? []');
      expect(source).toContain('reportData.wholesale_clients ?? []');
    });

    it('should safely cast reportConfig from custom_reports', () => {
      expect(source).toContain('as Record<string, unknown>');
    });
  });

  describe('date range calculation', () => {
    it('should handle daily schedule type', () => {
      expect(source).toContain("case 'daily':");
      expect(source).toContain('startDate.setDate(startDate.getDate() - 1)');
    });

    it('should handle weekly schedule type', () => {
      expect(source).toContain("case 'weekly':");
      expect(source).toContain('startDate.setDate(startDate.getDate() - 7)');
    });

    it('should handle monthly schedule type', () => {
      expect(source).toContain("case 'monthly':");
      expect(source).toContain('startDate.setMonth(startDate.getMonth() - 1)');
    });
  });

  describe('metric calculations', () => {
    it('should calculate total_revenue from wholesale_orders', () => {
      expect(source).toContain("case 'total_revenue':");
      expect(source).toContain('total_amount');
    });

    it('should calculate order_count from wholesale_orders', () => {
      expect(source).toContain("case 'order_count':");
    });

    it('should calculate customer_count from wholesale_clients', () => {
      expect(source).toContain("case 'customer_count':");
    });

    it('should default unknown metrics to 0', () => {
      expect(source).toContain('default:');
      expect(source).toContain('calculatedMetrics[metric] = 0');
    });
  });

  describe('schedule update', () => {
    it('should update last_run_at after generating report', () => {
      expect(source).toContain('last_run_at:');
    });

    it('should update next_run_at using calculateNextRun', () => {
      expect(source).toContain('next_run_at: calculateNextRun(');
    });

    it('should pass schedule_type and timeOfDay to calculateNextRun', () => {
      expect(source).toContain('calculateNextRun(schedule.schedule_type, timeOfDay)');
    });
  });

  describe('response format', () => {
    it('should return success with report details', () => {
      expect(source).toContain('success: true');
      expect(source).toContain('report_name:');
      expect(source).toContain('generated_at:');
      expect(source).toContain('metrics: calculatedMetrics');
      expect(source).toContain('recipients: schedule.recipients');
    });
  });

  describe('error handling', () => {
    it('should catch errors and return 400 with message', () => {
      expect(source).toContain('} catch (error)');
      expect(source).toContain('status: 400');
    });

    it('should extract message from Error instances', () => {
      expect(source).toContain('error instanceof Error ? error.message');
    });

    it('should provide fallback error message', () => {
      expect(source).toContain('Unknown error occurred');
    });

    it('should log data source fetch errors without crashing', () => {
      expect(source).toContain('Error fetching');
      expect(source).toContain('reportData[dataSource] = []');
    });
  });

  describe('calculateNextRun function', () => {
    it('should accept scheduleType and timeOfDay parameters', () => {
      expect(source).toContain('function calculateNextRun(scheduleType: string, timeOfDay: string)');
    });

    it('should default timeOfDay to 09:00 when empty', () => {
      expect(source).toContain("(timeOfDay || '09:00')");
    });

    it('should handle all three schedule types', () => {
      const fnBody = source.slice(source.indexOf('function calculateNextRun'));
      expect(fnBody).toContain("case 'daily':");
      expect(fnBody).toContain("case 'weekly':");
      expect(fnBody).toContain("case 'monthly':");
    });

    it('should advance daily to next day if time has passed', () => {
      const fnBody = source.slice(source.indexOf('function calculateNextRun'));
      expect(fnBody).toContain('if (nextRun <= now)');
      expect(fnBody).toContain('nextRun.setDate(nextRun.getDate() + 1)');
    });

    it('should return ISO string', () => {
      expect(source).toContain('return nextRun.toISOString()');
    });
  });
});

// ── Validation Tests ───────────────────────────────────────────────────────

describe('send-scheduled-report validation', () => {
  const validationSource = readSource('validation.ts');

  it('should require schedule_id as UUID', () => {
    expect(validationSource).toContain('schedule_id: z.string().uuid');
  });

  it('should have optional force boolean with default false', () => {
    expect(validationSource).toContain('force: z.boolean().optional().default(false)');
  });

  it('should have optional override_recipients as email array', () => {
    expect(validationSource).toContain('override_recipients: z.array(z.string().email()).optional()');
  });

  it('should export validation function', () => {
    expect(validationSource).toContain('export function validateSendScheduledReport');
  });

  it('should export type from schema', () => {
    expect(validationSource).toContain('export type SendScheduledReportInput');
  });
});
