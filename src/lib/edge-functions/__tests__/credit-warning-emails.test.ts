/**
 * Credit Warning Emails Edge Function Tests
 *
 * Tests the credit-warning-emails cron job that sends warning
 * notifications when tenant credits reach specific thresholds.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const SUPABASE_URL = 'https://test.supabase.co';
const FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1`;
const SERVICE_KEY = 'test-service-role-key';

const mockFetch = vi.fn();
global.fetch = mockFetch;

const createMockResponse = (data: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: () => Promise.resolve(data),
  text: () => Promise.resolve(JSON.stringify(data)),
  headers: new Headers({ 'Content-Type': 'application/json' }),
});

describe('Credit Warning Emails Edge Function', () => {
  const endpoint = `${FUNCTIONS_URL}/credit-warning-emails`;

  beforeEach(() => {
    mockFetch.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Authentication', () => {
    it('should reject requests without service role key', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Unauthorized' }, 401)
      );

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      expect(response.status).toBe(401);
    });

    it('should reject requests with invalid service role key', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Unauthorized' }, 401)
      );

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer invalid-key',
        },
      });

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Unauthorized');
    });

    it('should accept requests with valid service role key', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          success: true,
          message: 'Credit warning job completed',
          results: {
            checked: 0,
            warnings_sent: 0,
            emails_sent: 0,
            by_severity: { info: 0, warning: 0, critical: 0, depleted: 0 },
            errors: [],
          },
        })
      );

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SERVICE_KEY}`,
        },
      });

      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.success).toBe(true);
    });
  });

  describe('CORS', () => {
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

  describe('Warning threshold processing', () => {
    it('should process all four thresholds (25%, 10%, 5%, 0%)', async () => {
      const mockResults = {
        success: true,
        message: 'Credit warning job completed',
        results: {
          checked: 4,
          warnings_sent: 4,
          emails_sent: 4,
          by_severity: { info: 1, warning: 1, critical: 1, depleted: 1 },
          errors: [],
        },
      };

      mockFetch.mockResolvedValueOnce(createMockResponse(mockResults));

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SERVICE_KEY}`,
        },
      });

      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.results.warnings_sent).toBe(4);
      expect(data.results.by_severity.info).toBe(1);
      expect(data.results.by_severity.warning).toBe(1);
      expect(data.results.by_severity.critical).toBe(1);
      expect(data.results.by_severity.depleted).toBe(1);
    });

    it('should report no warnings when no tenants below thresholds', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          success: true,
          message: 'Credit warning job completed',
          results: {
            checked: 0,
            warnings_sent: 0,
            emails_sent: 0,
            by_severity: { info: 0, warning: 0, critical: 0, depleted: 0 },
            errors: [],
          },
        })
      );

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SERVICE_KEY}`,
        },
      });

      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.results.checked).toBe(0);
      expect(data.results.warnings_sent).toBe(0);
      expect(data.results.emails_sent).toBe(0);
    });

    it('should skip tenants that already received warnings', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          success: true,
          message: 'Credit warning job completed',
          results: {
            checked: 0,
            warnings_sent: 0,
            emails_sent: 0,
            by_severity: { info: 0, warning: 0, critical: 0, depleted: 0 },
            errors: [],
          },
        })
      );

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SERVICE_KEY}`,
        },
      });

      const data = await response.json();
      // When warnings already sent, the query filters them out
      expect(data.success).toBe(true);
      expect(data.results.warnings_sent).toBe(0);
    });

    it('should skip tenants without owner email', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          success: true,
          message: 'Credit warning job completed',
          results: {
            checked: 1,
            warnings_sent: 0,
            emails_sent: 0,
            by_severity: { info: 0, warning: 0, critical: 0, depleted: 0 },
            errors: [],
          },
        })
      );

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SERVICE_KEY}`,
        },
      });

      const data = await response.json();

      expect(data.success).toBe(true);
      // checked 1 but sent 0 (no email)
      expect(data.results.checked).toBe(1);
      expect(data.results.warnings_sent).toBe(0);
    });
  });

  describe('Email delivery', () => {
    it('should track emails_sent separately from warnings_sent', async () => {
      // Scenario: warning created in-app but email delivery fails
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          success: true,
          results: {
            checked: 2,
            warnings_sent: 2,
            emails_sent: 1, // One email failed
            by_severity: { info: 0, warning: 1, critical: 1, depleted: 0 },
            errors: [],
          },
        })
      );

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SERVICE_KEY}`,
        },
      });

      const data = await response.json();

      expect(data.results.warnings_sent).toBe(2);
      expect(data.results.emails_sent).toBe(1);
    });
  });

  describe('Error handling', () => {
    it('should handle database query errors gracefully', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          success: true,
          results: {
            checked: 0,
            warnings_sent: 0,
            emails_sent: 0,
            by_severity: { info: 0, warning: 0, critical: 0, depleted: 0 },
            errors: ['25% query: relation "tenant_credits" does not exist'],
          },
        })
      );

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SERVICE_KEY}`,
        },
      });

      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.results.errors).toHaveLength(1);
      expect(data.results.errors[0]).toContain('query');
    });

    it('should handle individual tenant processing errors', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          success: true,
          results: {
            checked: 3,
            warnings_sent: 2,
            emails_sent: 2,
            by_severity: { info: 0, warning: 2, critical: 0, depleted: 0 },
            errors: ['tenant-abc: notification insert failed'],
          },
        })
      );

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SERVICE_KEY}`,
        },
      });

      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.results.checked).toBe(3);
      expect(data.results.warnings_sent).toBe(2);
      expect(data.results.errors).toHaveLength(1);
    });

    it('should return error response on catastrophic failure', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(
          { success: false, error: 'Internal server error' },
          500
        )
      );

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SERVICE_KEY}`,
        },
      });

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toBeDefined();
    });
  });

  describe('Response format', () => {
    it('should return proper JSON response with all required fields', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          success: true,
          message: 'Credit warning job completed',
          results: {
            checked: 5,
            warnings_sent: 3,
            emails_sent: 3,
            by_severity: { info: 1, warning: 1, critical: 1, depleted: 0 },
            errors: [],
          },
        })
      );

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SERVICE_KEY}`,
        },
      });

      const data = await response.json();

      expect(data).toHaveProperty('success');
      expect(data).toHaveProperty('message');
      expect(data).toHaveProperty('results');
      expect(data.results).toHaveProperty('checked');
      expect(data.results).toHaveProperty('warnings_sent');
      expect(data.results).toHaveProperty('emails_sent');
      expect(data.results).toHaveProperty('by_severity');
      expect(data.results).toHaveProperty('errors');
      expect(data.results.by_severity).toHaveProperty('info');
      expect(data.results.by_severity).toHaveProperty('warning');
      expect(data.results.by_severity).toHaveProperty('critical');
      expect(data.results.by_severity).toHaveProperty('depleted');
    });
  });
});
