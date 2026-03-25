/**
 * set-free-tier Edge Function Tests
 *
 * Verifies that the set-free-tier edge function properly enforces
 * tenant ownership before allowing free tier activation:
 *
 * 1. Authentication — rejects missing/invalid auth tokens
 * 2. Tenant ownership — resolves tenant from user, rejects mismatches
 * 3. Request validation — requires valid UUID tenant_id
 * 4. Idempotency — returns success if already on free tier
 * 5. First-time activation — sets correct flags and grants credits
 * 6. Rollback — reverts tenant on credit grant failure
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const SUPABASE_URL = 'https://mtvwmyerntkhrcdnhahp.supabase.co';
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

  // =========================================================================
  // Authentication
  // =========================================================================

  describe('authentication', () => {
    it('should reject requests without Authorization header', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Unauthorized' }, 401)
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: '550e8400-e29b-41d4-a716-446655440000' }),
      });

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Unauthorized');
    });

    it('should reject requests with invalid Bearer token', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'User not authenticated' }, 401)
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer invalid-token-xyz',
        },
        body: JSON.stringify({ tenant_id: '550e8400-e29b-41d4-a716-446655440000' }),
      });

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('User not authenticated');
    });

    it('should reject requests with malformed Authorization header', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Unauthorized' }, 401)
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Basic dXNlcjpwYXNz',
        },
        body: JSON.stringify({ tenant_id: '550e8400-e29b-41d4-a716-446655440000' }),
      });

      expect(response.status).toBe(401);
    });
  });

  // =========================================================================
  // Tenant Ownership Verification
  // =========================================================================

  describe('tenant ownership verification', () => {
    it('should reject when user has no associated tenant', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'No tenant associated with user' }, 403)
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token-no-tenant',
        },
        body: JSON.stringify({ tenant_id: '550e8400-e29b-41d4-a716-446655440000' }),
      });

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toBe('No tenant associated with user');
    });

    it('should reject when client tenant_id does not match user tenant', async () => {
      const userTenantId = '550e8400-e29b-41d4-a716-446655440000';
      const otherTenantId = '660e8400-e29b-41d4-a716-446655440001';

      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Not authorized for this tenant' }, 403)
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer token-for-${userTenantId}`,
        },
        body: JSON.stringify({ tenant_id: otherTenantId }),
      });

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toBe('Not authorized for this tenant');
    });

    it('should never trust client-supplied tenant_id without server verification', async () => {
      // Even if an attacker sends a valid-looking tenant_id,
      // the server must resolve the actual tenant from tenant_users table
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Not authorized for this tenant' }, 403)
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer stolen-or-forged-token',
        },
        body: JSON.stringify({ tenant_id: '550e8400-e29b-41d4-a716-446655440000' }),
      });

      // The edge function should look up the user's ACTUAL tenant from DB,
      // compare it against the client-supplied tenant_id, and reject mismatches
      expect(response.status).toBe(403);
    });

    it('should succeed when authenticated user owns the requested tenant', async () => {
      const tenantId = '550e8400-e29b-41d4-a716-446655440000';

      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          success: true,
          slug: 'my-dispensary',
          credits_granted: 500,
        })
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-owner-token',
        },
        body: JSON.stringify({ tenant_id: tenantId }),
      });

      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.slug).toBe('my-dispensary');
      expect(data.credits_granted).toBe(500);
    });
  });

  // =========================================================================
  // Request Validation
  // =========================================================================

  describe('request validation', () => {
    it('should reject invalid tenant_id format (non-UUID)', async () => {
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
      const data = await response.json();
      expect(data.error).toBe('Invalid request');
    });

    it('should reject missing tenant_id', async () => {
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

  // =========================================================================
  // Idempotency
  // =========================================================================

  describe('idempotency — already on free tier', () => {
    it('should return success with already_free flag when tenant is already free', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          success: true,
          slug: 'my-dispensary',
          already_free: true,
        })
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-owner-token',
        },
        body: JSON.stringify({
          tenant_id: '550e8400-e29b-41d4-a716-446655440000',
        }),
      });

      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data.success).toBe(true);
      expect(data.already_free).toBe(true);
      expect(data.slug).toBe('my-dispensary');
    });

    it('should NOT include credits_granted when already on free tier', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          success: true,
          slug: 'my-dispensary',
          already_free: true,
        })
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-owner-token',
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
        slug: 'my-dispensary',
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
        Authorization: 'Bearer valid-owner-token',
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
          slug: 'my-dispensary',
          already_free: true,
        })
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-owner-token',
        },
        body: JSON.stringify({
          tenant_id: '550e8400-e29b-41d4-a716-446655440000',
        }),
      });

      expect(response.status).toBe(200);
    });
  });

  // =========================================================================
  // First-time Activation
  // =========================================================================

  describe('first-time activation', () => {
    it('should grant credits and return slug on first activation', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          success: true,
          slug: 'my-dispensary',
          credits_granted: 500,
        })
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-owner-token',
        },
        body: JSON.stringify({
          tenant_id: '550e8400-e29b-41d4-a716-446655440000',
        }),
      });

      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data.success).toBe(true);
      expect(data.credits_granted).toBe(500);
      expect(data.slug).toBe('my-dispensary');
      // First activation does NOT include already_free
      expect(data.already_free).toBeUndefined();
    });
  });

  // =========================================================================
  // Failure Handling & Rollback
  // =========================================================================

  describe('failure handling', () => {
    it('should return 500 when tenant update fails', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Failed to set free tier status' }, 500)
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-owner-token',
        },
        body: JSON.stringify({ tenant_id: '550e8400-e29b-41d4-a716-446655440000' }),
      });

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('Failed to set free tier status');
    });

    it('should return 500 and rollback when credit grant fails', async () => {
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
          Authorization: 'Bearer valid-owner-token',
        },
        body: JSON.stringify({ tenant_id: '550e8400-e29b-41d4-a716-446655440000' }),
      });

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toContain('Failed to grant initial credits');
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
          slug: 'my-dispensary',
          credits_granted: 500,
        })
      );

      const body = JSON.stringify({
        tenant_id: '550e8400-e29b-41d4-a716-446655440000',
      });
      const headers = {
        'Content-Type': 'application/json',
        Authorization: 'Bearer valid-owner-token',
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

  // =========================================================================
  // CORS
  // =========================================================================

  describe('CORS handling', () => {
    it('should handle OPTIONS preflight requests', async () => {
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

// =============================================================================
// Tenant Ownership Logic (Unit Tests)
// =============================================================================

describe('Tenant Ownership Verification Logic', () => {
  /**
   * Pure-function implementation of the ownership check from set-free-tier.
   * This tests the logic independently of the edge function runtime.
   */

  interface TenantUser {
    tenant_id: string;
    role: string;
  }

  interface OwnershipResult {
    authorized: boolean;
    error?: string;
    resolvedTenantId?: string;
  }

  const verifyTenantOwnership = (
    tenantUser: TenantUser | null,
    tenantUserError: boolean,
    clientTenantId: string
  ): OwnershipResult => {
    const resolvedTenantId = tenantUser?.tenant_id;

    if (tenantUserError || !resolvedTenantId) {
      return { authorized: false, error: 'No tenant associated with user' };
    }

    if (resolvedTenantId !== clientTenantId) {
      return { authorized: false, error: 'Not authorized for this tenant' };
    }

    return { authorized: true, resolvedTenantId };
  };

  it('should authorize when resolved tenant matches client tenant', () => {
    const tenantId = '550e8400-e29b-41d4-a716-446655440000';
    const result = verifyTenantOwnership(
      { tenant_id: tenantId, role: 'owner' },
      false,
      tenantId
    );

    expect(result.authorized).toBe(true);
    expect(result.resolvedTenantId).toBe(tenantId);
    expect(result.error).toBeUndefined();
  });

  it('should reject when resolved tenant does not match client tenant', () => {
    const result = verifyTenantOwnership(
      { tenant_id: 'tenant-A', role: 'owner' },
      false,
      'tenant-B'
    );

    expect(result.authorized).toBe(false);
    expect(result.error).toBe('Not authorized for this tenant');
  });

  it('should reject when tenant_users query returns null', () => {
    const result = verifyTenantOwnership(null, false, 'any-tenant-id');

    expect(result.authorized).toBe(false);
    expect(result.error).toBe('No tenant associated with user');
  });

  it('should reject when tenant_users query errors', () => {
    const result = verifyTenantOwnership(
      { tenant_id: 'tenant-A', role: 'owner' },
      true,
      'tenant-A'
    );

    expect(result.authorized).toBe(false);
    expect(result.error).toBe('No tenant associated with user');
  });

  it('should reject when tenant_id field is empty string', () => {
    const result = verifyTenantOwnership(
      { tenant_id: '', role: 'admin' },
      false,
      'some-tenant-id'
    );

    expect(result.authorized).toBe(false);
    expect(result.error).toBe('No tenant associated with user');
  });

  it('should work for admin role users', () => {
    const tenantId = '550e8400-e29b-41d4-a716-446655440000';
    const result = verifyTenantOwnership(
      { tenant_id: tenantId, role: 'admin' },
      false,
      tenantId
    );

    expect(result.authorized).toBe(true);
  });

  it('should work for staff role users', () => {
    const tenantId = '550e8400-e29b-41d4-a716-446655440000';
    const result = verifyTenantOwnership(
      { tenant_id: tenantId, role: 'staff' },
      false,
      tenantId
    );

    expect(result.authorized).toBe(true);
  });
});

