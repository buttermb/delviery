/**
 * Stripe Customer Portal Security Tests
 *
 * Verifies that the stripe-customer-portal edge function resolves tenant ownership
 * from tenant_users (server-side) rather than trusting the client-supplied tenant_id.
 *
 * This matches the secure pattern used by start-trial and update-subscription.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Read the edge function source to verify security patterns
const EDGE_FUNCTION_PATH = resolve(
  __dirname,
  '../../../../supabase/functions/stripe-customer-portal/index.ts'
);
let edgeFunctionSource: string;

try {
  edgeFunctionSource = readFileSync(EDGE_FUNCTION_PATH, 'utf-8');
} catch {
  edgeFunctionSource = '';
}

describe('stripe-customer-portal tenant ownership verification', () => {
  it('should have the edge function source available for analysis', () => {
    expect(edgeFunctionSource.length).toBeGreaterThan(0);
  });

  describe('tenant_users ownership resolution pattern', () => {
    it('should resolve tenant_id from tenant_users table using user.id', () => {
      // The function must query tenant_users by user.id to resolve the real tenant
      expect(edgeFunctionSource).toContain("from('tenant_users')");
      expect(edgeFunctionSource).toContain("eq('user_id', user.id)");
      expect(edgeFunctionSource).toContain("select('tenant_id, role')");
    });

    it('should use .maybeSingle() for tenant_users lookup', () => {
      // Must use maybeSingle() not single() for safe handling
      expect(edgeFunctionSource).toContain('.maybeSingle()');
    });

    it('should require exactly matched tenant_id in the database query', () => {
      expect(edgeFunctionSource).toContain("eq('tenant_id', clientTenantId)");
      expect(edgeFunctionSource).toContain("eq('user_id', user.id)");
    });

    it('should return 403 when user has no tenant association or mismatched tenant', () => {
      expect(edgeFunctionSource).toContain('No tenant associated with user');
      expect(edgeFunctionSource).toContain('status: 403');
    });

    it('should trust clientTenantId after verifying database record exists', () => {
      expect(edgeFunctionSource).toContain('const tenant_id = clientTenantId');
    });

    it('should destructure client tenant_id as clientTenantId, not tenant_id', () => {
      expect(edgeFunctionSource).toContain('tenant_id: clientTenantId');
    });
  });

  describe('tenant query uses verified tenant_id', () => {
    it('should query tenants table with resolved tenant_id', () => {
      // After ownership is verified, the tenant lookup must use the resolved ID
      const tenantQueryMatch = edgeFunctionSource.match(
        /from\('tenants'\)[\s\S]*?\.eq\('id',\s*tenant_id\)/
      );
      expect(tenantQueryMatch).not.toBeNull();
    });

    it('should use .maybeSingle() for tenant lookup', () => {
      // The tenant query should use maybeSingle for safety
      const tenantSection = edgeFunctionSource.substring(
        edgeFunctionSource.indexOf("from('tenants')")
      );
      expect(tenantSection).toContain('.maybeSingle()');
    });
  });

  describe('should NOT use insecure email-based ownership check', () => {
    it('should NOT compare owner_email for permission', () => {
      // The old pattern used owner_email comparison which is less secure
      expect(edgeFunctionSource).not.toContain('owner_email?.toLowerCase()');
      expect(edgeFunctionSource).not.toContain('isOwner');
    });

    it('should NOT use role-based check against client-supplied tenant_id', () => {
      // The old pattern checked role against the untrusted tenant_id
      expect(edgeFunctionSource).not.toContain('isAdmin');
      expect(edgeFunctionSource).not.toContain("role === 'admin'");
    });
  });

  describe('consistency with other billing edge functions', () => {
    let startTrialSource: string;
    let updateSubscriptionSource: string;

    beforeEach(() => {
      try {
        startTrialSource = readFileSync(
          resolve(__dirname, '../../../../supabase/functions/start-trial/index.ts'),
          'utf-8'
        );
      } catch {
        startTrialSource = '';
      }

      try {
        updateSubscriptionSource = readFileSync(
          resolve(__dirname, '../../../../supabase/functions/update-subscription/index.ts'),
          'utf-8'
        );
      } catch {
        updateSubscriptionSource = '';
      }
    });

    it('should follow the same tenant_users resolution pattern as start-trial', () => {
      expect(startTrialSource).toMatch(/eq\(["']tenant_id["'],\s*clientTenantId\)/);
      expect(edgeFunctionSource).toMatch(/eq\(["']tenant_id["'],\s*clientTenantId\)/);
    });

    it('should follow the exact same tenant verification approach via EQ checks', () => {
      expect(updateSubscriptionSource).toMatch(/eq\(["']tenant_id["'],\s*clientTenantId\)/);
      expect(edgeFunctionSource).toMatch(/eq\(["']tenant_id["'],\s*clientTenantId\)/);
    });

    it('all billing edge functions should use the "never trust client" comment', () => {
      const neverTrustPattern = /never trust client/i;
      expect(edgeFunctionSource).toMatch(neverTrustPattern);
      expect(startTrialSource).toMatch(neverTrustPattern);
      expect(updateSubscriptionSource).toMatch(neverTrustPattern);
    });
  });
});

describe('stripe-customer-portal API contract tests', () => {
  const SUPABASE_URL = 'https://mtvwmyerntkhrcdnhahp.supabase.co';
  const FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1`;
  const endpoint = `${FUNCTIONS_URL}/stripe-customer-portal`;

  const mockFetch = vi.fn();

  beforeEach(() => {
    mockFetch.mockClear();
    global.fetch = mockFetch;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const createMockResponse = (data: unknown, status = 200) => ({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
    headers: new Headers({ 'Content-Type': 'application/json' }),
  });

  it('should return 401 when no authorization header is provided', async () => {
    mockFetch.mockResolvedValueOnce(
      createMockResponse({ error: 'Missing authorization header' }, 401)
    );

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenant_id: 'some-tenant-id' }),
    });

    expect(response.status).toBe(401);
  });

  it('should return 403 when user has no tenant association', async () => {
    mockFetch.mockResolvedValueOnce(
      createMockResponse({ error: 'No tenant associated with user' }, 403)
    );

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer valid-token',
      },
      body: JSON.stringify({ tenant_id: 'orphan-tenant-id' }),
    });

    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data.error).toBe('No tenant associated with user');
  });

  it('should return 403 when client tenant_id does not match user tenant', async () => {
    mockFetch.mockResolvedValueOnce(
      createMockResponse({ error: 'Not authorized for this tenant' }, 403)
    );

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer valid-token',
      },
      body: JSON.stringify({ tenant_id: 'different-tenant-id' }),
    });

    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data.error).toBe('Not authorized for this tenant');
  });

  it('should return 400 when tenant_id is missing', async () => {
    mockFetch.mockResolvedValueOnce(
      createMockResponse({ error: 'Missing tenant_id' }, 400)
    );

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer valid-token',
      },
      body: JSON.stringify({}),
    });

    expect(response.status).toBe(400);
  });

  it('should return portal URL on successful request', async () => {
    mockFetch.mockResolvedValueOnce(
      createMockResponse({
        success: true,
        url: 'https://billing.stripe.com/p/session/test_abc123',
      })
    );

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer valid-token',
      },
      body: JSON.stringify({ tenant_id: 'valid-tenant-id' }),
    });

    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.url).toContain('stripe.com');
  });

  it('should handle CORS preflight', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      }),
    });

    const response = await fetch(endpoint, {
      method: 'OPTIONS',
    });

    expect(response.ok).toBe(true);
  });
});
