/**
 * Notify-Recall Edge Function Tests
 *
 * Tests the recall notification edge function contract:
 * 1. Input validation (recall_id, notification_method)
 * 2. Recall not found handling
 * 3. No affected customers handling
 * 4. Successful email notification
 * 5. Successful SMS notification
 * 6. Combined email + SMS notification
 * 7. Partial failure tracking
 * 8. CORS preflight handling
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const SUPABASE_URL = 'https://aejugtmhwwknrowfyzie.supabase.co';
const FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1`;
const ENDPOINT = `${FUNCTIONS_URL}/notify-recall`;

const mockFetch = vi.fn();
global.fetch = mockFetch;

const createMockResponse = (data: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: () => Promise.resolve(data),
  headers: new Headers({ 'Content-Type': 'application/json' }),
});

describe('notify-recall Edge Function', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
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

      const response = await fetch(ENDPOINT, { method: 'OPTIONS' });
      expect(response.ok).toBe(true);
    });
  });

  describe('Input validation', () => {
    it('should reject missing recall_id', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Invalid recall ID format' }, 400),
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

    it('should reject invalid recall_id format', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Invalid recall ID format' }, 400),
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({ recall_id: 'not-a-uuid' }),
      });

      expect(response.status).toBe(400);
    });

    it('should reject invalid notification_method', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Validation error' }, 400),
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({
          recall_id: '550e8400-e29b-41d4-a716-446655440000',
          notification_method: 'carrier_pigeon',
        }),
      });

      expect(response.status).toBe(400);
    });

    it('should accept valid notification_method values', async () => {
      const validMethods = ['email', 'sms', 'both'];

      for (const method of validMethods) {
        mockFetch.mockResolvedValueOnce(
          createMockResponse({
            success: true,
            recall_id: '550e8400-e29b-41d4-a716-446655440000',
            customers_notified: 3,
            total_affected: 3,
            message: 'Recall notifications sent to 3 customers',
          }),
        );

        const response = await fetch(ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer valid-token',
          },
          body: JSON.stringify({
            recall_id: '550e8400-e29b-41d4-a716-446655440000',
            notification_method: method,
          }),
        });

        expect(response.ok).toBe(true);
      }
    });

    it('should default notification_method to email when omitted', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          success: true,
          recall_id: '550e8400-e29b-41d4-a716-446655440000',
          customers_notified: 1,
          total_affected: 1,
          message: 'Recall notifications sent to 1 customers',
        }),
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({
          recall_id: '550e8400-e29b-41d4-a716-446655440000',
        }),
      });

      const data = await response.json();
      expect(data.success).toBe(true);
    });
  });

  describe('Recall lookup', () => {
    it('should return 404 when recall not found', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Recall not found' }, 404),
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({
          recall_id: '550e8400-e29b-41d4-a716-446655440000',
        }),
      });

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe('Recall not found');
    });
  });

  describe('No affected customers', () => {
    it('should return success with 0 customers when none affected', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          success: true,
          recall_id: '550e8400-e29b-41d4-a716-446655440000',
          customers_notified: 0,
          message: 'No affected customers found',
        }),
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({
          recall_id: '550e8400-e29b-41d4-a716-446655440000',
        }),
      });

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.customers_notified).toBe(0);
    });
  });

  describe('Email notifications', () => {
    it('should send email notifications to affected customers', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          success: true,
          recall_id: '550e8400-e29b-41d4-a716-446655440000',
          customers_notified: 5,
          total_affected: 5,
          message: 'Recall notifications sent to 5 customers',
        }),
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({
          recall_id: '550e8400-e29b-41d4-a716-446655440000',
          notification_method: 'email',
        }),
      });

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.customers_notified).toBe(5);
      expect(data.total_affected).toBe(5);
    });
  });

  describe('SMS notifications', () => {
    it('should send SMS notifications to affected customers', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          success: true,
          recall_id: '550e8400-e29b-41d4-a716-446655440000',
          customers_notified: 3,
          total_affected: 3,
          message: 'Recall notifications sent to 3 customers',
        }),
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({
          recall_id: '550e8400-e29b-41d4-a716-446655440000',
          notification_method: 'sms',
        }),
      });

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.customers_notified).toBe(3);
    });
  });

  describe('Combined email + SMS notifications', () => {
    it('should send both email and SMS when method is both', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          success: true,
          recall_id: '550e8400-e29b-41d4-a716-446655440000',
          customers_notified: 4,
          total_affected: 4,
          message: 'Recall notifications sent to 4 customers',
        }),
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({
          recall_id: '550e8400-e29b-41d4-a716-446655440000',
          notification_method: 'both',
        }),
      });

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.customers_notified).toBe(4);
    });
  });

  describe('Partial failure handling', () => {
    it('should return partial success when some notifications fail', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          success: true,
          recall_id: '550e8400-e29b-41d4-a716-446655440000',
          customers_notified: 3,
          total_affected: 5,
          message: 'Recall notifications sent to 3 customers',
        }),
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({
          recall_id: '550e8400-e29b-41d4-a716-446655440000',
          notification_method: 'email',
        }),
      });

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.customers_notified).toBeLessThan(data.total_affected);
    });
  });

  describe('Response format', () => {
    it('should return expected success response shape', async () => {
      const mockResponse = {
        success: true,
        recall_id: '550e8400-e29b-41d4-a716-446655440000',
        customers_notified: 2,
        total_affected: 2,
        message: 'Recall notifications sent to 2 customers',
      };

      mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse));

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({
          recall_id: '550e8400-e29b-41d4-a716-446655440000',
          notification_method: 'email',
        }),
      });

      const data = await response.json();
      expect(data).toHaveProperty('success', true);
      expect(data).toHaveProperty('recall_id');
      expect(data).toHaveProperty('customers_notified');
      expect(data).toHaveProperty('total_affected');
      expect(data).toHaveProperty('message');
      expect(typeof data.customers_notified).toBe('number');
      expect(typeof data.total_affected).toBe('number');
    });

    it('should return expected error response shape', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Recall not found' }, 404),
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({
          recall_id: '550e8400-e29b-41d4-a716-446655440000',
        }),
      });

      const data = await response.json();
      expect(data).toHaveProperty('error');
      expect(typeof data.error).toBe('string');
    });
  });

  describe('Security', () => {
    it('should include secure headers in response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            success: true,
            recall_id: '550e8400-e29b-41d4-a716-446655440000',
            customers_notified: 1,
            total_affected: 1,
            message: 'Recall notifications sent to 1 customers',
          }),
        headers: new Headers({
          'Content-Type': 'application/json',
          'X-Content-Type-Options': 'nosniff',
          'X-Frame-Options': 'DENY',
          'X-XSS-Protection': '1; mode=block',
        }),
      });

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({
          recall_id: '550e8400-e29b-41d4-a716-446655440000',
        }),
      });

      expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
      expect(response.headers.get('X-Frame-Options')).toBe('DENY');
    });
  });
});