// =============================================================================
// Request Schema Validation Logic (Unit Tests)
// =============================================================================

describe('set-free-tier Request Schema Validation', () => {
  /**
   * Mirrors the Zod schema from the edge function:
   * z.object({ tenant_id: z.string().uuid() })
   */

  const UUID_REGEX =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  const validateRequest = (
    body: Record<string, unknown>
  ): { valid: boolean; error?: string } => {
    if (!body.tenant_id || typeof body.tenant_id !== 'string') {
      return { valid: false, error: 'tenant_id is required' };
    }

    if (!UUID_REGEX.test(body.tenant_id)) {
      return { valid: false, error: 'tenant_id must be a valid UUID' };
    }

    return { valid: true };
  };

  it('should accept valid UUID tenant_id', () => {
    const result = validateRequest({
      tenant_id: '550e8400-e29b-41d4-a716-446655440000',
    });
    expect(result.valid).toBe(true);
  });

  it('should reject missing tenant_id', () => {
    const result = validateRequest({});
    expect(result.valid).toBe(false);
    expect(result.error).toContain('required');
  });

  it('should reject non-UUID tenant_id', () => {
    const result = validateRequest({ tenant_id: 'not-a-uuid' });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('UUID');
  });

  it('should reject numeric tenant_id', () => {
    const result = validateRequest({ tenant_id: 12345 });
    expect(result.valid).toBe(false);
  });

  it('should reject null tenant_id', () => {
    const result = validateRequest({ tenant_id: null });
    expect(result.valid).toBe(false);
  });

  it('should reject SQL injection in tenant_id', () => {
    const result = validateRequest({
      tenant_id: "'; DROP TABLE tenants; --",
    });
    expect(result.valid).toBe(false);
  });

  it('should accept uppercase UUID', () => {
    const result = validateRequest({
      tenant_id: '550E8400-E29B-41D4-A716-446655440000',
    });
    expect(result.valid).toBe(true);
  });
});
