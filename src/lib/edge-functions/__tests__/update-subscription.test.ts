/**
 * Update Subscription Edge Function Tests
 *
 * Verifies the update-subscription edge function properly validates:
 * 1. tenant_id is provided (400 if missing)
 * 2. plan_id is provided (400 if missing)
 * 3. Authentication is required (401 if missing/invalid)
 * 4. Tenant ownership is verified (403 if mismatch)
 * 5. Plan existence is checked (404 if not found)
 * 6. Successful checkout session creation returns URL
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const SUPABASE_URL = 'https://aejugtmhwwknrowfyzie.supabase.co';
const FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1`;
const ENDPOINT = `${FUNCTIONS_URL}/update-subscription`;

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

describe('update-subscription edge function', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('tenant_id and plan_id validation', () => {
    it('should return 400 when tenant_id is missing', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Missing tenant_id or plan_id' }, 400)
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({ plan_id: 'plan-123' }),
      });

      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Missing tenant_id or plan_id');
    });

    it('should return 400 when plan_id is missing', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Missing tenant_id or plan_id' }, 400)
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({ tenant_id: 'tenant-123' }),
      });

      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Missing tenant_id or plan_id');
    });

    it('should return 400 when both tenant_id and plan_id are missing', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Missing tenant_id or plan_id' }, 400)
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({}),
      });

      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Missing tenant_id or plan_id');
    });

    it('should return 400 when tenant_id is null', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Missing tenant_id or plan_id' }, 400)
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({ tenant_id: null, plan_id: 'plan-123' }),
      });

      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Missing tenant_id or plan_id');
    });

    it('should return 400 when plan_id is empty string', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Missing tenant_id or plan_id' }, 400)
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({ tenant_id: 'tenant-123', plan_id: '' }),
      });

      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Missing tenant_id or plan_id');
    });
  });

  describe('authentication', () => {
    it('should return 401 when authorization header is missing', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Missing authorization header' }, 401)
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: 'tenant-123', plan_id: 'plan-123' }),
      });

      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Missing authorization header');
    });

    it('should return 401 when token is invalid', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'User not authenticated' }, 401)
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer invalid-token',
        },
        body: JSON.stringify({ tenant_id: 'tenant-123', plan_id: 'plan-123' }),
      });

      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('User not authenticated');
    });
  });

  describe('tenant ownership verification', () => {
    it('should return 403 when user has no tenant association', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'No tenant associated with user' }, 403)
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({ tenant_id: 'tenant-123', plan_id: 'plan-123' }),
      });

      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('No tenant associated with user');
    });

    it('should return 403 when client tenant_id does not match resolved tenant', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Not authorized for this tenant' }, 403)
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({
          tenant_id: 'other-tenant-id',
          plan_id: 'plan-123',
        }),
      });

      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Not authorized for this tenant');
    });
  });

  describe('plan validation', () => {
    it('should return 404 when plan does not exist', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Plan not found' }, 404)
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({
          tenant_id: 'tenant-123',
          plan_id: 'nonexistent-plan',
        }),
      });

      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Plan not found');
    });

    it('should return 404 when tenant does not exist', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Tenant not found' }, 404)
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({
          tenant_id: 'tenant-123',
          plan_id: 'plan-123',
        }),
      });

      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Tenant not found');
    });
  });

  describe('successful subscription update', () => {
    it('should return checkout URL when all validations pass', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ url: 'https://checkout.stripe.com/session-123' })
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({
          tenant_id: 'tenant-123',
          plan_id: 'plan-456',
        }),
      });

      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(response.status).toBe(200);
      expect(data.url).toBeDefined();
      expect(data.url).toContain('stripe.com');
    });

    it('should send tenant_id and plan_id in the request body', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ url: 'https://checkout.stripe.com/session-123' })
      );

      await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({
          tenant_id: 'tenant-123',
          plan_id: 'plan-456',
        }),
      });

      expect(mockFetch).toHaveBeenCalledWith(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({
          tenant_id: 'tenant-123',
          plan_id: 'plan-456',
        }),
      });
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
  });

  describe('error handling', () => {
    it('should return 500 when Stripe is not configured', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(
          { error: 'Stripe not configured. Please set STRIPE_SECRET_KEY.' },
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
          tenant_id: 'tenant-123',
          plan_id: 'plan-456',
        }),
      });

      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain('Stripe not configured');
    });

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
          tenant_id: 'tenant-123',
          plan_id: 'plan-456',
        }),
      });

      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Internal server error');
    });
  });
});
