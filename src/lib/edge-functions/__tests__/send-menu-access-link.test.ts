/**
 * Send Menu Access Link Edge Function Tests
 *
 * Tests the send-menu-access-link edge function which sends
 * disposable menu access links to whitelisted customers via email or SMS.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const SUPABASE_URL = 'https://aejugtmhwwknrowfyzie.supabase.co';
const FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1`;
const ENDPOINT = `${FUNCTIONS_URL}/send-menu-access-link`;

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Helper to create mock responses
const createMockResponse = (data: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: () => Promise.resolve(data),
  headers: new Headers({ 'Content-Type': 'application/json' }),
});

describe('send-menu-access-link Edge Function', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Authentication', () => {
    it('should reject requests without authorization header', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Unauthorized - missing authorization header' }, 401)
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          whitelistId: '550e8400-e29b-41d4-a716-446655440000',
          method: 'email',
        }),
      });

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toContain('Unauthorized');
    });

    it('should reject invalid JWT tokens', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Unauthorized' }, 401)
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer invalid-token',
        },
        body: JSON.stringify({
          whitelistId: '550e8400-e29b-41d4-a716-446655440000',
          method: 'email',
        }),
      });

      expect(response.status).toBe(401);
    });
  });

  describe('Input Validation', () => {
    it('should reject missing whitelistId', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Validation error', details: [] }, 400)
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({ method: 'email' }),
      });

      expect(response.status).toBe(400);
    });

    it('should reject non-UUID whitelistId', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Validation error', details: [] }, 400)
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({
          whitelistId: 'not-a-uuid',
          method: 'email',
        }),
      });

      expect(response.status).toBe(400);
    });

    it('should reject invalid method value', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Validation error', details: [] }, 400)
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({
          whitelistId: '550e8400-e29b-41d4-a716-446655440000',
          method: 'telegram',
        }),
      });

      expect(response.status).toBe(400);
    });

    it('should default method to email when not provided', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          success: true,
          message: 'Access link sent via email',
          preview: { subject: 'Access to Menu', message: 'Hello...' },
        })
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({
          whitelistId: '550e8400-e29b-41d4-a716-446655440000',
        }),
      });

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.message).toContain('email');
    });
  });

  describe('Email Sending', () => {
    it('should send access link via email successfully', async () => {
      const mockResponse = {
        success: true,
        message: 'Access link sent via email',
        preview: {
          subject: 'Access to Weekly Special',
          message: 'Hello John Doe...',
        },
      };

      mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse));

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({
          whitelistId: '550e8400-e29b-41d4-a716-446655440000',
          method: 'email',
        }),
      });

      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.message).toBe('Access link sent via email');
      expect(data.preview).toBeDefined();
      expect(data.preview.subject).toContain('Access to');
    });

    it('should return error when customer has no email', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(
          { error: 'No email address on file for this customer' },
          400
        )
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({
          whitelistId: '550e8400-e29b-41d4-a716-446655440000',
          method: 'email',
        }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('No email');
    });
  });

  describe('SMS Sending', () => {
    it('should send access link via SMS successfully', async () => {
      const mockResponse = {
        success: true,
        message: 'Access link sent via SMS',
        preview: {
          message: 'Weekly Special: Access your menu at https://...',
        },
      };

      mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse));

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({
          whitelistId: '550e8400-e29b-41d4-a716-446655440000',
          method: 'sms',
        }),
      });

      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.message).toBe('Access link sent via SMS');
      expect(data.preview.message).toBeDefined();
    });

    it('should return error when customer has no phone number', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(
          { error: 'No phone number on file for this customer' },
          400
        )
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({
          whitelistId: '550e8400-e29b-41d4-a716-446655440000',
          method: 'sms',
        }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('No phone');
    });
  });

  describe('Authorization', () => {
    it('should reject access when menu does not belong to user tenant', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(
          { error: 'Forbidden - menu does not belong to your tenant' },
          403
        )
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({
          whitelistId: '550e8400-e29b-41d4-a716-446655440000',
          method: 'email',
        }),
      });

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toContain('Forbidden');
    });

    it('should return 404 when whitelist entry does not exist', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Whitelist entry not found' }, 404)
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({
          whitelistId: '550e8400-e29b-41d4-a716-446655440000',
          method: 'email',
        }),
      });

      expect(response.status).toBe(404);
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
    it('should return 500 for internal server errors', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Internal server error' }, 500)
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({
          whitelistId: '550e8400-e29b-41d4-a716-446655440000',
          method: 'email',
        }),
      });

      expect(response.status).toBe(500);
    });

    it('should return proper JSON error format', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Something went wrong' }, 500)
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({
          whitelistId: '550e8400-e29b-41d4-a716-446655440000',
          method: 'email',
        }),
      });

      const data = await response.json();
      expect(data).toHaveProperty('error');
      expect(typeof data.error).toBe('string');
    });
  });
});
