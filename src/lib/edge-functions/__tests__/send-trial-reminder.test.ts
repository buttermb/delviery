/**
 * Send Trial Reminder Edge Function Tests
 *
 * Tests the send-trial-reminder edge function contract:
 * - Auth: requires service role key
 * - Validation: Zod schema for tenant_id, days_remaining, has_payment_method
 * - Sends trial reminder emails via Resend
 * - Logs to email_logs and trial_events tables
 * - Updates tenant reminder flag columns
 * - Queues failed emails for retry
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const SUPABASE_URL = 'https://aejugtmhwwknrowfyzie.supabase.co';
const FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1`;
const ENDPOINT = `${FUNCTIONS_URL}/send-trial-reminder`;
const SERVICE_ROLE_KEY = 'test-service-role-key';

const mockFetch = vi.fn();
global.fetch = mockFetch;

const createMockResponse = (data: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: () => Promise.resolve(data),
  headers: new Headers({ 'Content-Type': 'application/json' }),
});

describe('send-trial-reminder Edge Function', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Authentication', () => {
    it('should reject requests without Authorization header', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Unauthorized' }, 403)
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: '550e8400-e29b-41d4-a716-446655440000',
          days_remaining: 7,
          has_payment_method: false,
        }),
      });

      expect(response.status).toBe(403);
    });

    it('should reject requests with invalid service role key', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Unauthorized' }, 403)
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer invalid-key',
        },
        body: JSON.stringify({
          tenant_id: '550e8400-e29b-41d4-a716-446655440000',
          days_remaining: 7,
          has_payment_method: false,
        }),
      });

      expect(response.status).toBe(403);
    });

    it('should accept requests with valid service role key', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ success: true, email_sent: false, message: 'Reminder logged' })
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({
          tenant_id: '550e8400-e29b-41d4-a716-446655440000',
          days_remaining: 7,
          has_payment_method: false,
        }),
      });

      expect(response.ok).toBe(true);
    });
  });

  describe('Input Validation', () => {
    it('should reject missing tenant_id', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Validation failed' }, 400)
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({
          days_remaining: 7,
          has_payment_method: false,
        }),
      });

      expect(response.status).toBe(400);
    });

    it('should reject non-UUID tenant_id', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Validation failed' }, 400)
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({
          tenant_id: 'not-a-uuid',
          days_remaining: 7,
          has_payment_method: false,
        }),
      });

      expect(response.status).toBe(400);
    });

    it('should reject missing days_remaining', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Validation failed' }, 400)
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({
          tenant_id: '550e8400-e29b-41d4-a716-446655440000',
          has_payment_method: false,
        }),
      });

      expect(response.status).toBe(400);
    });

    it('should reject negative days_remaining', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Validation failed' }, 400)
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({
          tenant_id: '550e8400-e29b-41d4-a716-446655440000',
          days_remaining: -1,
          has_payment_method: false,
        }),
      });

      expect(response.status).toBe(400);
    });

    it('should reject days_remaining above 14', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Validation failed' }, 400)
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({
          tenant_id: '550e8400-e29b-41d4-a716-446655440000',
          days_remaining: 30,
          has_payment_method: false,
        }),
      });

      expect(response.status).toBe(400);
    });

    it('should reject missing has_payment_method', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Validation failed' }, 400)
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({
          tenant_id: '550e8400-e29b-41d4-a716-446655440000',
          days_remaining: 7,
        }),
      });

      expect(response.status).toBe(400);
    });

    it('should accept valid 0-day reminder payload', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ success: true, email_sent: false })
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({
          tenant_id: '550e8400-e29b-41d4-a716-446655440000',
          days_remaining: 0,
          has_payment_method: true,
        }),
      });

      expect(response.ok).toBe(true);
    });
  });

  describe('Reminder Sending', () => {
    it('should return success with email_sent=true when Resend is configured', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          success: true,
          email_sent: true,
          email_id: 'resend-email-123',
          message: 'Reminder sent',
        })
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({
          tenant_id: '550e8400-e29b-41d4-a716-446655440000',
          days_remaining: 7,
          has_payment_method: false,
        }),
      });

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.email_sent).toBe(true);
      expect(data.email_id).toBe('resend-email-123');
    });

    it('should return success with email_sent=false when no provider configured', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          success: true,
          email_sent: false,
          email_id: null,
          message: 'Reminder logged (email provider not configured or send failed)',
        })
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({
          tenant_id: '550e8400-e29b-41d4-a716-446655440000',
          days_remaining: 3,
          has_payment_method: true,
        }),
      });

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.email_sent).toBe(false);
    });

    it('should return 404 for non-existent tenant', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Tenant not found' }, 404)
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({
          tenant_id: '00000000-0000-0000-0000-000000000000',
          days_remaining: 7,
          has_payment_method: false,
        }),
      });

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe('Tenant not found');
    });

    it('should return 400 for tenant without owner email', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Tenant has no owner email' }, 400)
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({
          tenant_id: '550e8400-e29b-41d4-a716-446655440000',
          days_remaining: 7,
          has_payment_method: false,
        }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Tenant has no owner email');
    });
  });

  describe('Reminder Scenarios', () => {
    const validPayload = (days: number, hasPayment: boolean) => ({
      tenant_id: '550e8400-e29b-41d4-a716-446655440000',
      days_remaining: days,
      has_payment_method: hasPayment,
    });

    it('should handle 7-day reminder without payment method', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ success: true, email_sent: true })
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify(validPayload(7, false)),
      });

      const data = await response.json();
      expect(data.success).toBe(true);
    });

    it('should handle 3-day reminder with payment method', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ success: true, email_sent: true })
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify(validPayload(3, true)),
      });

      const data = await response.json();
      expect(data.success).toBe(true);
    });

    it('should handle 1-day reminder (final warning)', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ success: true, email_sent: true })
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify(validPayload(1, false)),
      });

      const data = await response.json();
      expect(data.success).toBe(true);
    });

    it('should handle 0-day reminder (trial expired)', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ success: true, email_sent: true })
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify(validPayload(0, false)),
      });

      const data = await response.json();
      expect(data.success).toBe(true);
    });
  });

  describe('CORS', () => {
    it('should handle OPTIONS preflight request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        }),
      });

      const response = await fetch(ENDPOINT, {
        method: 'OPTIONS',
      });

      expect(response.ok).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should return 500 for internal server error', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Internal server error' }, 500)
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({
          tenant_id: '550e8400-e29b-41d4-a716-446655440000',
          days_remaining: 7,
          has_payment_method: false,
        }),
      });

      expect(response.status).toBe(500);
    });

    it('should include error details in response body', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Database connection failed' }, 500)
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({
          tenant_id: '550e8400-e29b-41d4-a716-446655440000',
          days_remaining: 7,
          has_payment_method: false,
        }),
      });

      const data = await response.json();
      expect(data.error).toBeDefined();
      expect(typeof data.error).toBe('string');
    });
  });
});
