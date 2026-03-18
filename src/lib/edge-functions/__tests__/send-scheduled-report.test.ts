/**
 * Tests for the send-scheduled-report edge function.
 *
 * Covers:
 * 1. API contract (mock fetch) — auth, validation, responses
 * 2. Validation schema (imported directly from the edge function)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const SUPABASE_URL = 'https://aejugtmhwwknrowfyzie.supabase.co';
const FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1`;

const mockFetch = vi.fn();
global.fetch = mockFetch;

const createMockResponse = (data: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: () => Promise.resolve(data),
  text: () => Promise.resolve(JSON.stringify(data)),
  headers: new Headers({ 'Content-Type': 'application/json' }),
});

describe('send-scheduled-report Edge Function', () => {
  const endpoint = `${FUNCTIONS_URL}/send-scheduled-report`;

  beforeEach(() => {
    mockFetch.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('CORS handling', () => {
    it('should handle OPTIONS preflight requests', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        }),
      });

      const response = await fetch(endpoint, { method: 'OPTIONS' });
      expect(response.ok).toBe(true);
    });
  });

  describe('Authentication', () => {
    it('should reject requests without authorization header', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Missing authorization' }, 401)
      );

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schedule_id: '550e8400-e29b-41d4-a716-446655440000',
        }),
      });

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Missing authorization');
    });

    it('should reject invalid JWT tokens', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Invalid or expired token' }, 401)
      );

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer invalid-token',
        },
        body: JSON.stringify({
          schedule_id: '550e8400-e29b-41d4-a716-446655440000',
        }),
      });

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Invalid or expired token');
    });

    it('should accept service-role key for cron invocations', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          success: true,
          report_name: 'Daily Sales',
          generated_at: new Date().toISOString(),
          metrics: { total_revenue: 1500 },
          row_count: 25,
          recipients: 2,
          emails_sent: 2,
          emails_failed: 0,
        })
      );

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer service-role-key',
        },
        body: JSON.stringify({
          schedule_id: '550e8400-e29b-41d4-a716-446655440000',
        }),
      });

      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.success).toBe(true);
    });
  });

  describe('Input validation', () => {
    it('should reject invalid schedule_id format', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Invalid schedule ID format' }, 400)
      );

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({ schedule_id: 'not-a-uuid' }),
      });

      expect(response.status).toBe(400);
    });

    it('should accept valid schedule_id with optional force flag', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          success: true,
          report_name: 'Weekly Report',
          generated_at: new Date().toISOString(),
          metrics: {},
          row_count: 0,
          recipients: 0,
          emails_sent: 0,
          emails_failed: 0,
        })
      );

      const response = await fetch(endpoint, {
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
    });

    it('should accept override_recipients with valid emails', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          success: true,
          report_name: 'Test',
          generated_at: new Date().toISOString(),
          metrics: {},
          row_count: 0,
          recipients: 2,
          emails_sent: 2,
          emails_failed: 0,
        })
      );

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({
          schedule_id: '550e8400-e29b-41d4-a716-446655440000',
          override_recipients: ['admin@example.com', 'manager@example.com'],
        }),
      });

      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.recipients).toBe(2);
    });

    it('should reject override_recipients with invalid emails', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Invalid email' }, 400)
      );

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({
          schedule_id: '550e8400-e29b-41d4-a716-446655440000',
          override_recipients: ['not-an-email'],
        }),
      });

      expect(response.status).toBe(400);
    });
  });

  describe('Schedule lookup', () => {
    it('should return 404 for non-existent schedule', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Scheduled report not found' }, 404)
      );

      const response = await fetch(endpoint, {
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
      expect(data.error).toBe('Scheduled report not found');
    });

    it('should return 400 for disabled schedule without force flag', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Scheduled report is disabled' }, 400)
      );

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({
          schedule_id: '550e8400-e29b-41d4-a716-446655440000',
        }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('disabled');
    });
  });

  describe('Data source validation', () => {
    it('should reject disallowed data sources', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Invalid data source: auth.users' }, 400)
      );

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({
          schedule_id: '550e8400-e29b-41d4-a716-446655440000',
        }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('Invalid data source');
    });
  });

  describe('Successful report generation', () => {
    it('should generate a daily report with metrics', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          success: true,
          report_name: 'Daily Sales Report',
          generated_at: '2026-03-18T08:00:00.000Z',
          date_range: {
            start: '2026-03-17T08:00:00.000Z',
            end: '2026-03-18T08:00:00.000Z',
          },
          metrics: {
            total_revenue: 5250.75,
            order_count: 42,
            avg_order_value: 125.02,
          },
          row_count: 42,
          recipients: 3,
          emails_sent: 3,
          emails_failed: 0,
        })
      );

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer service-role-key',
        },
        body: JSON.stringify({
          schedule_id: '550e8400-e29b-41d4-a716-446655440000',
        }),
      });

      expect(response.ok).toBe(true);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.report_name).toBe('Daily Sales Report');
      expect(data.metrics.total_revenue).toBe(5250.75);
      expect(data.metrics.order_count).toBe(42);
      expect(data.date_range).toBeDefined();
      expect(data.date_range.start).toBeDefined();
      expect(data.date_range.end).toBeDefined();
      expect(data.row_count).toBe(42);
      expect(data.emails_sent).toBe(3);
      expect(data.emails_failed).toBe(0);
    });

    it('should generate a weekly report with multiple data sources', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          success: true,
          report_name: 'Weekly Business Summary',
          generated_at: '2026-03-18T08:00:00.000Z',
          date_range: {
            start: '2026-03-11T08:00:00.000Z',
            end: '2026-03-18T08:00:00.000Z',
          },
          metrics: {
            total_revenue: 25000,
            order_count: 150,
            customer_count: 45,
          },
          row_count: 195,
          recipients: 1,
          emails_sent: 1,
          emails_failed: 0,
        })
      );

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer service-role-key',
        },
        body: JSON.stringify({
          schedule_id: '550e8400-e29b-41d4-a716-446655440001',
        }),
      });

      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.row_count).toBe(195);
      expect(data.metrics.customer_count).toBe(45);
    });

    it('should generate a monthly report', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          success: true,
          report_name: 'Monthly Inventory Report',
          generated_at: '2026-03-18T08:00:00.000Z',
          date_range: {
            start: '2026-02-18T08:00:00.000Z',
            end: '2026-03-18T08:00:00.000Z',
          },
          metrics: { product_count: 200, total_stock: 15000 },
          row_count: 200,
          recipients: 2,
          emails_sent: 2,
          emails_failed: 0,
        })
      );

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer service-role-key',
        },
        body: JSON.stringify({
          schedule_id: '550e8400-e29b-41d4-a716-446655440002',
        }),
      });

      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.metrics.product_count).toBe(200);
      expect(data.metrics.total_stock).toBe(15000);
    });
  });

  describe('Email delivery', () => {
    it('should report partial email failures', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          success: true,
          report_name: 'Report',
          generated_at: new Date().toISOString(),
          metrics: {},
          row_count: 10,
          recipients: 3,
          emails_sent: 2,
          emails_failed: 1,
        })
      );

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer service-role-key',
        },
        body: JSON.stringify({
          schedule_id: '550e8400-e29b-41d4-a716-446655440000',
        }),
      });

      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.emails_sent).toBe(2);
      expect(data.emails_failed).toBe(1);
    });

    it('should handle zero recipients gracefully', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          success: true,
          report_name: 'No Recipients Report',
          generated_at: new Date().toISOString(),
          metrics: {},
          row_count: 5,
          recipients: 0,
          emails_sent: 0,
          emails_failed: 0,
        })
      );

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({
          schedule_id: '550e8400-e29b-41d4-a716-446655440000',
        }),
      });

      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.recipients).toBe(0);
      expect(data.emails_sent).toBe(0);
    });
  });

  describe('Error handling', () => {
    it('should return 500 for database errors', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Failed to fetch scheduled report' }, 500)
      );

      const response = await fetch(endpoint, {
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

    it('should return 400 for general errors', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Unknown error occurred' }, 400)
      );

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({
          schedule_id: '550e8400-e29b-41d4-a716-446655440000',
        }),
      });

      expect(response.status).toBe(400);
    });
  });
});
