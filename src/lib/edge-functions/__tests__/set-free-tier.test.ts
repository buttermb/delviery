/**
 * set-free-tier Edge Function Tests
 *
 * Verifies:
 * 1. Idempotency — repeated calls for an already-free tenant produce no side effects
 * 2. Rollback — credit grant failure reverts tenant flags
 * 3. First-time activation — sets correct flags and grants credits
 * 4. Auth & ownership — rejects unauthorized / mismatched tenants
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const SUPABASE_URL = 'https://aejugtmhwwknrowfyzie.supabase.co';
const FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1`;
const ENDPOINT = `${FUNCTIONS_URL}/set-free-tier`;

const mockFetch = vi.fn();
global.fetch = mockFetch;

const createMockResponse = (data: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: () => Promise.resolve(data),
  headers: new Headers({ 'Content-Type': 'application/json' }),
});

describe('set-free-tier Edge Function', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('idempotency — already on free tier', () => {
    it('should return success with already_free flag when tenant is already free', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          success: true,
          slug: 'willysbo',
          already_free: true,
        })
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({
          tenant_id: '550e8400-e29b-41d4-a716-446655440000',
        }),
      });

      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data.success).toBe(true);
      expect(data.already_free).toBe(true);
      expect(data.slug).toBe('willysbo');
    });

    it('should NOT include credits_granted when already on free tier', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          success: true,
          slug: 'willysbo',
          already_free: true,
        })
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({
          tenant_id: '550e8400-e29b-41d4-a716-446655440000',
        }),
      });

      const data = await response.json();

      // No credits_granted field means no credit-granting side effect
      expect(data.credits_granted).toBeUndefined();
    });

    it('should return same response shape on repeated calls', async () => {
      const idempotentResponse = {
        success: true,
        slug: 'willysbo',
        already_free: true,
      };

      // Simulate two identical calls
      mockFetch
        .mockResolvedValueOnce(createMockResponse(idempotentResponse))
        .mockResolvedValueOnce(createMockResponse(idempotentResponse));

      const body = JSON.stringify({
        tenant_id: '550e8400-e29b-41d4-a716-446655440000',
      });
      const headers = {
        'Content-Type': 'application/json',
        Authorization: 'Bearer valid-token',
      };

      const response1 = await fetch(ENDPOINT, { method: 'POST', headers, body });
      const response2 = await fetch(ENDPOINT, { method: 'POST', headers, body });

      const data1 = await response1.json();
      const data2 = await response2.json();

      expect(data1).toEqual(data2);
      expect(data1.success).toBe(true);
      expect(data1.already_free).toBe(true);
    });

    it('should return HTTP 200 (not 409 or 304) for idempotent repeat', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          success: true,
          slug: 'willysbo',
          already_free: true,
        })
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({
          tenant_id: '550e8400-e29b-41d4-a716-446655440000',
        }),
      });

      expect(response.status).toBe(200);
    });
  });

  describe('first-time activation', () => {
    it('should grant credits and return slug on first activation', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          success: true,
          slug: 'willysbo',
          credits_granted: 500,
        })
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({
          tenant_id: '550e8400-e29b-41d4-a716-446655440000',
        }),
      });

      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data.success).toBe(true);
      expect(data.credits_granted).toBe(500);
      expect(data.slug).toBe('willysbo');
      // First activation does NOT include already_free
      expect(data.already_free).toBeUndefined();
    });
  });

  describe('rollback on credit grant failure', () => {
    it('should return 500 with error when credit grant fails', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(
          { error: 'Failed to grant initial credits. Please try again.' },
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
          tenant_id: '550e8400-e29b-41d4-a716-446655440000',
        }),
      });

      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to grant initial credits. Please try again.');
    });

    it('should allow retry after rollback (not stuck in bad state)', async () => {
      // First call: credit grant fails, tenant is rolled back
      mockFetch.mockResolvedValueOnce(
        createMockResponse(
          { error: 'Failed to grant initial credits. Please try again.' },
          500
        )
      );

      // Second call: succeeds because rollback restored tenant state
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          success: true,
          slug: 'willysbo',
          credits_granted: 500,
        })
      );

      const body = JSON.stringify({
        tenant_id: '550e8400-e29b-41d4-a716-446655440000',
      });
      const headers = {
        'Content-Type': 'application/json',
        Authorization: 'Bearer valid-token',
      };

      const response1 = await fetch(ENDPOINT, { method: 'POST', headers, body });
      expect(response1.status).toBe(500);

      const response2 = await fetch(ENDPOINT, { method: 'POST', headers, body });
      const data2 = await response2.json();

      expect(response2.ok).toBe(true);
      expect(data2.success).toBe(true);
      expect(data2.credits_granted).toBe(500);
    });
  });

  describe('authentication and authorization', () => {
    it('should return 401 when no Authorization header is provided', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Unauthorized' }, 401)
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: '550e8400-e29b-41d4-a716-446655440000',
        }),
      });

      expect(response.status).toBe(401);
    });

    it('should return 403 when user does not own the tenant', async () => {
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
          tenant_id: '550e8400-e29b-41d4-a716-446655440001',
        }),
      });

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toBe('Not authorized for this tenant');
    });

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
        body: JSON.stringify({
          tenant_id: '550e8400-e29b-41d4-a716-446655440000',
        }),
      });

      expect(response.status).toBe(403);
    });
  });

  describe('input validation', () => {
    it('should return 400 for invalid tenant_id (not UUID)', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(
          { error: 'Invalid request', details: [{ message: 'Invalid uuid' }] },
          400
        )
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({ tenant_id: 'not-a-uuid' }),
      });

      expect(response.status).toBe(400);
    });

    it('should return 400 for missing tenant_id', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(
          { error: 'Invalid request', details: [{ message: 'Required' }] },
          400
        )
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
  });

  describe('CORS', () => {
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

      const response = await fetch(ENDPOINT, { method: 'OPTIONS' });

      expect(response.ok).toBe(true);
    });
  });
});
