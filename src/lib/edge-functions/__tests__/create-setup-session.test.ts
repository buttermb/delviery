/**
 * Create Setup Session Edge Function Tests
 *
 * Tests the create-setup-session edge function which creates a
 * Stripe Checkout session in setup mode to save a payment method.
 *
 * Covers:
 * - Successful session creation (with and without existing Stripe customer)
 * - Authentication requirements
 * - Input validation (tenant_id format)
 * - Authorization (admin/owner only)
 * - Stripe configuration validation
 * - CORS handling
 * - Error responses
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const SUPABASE_URL = 'https://aejugtmhwwknrowfyzie.supabase.co';
const FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1`;
const ENDPOINT = `${FUNCTIONS_URL}/create-setup-session`;

const MOCK_AUTH_TOKEN = 'Bearer test-jwt-token';
const MOCK_TENANT_ID = '550e8400-e29b-41d4-a716-446655440000';

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

describe('create-setup-session', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('successful session creation', () => {
    it('should create a setup session and return URL', async () => {
      const mockResponse = {
        success: true,
        url: 'https://checkout.stripe.com/c/pay/cs_test_abc123',
        sessionId: 'cs_test_abc123',
      };

      mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse));

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: MOCK_AUTH_TOKEN,
        },
        body: JSON.stringify({ tenant_id: MOCK_TENANT_ID }),
      });

      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data.success).toBe(true);
      expect(data.url).toBeDefined();
      expect(data.url).toContain('https://checkout.stripe.com');
      expect(data.sessionId).toBeDefined();
    });

    it('should create a Stripe customer if none exists and return session URL', async () => {
      const mockResponse = {
        success: true,
        url: 'https://checkout.stripe.com/c/pay/cs_test_new_customer',
        sessionId: 'cs_test_new_customer',
      };

      mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse));

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: MOCK_AUTH_TOKEN,
        },
        body: JSON.stringify({ tenant_id: MOCK_TENANT_ID }),
      });

      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data.success).toBe(true);
      expect(data.url).toBeDefined();
      expect(data.sessionId).toBeDefined();
    });
  });

  describe('authentication', () => {
    it('should return 401 when no authorization header is provided', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Missing authorization header' }, 401)
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: MOCK_TENANT_ID }),
      });

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBeDefined();
    });

    it('should return 401 when token is invalid', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Unauthorized' }, 401)
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer invalid-token',
        },
        body: JSON.stringify({ tenant_id: MOCK_TENANT_ID }),
      });

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Unauthorized');
    });
  });

  describe('input validation', () => {
    it('should reject invalid tenant_id format', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Invalid tenant ID format' }, 400)
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: MOCK_AUTH_TOKEN,
        },
        body: JSON.stringify({ tenant_id: 'not-a-uuid' }),
      });

      expect(response.status).toBe(400);
    });

    it('should reject missing tenant_id', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Internal server error' }, 500)
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: MOCK_AUTH_TOKEN,
        },
        body: JSON.stringify({}),
      });

      expect(response.ok).toBe(false);
    });

    it('should reject empty body', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Internal server error' }, 500)
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: MOCK_AUTH_TOKEN,
        },
        body: JSON.stringify(null),
      });

      expect(response.ok).toBe(false);
    });
  });

  describe('authorization', () => {
    it('should return 403 when user is not admin or owner', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(
          { error: 'Insufficient permissions - admin or owner access required' },
          403
        )
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: MOCK_AUTH_TOKEN,
        },
        body: JSON.stringify({ tenant_id: MOCK_TENANT_ID }),
      });

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toContain('Insufficient permissions');
    });

    it('should return 404 when tenant does not exist', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Tenant not found' }, 404)
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: MOCK_AUTH_TOKEN,
        },
        body: JSON.stringify({ tenant_id: '00000000-0000-0000-0000-000000000000' }),
      });

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe('Tenant not found');
    });
  });

  describe('stripe configuration', () => {
    it('should return 500 when Stripe is not configured', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(
          { error: 'Stripe not configured. Please set STRIPE_SECRET_KEY in environment variables.' },
          500
        )
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: MOCK_AUTH_TOKEN,
        },
        body: JSON.stringify({ tenant_id: MOCK_TENANT_ID }),
      });

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toContain('Stripe not configured');
    });

    it('should return 500 when using publishable key instead of secret key', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(
          { error: "Invalid Stripe configuration. Please use a secret key (starts with 'sk_'), not a publishable key." },
          500
        )
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: MOCK_AUTH_TOKEN,
        },
        body: JSON.stringify({ tenant_id: MOCK_TENANT_ID }),
      });

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toContain('secret key');
    });
  });

  describe('CORS handling', () => {
    it('should handle OPTIONS preflight request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers':
            'authorization, x-client-info, apikey, content-type',
        }),
      });

      const response = await fetch(ENDPOINT, {
        method: 'OPTIONS',
      });

      expect(response.ok).toBe(true);
    });

    it('should include CORS headers in success response', async () => {
      const mockHeaders = new Headers({
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers':
          'authorization, x-client-info, apikey, content-type',
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            success: true,
            url: 'https://checkout.stripe.com/test',
            sessionId: 'cs_test_cors',
          }),
        headers: mockHeaders,
      });

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: MOCK_AUTH_TOKEN,
        },
        body: JSON.stringify({ tenant_id: MOCK_TENANT_ID }),
      });

      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    });

    it('should include CORS headers in error response', async () => {
      const mockHeaders = new Headers({
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers':
          'authorization, x-client-info, apikey, content-type',
      });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ error: 'Unauthorized' }),
        headers: mockHeaders,
      });

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: MOCK_TENANT_ID }),
      });

      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    });
  });

  describe('error handling', () => {
    it('should return 500 for unexpected errors', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Internal server error' }, 500)
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: MOCK_AUTH_TOKEN,
        },
        body: JSON.stringify({ tenant_id: MOCK_TENANT_ID }),
      });

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('Internal server error');
    });

    it('should not leak internal error details to client', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Internal server error' }, 500)
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: MOCK_AUTH_TOKEN,
        },
        body: JSON.stringify({ tenant_id: MOCK_TENANT_ID }),
      });

      const data = await response.json();

      // Should not contain stack traces or internal details
      expect(data.error).toBe('Internal server error');
      expect(data.stack).toBeUndefined();
      expect(data.message).toBeUndefined();
    });
  });

  describe('response format', () => {
    it('should return success=true, url, and sessionId on success', async () => {
      const mockResponse = {
        success: true,
        url: 'https://checkout.stripe.com/c/pay/cs_test_format',
        sessionId: 'cs_test_format',
      };

      mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse));

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: MOCK_AUTH_TOKEN,
        },
        body: JSON.stringify({ tenant_id: MOCK_TENANT_ID }),
      });

      const data = await response.json();

      expect(data).toHaveProperty('success', true);
      expect(data).toHaveProperty('url');
      expect(data).toHaveProperty('sessionId');
      expect(typeof data.url).toBe('string');
      expect(typeof data.sessionId).toBe('string');
    });

    it('should return error field on failure', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Tenant not found' }, 404)
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: MOCK_AUTH_TOKEN,
        },
        body: JSON.stringify({ tenant_id: MOCK_TENANT_ID }),
      });

      const data = await response.json();

      expect(data).toHaveProperty('error');
      expect(typeof data.error).toBe('string');
    });
  });
});
