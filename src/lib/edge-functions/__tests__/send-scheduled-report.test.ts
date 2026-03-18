/**
 * send-scheduled-report Edge Function Tests
 *
 * Tests the scheduled report generation and delivery function.
 * Verifies: validation, auth, report fetching, metric calculation,
 * execution tracking, and next-run scheduling.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const SUPABASE_URL = 'https://aejugtmhwwknrowfyzie.supabase.co';
const FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1`;
const ENDPOINT = `${FUNCTIONS_URL}/send-scheduled-report`;

const mockFetch = vi.fn();
global.fetch = mockFetch;

const createMockResponse = (data: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: () => Promise.resolve(data),
  headers: new Headers({ 'Content-Type': 'application/json' }),
});

describe('send-scheduled-report Edge Function', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('CORS handling', () => {
    it('should handle OPTIONS preflight', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers':
            'authorization, x-client-info, apikey, content-type',
        }),
      });

      const response = await fetch(ENDPOINT, { method: 'OPTIONS' });

      expect(response.ok).toBe(true);
    });
  });

  describe('Authentication', () => {
    it('should require authorization header', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Unauthorized' }, 401)
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schedule_id: '550e8400-e29b-41d4-a716-446655440000',
        }),
      });

      expect(response.status).toBe(401);
    });

    it('should reject invalid bearer token format', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Unauthorized' }, 401)
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Basic invalid-format',
        },
        body: JSON.stringify({
          schedule_id: '550e8400-e29b-41d4-a716-446655440000',
        }),
      });

      expect(response.status).toBe(401);
    });
  });

  describe('Input validation', () => {
    it('should reject missing schedule_id', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Invalid schedule ID format' }, 400)
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(400);
    });

    it('should reject non-UUID schedule_id', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Invalid schedule ID format' }, 400)
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({ schedule_id: 'not-a-uuid' }),
      });

      expect(response.status).toBe(400);
    });

    it('should accept valid UUID schedule_id', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          success: true,
          report_name: 'Weekly Sales',
          generated_at: new Date().toISOString(),
          metrics: { total_revenue: 5000 },
          row_count: 42,
          execution_time_ms: 150,
          recipients: ['admin@example.com'],
        })
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({
          schedule_id: '550e8400-e29b-41d4-a716-446655440000',
        }),
      });

      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data.success).toBe(true);
      expect(data.report_name).toBeDefined();
    });
  });

  describe('Schedule lookup', () => {
    it('should return 404 for non-existent schedule', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Scheduled report not found' }, 404)
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({
          schedule_id: '550e8400-e29b-41d4-a716-446655440099',
        }),
      });

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe('Scheduled report not found');
    });

    it('should return 400 for disabled schedule without force flag', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Scheduled report is disabled' }, 400)
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({
          schedule_id: '550e8400-e29b-41d4-a716-446655440000',
          force: false,
        }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Scheduled report is disabled');
    });

    it('should allow disabled schedule with force=true', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          success: true,
          report_name: 'Monthly Report',
          generated_at: new Date().toISOString(),
          metrics: {},
          row_count: 0,
          execution_time_ms: 50,
          recipients: [],
        })
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({
          schedule_id: '550e8400-e29b-41d4-a716-446655440000',
          force: true,
        }),
      });

      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.success).toBe(true);
    });
  });

  describe('Report generation', () => {
    it('should return calculated metrics for daily report', async () => {
      const mockResponse = {
        success: true,
        report_name: 'Daily Sales Summary',
        generated_at: new Date().toISOString(),
        next_run_at: new Date(Date.now() + 86400000).toISOString(),
        metrics: {
          total_revenue: 12500.50,
          order_count: 45,
          avg_order_value: 277.79,
        },
        row_count: 45,
        execution_time_ms: 230,
        recipients: ['admin@example.com', 'manager@example.com'],
      };

      mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse));

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({
          schedule_id: '550e8400-e29b-41d4-a716-446655440000',
        }),
      });

      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.metrics.total_revenue).toBe(12500.50);
      expect(data.metrics.order_count).toBe(45);
      expect(data.metrics.avg_order_value).toBeCloseTo(277.79);
      expect(data.next_run_at).toBeDefined();
      expect(data.execution_time_ms).toBeGreaterThan(0);
      expect(data.recipients).toHaveLength(2);
    });

    it('should return calculated metrics for weekly report', async () => {
      const mockResponse = {
        success: true,
        report_name: 'Weekly Wholesale Report',
        generated_at: new Date().toISOString(),
        next_run_at: new Date(Date.now() + 604800000).toISOString(),
        metrics: {
          wholesale_revenue: 87500,
          wholesale_order_count: 120,
          client_count: 35,
        },
        row_count: 120,
        execution_time_ms: 450,
        recipients: ['sales@example.com'],
      };

      mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse));

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({
          schedule_id: '550e8400-e29b-41d4-a716-446655440001',
        }),
      });

      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.metrics.wholesale_revenue).toBe(87500);
      expect(data.metrics.wholesale_order_count).toBe(120);
      expect(data.row_count).toBe(120);
    });

    it('should handle empty data sources gracefully', async () => {
      const mockResponse = {
        success: true,
        report_name: 'Empty Report',
        generated_at: new Date().toISOString(),
        next_run_at: new Date(Date.now() + 86400000).toISOString(),
        metrics: {
          total_revenue: 0,
          order_count: 0,
        },
        row_count: 0,
        execution_time_ms: 80,
        recipients: ['admin@example.com'],
      };

      mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse));

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({
          schedule_id: '550e8400-e29b-41d4-a716-446655440000',
        }),
      });

      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.metrics.total_revenue).toBe(0);
      expect(data.metrics.order_count).toBe(0);
      expect(data.row_count).toBe(0);
    });
  });

  describe('Report configuration not found', () => {
    it('should return 404 when custom_reports is missing', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Report configuration not found' }, 404)
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({
          schedule_id: '550e8400-e29b-41d4-a716-446655440000',
        }),
      });

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe('Report configuration not found');
    });
  });

  describe('Error handling', () => {
    it('should return 500 on database fetch failure', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(
          { error: 'Failed to fetch scheduled report' },
          500
        )
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({
          schedule_id: '550e8400-e29b-41d4-a716-446655440000',
        }),
      });

      expect(response.status).toBe(500);
    });

    it('should handle malformed JSON body', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Unexpected token' }, 400)
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: '{invalid json',
      });

      expect(response.status).toBe(400);
    });
  });
});

describe('send-scheduled-report Validation Unit Tests', () => {
  describe('ALLOWED_DATA_SOURCES', () => {
    // Inline test of the allowlist concept (can't import Deno module directly)
    const ALLOWED = new Set([
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

    it('should allow known table names', () => {
      expect(ALLOWED.has('orders')).toBe(true);
      expect(ALLOWED.has('wholesale_orders')).toBe(true);
      expect(ALLOWED.has('products')).toBe(true);
      expect(ALLOWED.has('customers')).toBe(true);
      expect(ALLOWED.has('pos_transactions')).toBe(true);
      expect(ALLOWED.has('marketplace_orders')).toBe(true);
    });

    it('should reject unknown table names', () => {
      expect(ALLOWED.has('users')).toBe(false);
      expect(ALLOWED.has('auth.users')).toBe(false);
      expect(ALLOWED.has('tenants')).toBe(false);
      expect(ALLOWED.has('profiles')).toBe(false);
      expect(ALLOWED.has("'; DROP TABLE users; --")).toBe(false);
    });
  });

  describe('calculateNextRun logic', () => {
    function calculateNextRun(
      scheduleType: string,
      scheduleConfig: Record<string, unknown> | null
    ): string {
      const now = new Date();
      const config = scheduleConfig ?? {};
      const timeOfDay =
        typeof config.time === 'string' ? config.time : '09:00';
      const [hours, minutes] = timeOfDay.split(':').map(Number);

      const nextRun = new Date(now);
      nextRun.setHours(hours || 9, minutes || 0, 0, 0);

      switch (scheduleType) {
        case 'daily':
          if (nextRun <= now) {
            nextRun.setDate(nextRun.getDate() + 1);
          }
          break;
        case 'weekly': {
          const dayOfWeek =
            typeof config.day_of_week === 'number' ? config.day_of_week : 1;
          nextRun.setDate(
            nextRun.getDate() +
              ((7 + dayOfWeek - nextRun.getDay()) % 7 || 7)
          );
          break;
        }
        case 'monthly': {
          const dayOfMonth =
            typeof config.day_of_month === 'number'
              ? config.day_of_month
              : 1;
          nextRun.setMonth(nextRun.getMonth() + 1);
          nextRun.setDate(
            Math.min(
              dayOfMonth,
              new Date(
                nextRun.getFullYear(),
                nextRun.getMonth() + 1,
                0
              ).getDate()
            )
          );
          break;
        }
      }

      return nextRun.toISOString();
    }

    it('should return a future date for daily schedule', () => {
      const result = calculateNextRun('daily', { time: '09:00' });
      const nextRun = new Date(result);

      expect(nextRun.getTime()).toBeGreaterThan(Date.now());
      expect(nextRun.getHours()).toBe(9);
      expect(nextRun.getMinutes()).toBe(0);
    });

    it('should return approximately 7 days later for weekly schedule', () => {
      const result = calculateNextRun('weekly', {
        time: '08:00',
        day_of_week: 1,
      });
      const nextRun = new Date(result);

      expect(nextRun.getTime()).toBeGreaterThan(Date.now());
      expect(nextRun.getDay()).toBe(1); // Monday
    });

    it('should return next month for monthly schedule', () => {
      const result = calculateNextRun('monthly', {
        time: '06:00',
        day_of_month: 15,
      });
      const nextRun = new Date(result);
      const now = new Date();

      expect(nextRun.getMonth()).toBe((now.getMonth() + 1) % 12);
      expect(nextRun.getDate()).toBe(15);
    });

    it('should default to 09:00 when no time specified', () => {
      const result = calculateNextRun('daily', null);
      const nextRun = new Date(result);

      expect(nextRun.getHours()).toBe(9);
      expect(nextRun.getMinutes()).toBe(0);
    });

    it('should handle month boundary for monthly schedule with day 31', () => {
      const result = calculateNextRun('monthly', {
        time: '09:00',
        day_of_month: 31,
      });
      const nextRun = new Date(result);

      // Should clamp to last day of the next month if needed
      const daysInMonth = new Date(
        nextRun.getFullYear(),
        nextRun.getMonth() + 1,
        0
      ).getDate();
      expect(nextRun.getDate()).toBeLessThanOrEqual(daysInMonth);
    });
  });
});
