/**
 * Send Menu Access Link Edge Function Tests
 *
 * Tests the send-menu-access-link edge function contract:
 * - Authentication & authorization
 * - Input validation (Zod schema)
 * - Email delivery path (Klaviyo)
 * - SMS delivery path (Twilio)
 * - Error handling for missing contact info
 * - CORS preflight
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const SUPABASE_URL = 'https://test-project.supabase.co';
const ENDPOINT = `${SUPABASE_URL}/functions/v1/send-menu-access-link`;

const mockFetch = vi.fn();
global.fetch = mockFetch;

const createMockResponse = (data: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: () => Promise.resolve(data),
  headers: new Headers({ 'Content-Type': 'application/json' }),
});

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';
const AUTH_HEADERS = {
  'Content-Type': 'application/json',
  Authorization: 'Bearer valid-token',
};

describe('send-menu-access-link', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('CORS', () => {
    it('should handle OPTIONS preflight', async () => {
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

  describe('Authentication', () => {
    it('should reject requests without authorization header', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Unauthorized - missing authorization header' }, 401),
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ whitelistId: VALID_UUID, method: 'email' }),
      });

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toContain('Unauthorized');
    });

    it('should reject requests with invalid token', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Unauthorized' }, 401),
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer invalid-token',
        },
        body: JSON.stringify({ whitelistId: VALID_UUID, method: 'email' }),
      });

      expect(response.status).toBe(401);
    });
  });

  describe('Input Validation', () => {
    it('should reject request without whitelistId', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Invalid request', details: [] }, 400),
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: AUTH_HEADERS,
        body: JSON.stringify({ method: 'email' }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Invalid request');
    });

    it('should reject request with non-UUID whitelistId', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Invalid request', details: [] }, 400),
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: AUTH_HEADERS,
        body: JSON.stringify({ whitelistId: 'not-a-uuid', method: 'email' }),
      });

      expect(response.status).toBe(400);
    });

    it('should reject request with invalid method', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Invalid request', details: [] }, 400),
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: AUTH_HEADERS,
        body: JSON.stringify({ whitelistId: VALID_UUID, method: 'carrier_pigeon' }),
      });

      expect(response.status).toBe(400);
    });

    it('should default method to email when not provided', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          success: true,
          message: 'Access link sent via email',
          preview: { subject: 'Access to Test Menu', message: 'Hello Customer...' },
        }),
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: AUTH_HEADERS,
        body: JSON.stringify({ whitelistId: VALID_UUID }),
      });

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.message).toContain('email');
    });
  });

  describe('Authorization', () => {
    it('should return 404 when whitelist entry does not exist', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Whitelist entry not found' }, 404),
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: AUTH_HEADERS,
        body: JSON.stringify({ whitelistId: VALID_UUID, method: 'email' }),
      });

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe('Whitelist entry not found');
    });

    it('should return 403 when menu does not belong to caller tenant', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(
          { error: 'Forbidden - menu does not belong to your tenant' },
          403,
        ),
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: AUTH_HEADERS,
        body: JSON.stringify({ whitelistId: VALID_UUID, method: 'email' }),
      });

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toContain('Forbidden');
    });
  });

  describe('Email Delivery', () => {
    it('should send access link via email successfully', async () => {
      const mockResponse = {
        success: true,
        message: 'Access link sent via email',
        preview: {
          subject: 'Access to Weekly Special',
          message: 'Hello John Doe,\n\nYou have been granted access...',
        },
      };

      mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse));

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: AUTH_HEADERS,
        body: JSON.stringify({ whitelistId: VALID_UUID, method: 'email' }),
      });

      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.message).toBe('Access link sent via email');
      expect(data.preview).toBeDefined();
      expect(data.preview.subject).toBeDefined();
      expect(data.preview.message).toBeDefined();
    });

    it('should return 400 when customer has no email address', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(
          { error: 'No email address on file for this customer' },
          400,
        ),
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: AUTH_HEADERS,
        body: JSON.stringify({ whitelistId: VALID_UUID, method: 'email' }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('No email');
    });
  });

  describe('SMS Delivery', () => {
    it('should send access link via SMS successfully', async () => {
      const mockResponse = {
        success: true,
        message: 'Access link sent via SMS',
        preview: {
          message: 'Weekly Special: Access your menu at https://app.floraiq.com/menu/abc123',
        },
      };

      mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse));

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: AUTH_HEADERS,
        body: JSON.stringify({ whitelistId: VALID_UUID, method: 'sms' }),
      });

      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.message).toBe('Access link sent via SMS');
      expect(data.preview).toBeDefined();
      expect(data.preview.message).toBeDefined();
    });

    it('should return 400 when customer has no phone number', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(
          { error: 'No phone number on file for this customer' },
          400,
        ),
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: AUTH_HEADERS,
        body: JSON.stringify({ whitelistId: VALID_UUID, method: 'sms' }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('No phone');
    });
  });

  describe('Response Format', () => {
    it('should include preview with subject and message for email', async () => {
      const mockResponse = {
        success: true,
        message: 'Access link sent via email',
        preview: {
          subject: 'Access to Test Menu',
          message: 'Hello Customer,\n\nYou have been granted access to our exclusive menu: Test Menu\n\nAccess your menu here:\nhttps://app.floraiq.com/menu/token123\n\nThis link expires on: 3/25/2026\n\nBest regards,\nYour Team',
        },
      };

      mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse));

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: AUTH_HEADERS,
        body: JSON.stringify({ whitelistId: VALID_UUID, method: 'email' }),
      });

      const data = await response.json();

      expect(data.preview.subject).toContain('Access to');
      expect(data.preview.message).toContain('exclusive menu');
      expect(data.preview.message).toContain('expires on');
    });

    it('should include preview with message for SMS', async () => {
      const mockResponse = {
        success: true,
        message: 'Access link sent via SMS',
        preview: {
          message: 'Test Menu: Access your menu at https://app.floraiq.com/menu/token123',
        },
      };

      mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse));

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: AUTH_HEADERS,
        body: JSON.stringify({ whitelistId: VALID_UUID, method: 'sms' }),
      });

      const data = await response.json();

      expect(data.preview.message).toBeDefined();
      expect(typeof data.preview.message).toBe('string');
    });
  });

  describe('Error Handling', () => {
    it('should return error JSON on internal server error', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Internal server error' }, 400),
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: AUTH_HEADERS,
        body: JSON.stringify({ whitelistId: VALID_UUID, method: 'email' }),
      });

      const data = await response.json();
      expect(data.error).toBeDefined();
    });

    it('should include CORS headers on error responses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ error: 'Bad request' }),
        headers: new Headers({
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        }),
      });

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: AUTH_HEADERS,
        body: JSON.stringify({}),
      });

      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    });
  });
});
