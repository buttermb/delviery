/**
 * Credit Gate Middleware Tests — 402 Insufficient Credits
 *
 * Verifies that withCreditGate returns HTTP 402 with the correct JSON body
 * and headers when the tenant has 0 credits (consume_credits RPC fails).
 *
 * Since creditGate.ts runs in Deno and uses Deno-specific imports, these
 * tests verify the response contract by simulating the middleware logic
 * with mock Supabase client responses.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — replicate the Supabase client chain used by creditGate.ts
// ---------------------------------------------------------------------------

interface MockRpcResponse {
  data: Array<{
    success: boolean;
    new_balance: number;
    credits_cost: number;
    error_message: string | null;
  }> | null;
  error: { message: string } | null;
}

interface MockQueryResponse<T = unknown> {
  data: T | null;
  error: { message: string } | null;
}

function createMockSupabaseClient(options: {
  userId?: string | null;
  tenantId?: string | null;
  isFreeTier?: boolean;
  subscriptionStatus?: string | null;
  rpcResponse?: MockRpcResponse;
}) {
  const {
    userId = 'user-123',
    tenantId = 'tenant-456',
    isFreeTier = true,
    subscriptionStatus = null,
    rpcResponse = { data: null, error: { message: 'Insufficient credits' } },
  } = options;

  const client = {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: {
          user: userId ? { id: userId } : null,
        },
      }),
    },
    from: vi.fn().mockImplementation((table: string) => {
      if (table === 'tenant_users') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: tenantId ? { tenant_id: tenantId } : null,
                error: null,
              } as MockQueryResponse),
            }),
          }),
        };
      }
      if (table === 'tenants') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: tenantId
                  ? {
                      id: tenantId,
                      is_free_tier: isFreeTier,
                      subscription_status: subscriptionStatus,
                    }
                  : null,
                error: null,
              } as MockQueryResponse),
            }),
          }),
        };
      }
      if (table === 'credit_analytics') {
        return {
          insert: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      };
    }),
    rpc: vi.fn().mockResolvedValue(rpcResponse),
  };

  return client;
}

// ---------------------------------------------------------------------------
// CORS headers matching deps.ts
// ---------------------------------------------------------------------------

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

// ---------------------------------------------------------------------------
// Replicate the withCreditGate response logic for testing
// This mirrors the exact response construction from creditGate.ts
// ---------------------------------------------------------------------------

/**
 * Simulates the withCreditGate middleware flow using mock Supabase client.
 * Tests the response contract without needing Deno runtime.
 */
async function simulateCreditGateResponse(
  mockClient: ReturnType<typeof createMockSupabaseClient>,
  actionKey: string,
  handler: (tenantId: string) => Promise<Response>,
  requestOptions?: {
    method?: string;
    authHeader?: string;
  }
): Promise<Response> {
  const method = requestOptions?.method ?? 'POST';
  const authHeader = requestOptions?.authHeader ?? 'Bearer test-jwt-token';

  // Handle CORS preflight
  if (method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Get user from auth
  const {
    data: { user },
  } = await mockClient.auth.getUser(authHeader.replace('Bearer ', ''));

  if (!user) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized - no tenant found' }),
      {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  // Get tenant from tenant_users
  const tenantUsersResult = await mockClient
    .from('tenant_users')
    .select('tenant_id')
    .eq('user_id', user.id)
    .maybeSingle();

  const tenantId = tenantUsersResult.data?.tenant_id;
  if (!tenantId) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized - no tenant found' }),
      {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  // Get tenant info
  const tenantResult = await mockClient
    .from('tenants')
    .select('id, is_free_tier, subscription_status')
    .eq('id', tenantId)
    .maybeSingle();

  const tenant = tenantResult.data;
  if (!tenant) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized - no tenant found' }),
      {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  // Skip for paid tiers (default)
  if (!tenant.is_free_tier) {
    return handler(tenant.id);
  }

  // Call consume_credits RPC
  const { data, error } = await mockClient.rpc('consume_credits', {
    p_tenant_id: tenantId,
    p_action_key: actionKey,
    p_reference_id: null,
    p_reference_type: null,
    p_description: null,
  });

  let creditResult: {
    success: boolean;
    newBalance: number;
    creditsCost: number;
    errorMessage: string | null;
  };

  if (error) {
    creditResult = {
      success: false,
      newBalance: 0,
      creditsCost: 0,
      errorMessage: error.message,
    };
  } else if (!data || data.length === 0) {
    creditResult = {
      success: false,
      newBalance: 0,
      creditsCost: 0,
      errorMessage: 'No response from credit check',
    };
  } else {
    const result = data[0];
    creditResult = {
      success: result.success,
      newBalance: result.new_balance,
      creditsCost: result.credits_cost,
      errorMessage: result.error_message,
    };
  }

  if (!creditResult.success) {
    return new Response(
      JSON.stringify({
        error: 'Insufficient credits',
        code: 'INSUFFICIENT_CREDITS',
        message:
          creditResult.errorMessage ||
          'You do not have enough credits to perform this action',
        creditsRequired: creditResult.creditsCost,
        currentBalance: creditResult.newBalance,
        actionKey,
      }),
      {
        status: 402,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  // Execute handler and add credit headers
  const response = await handler(tenant.id);
  const newHeaders = new Headers(response.headers);
  newHeaders.set('X-Credits-Consumed', String(creditResult.creditsCost));
  newHeaders.set('X-Credits-Remaining', String(creditResult.newBalance));

  return new Response(response.body, {
    status: response.status,
    headers: newHeaders,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('withCreditGate — 402 Insufficient Credits', () => {
  const handlerSpy = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  );

  beforeEach(() => {
    handlerSpy.mockClear();
  });

  describe('when consume_credits RPC returns failure (balance is 0)', () => {
    it('should return HTTP 402 status', async () => {
      const mockClient = createMockSupabaseClient({
        isFreeTier: true,
        rpcResponse: {
          data: [
            {
              success: false,
              new_balance: 0,
              credits_cost: 50,
              error_message: 'Insufficient credits',
            },
          ],
          error: null,
        },
      });

      const response = await simulateCreditGateResponse(
        mockClient,
        'order_create_manual',
        handlerSpy
      );

      expect(response.status).toBe(402);
    });

    it('should return error body with INSUFFICIENT_CREDITS code', async () => {
      const mockClient = createMockSupabaseClient({
        isFreeTier: true,
        rpcResponse: {
          data: [
            {
              success: false,
              new_balance: 0,
              credits_cost: 50,
              error_message: 'Insufficient credits',
            },
          ],
          error: null,
        },
      });

      const response = await simulateCreditGateResponse(
        mockClient,
        'order_create_manual',
        handlerSpy
      );

      const body = await response.json();
      expect(body).toEqual({
        error: 'Insufficient credits',
        code: 'INSUFFICIENT_CREDITS',
        message: 'Insufficient credits',
        creditsRequired: 50,
        currentBalance: 0,
        actionKey: 'order_create_manual',
      });
    });

    it('should NOT call the wrapped handler', async () => {
      const mockClient = createMockSupabaseClient({
        isFreeTier: true,
        rpcResponse: {
          data: [
            {
              success: false,
              new_balance: 0,
              credits_cost: 100,
              error_message: 'Insufficient credits',
            },
          ],
          error: null,
        },
      });

      await simulateCreditGateResponse(
        mockClient,
        'menu_create',
        handlerSpy
      );

      expect(handlerSpy).not.toHaveBeenCalled();
    });

    it('should include CORS headers in 402 response', async () => {
      const mockClient = createMockSupabaseClient({
        isFreeTier: true,
        rpcResponse: {
          data: [
            {
              success: false,
              new_balance: 0,
              credits_cost: 25,
              error_message: 'Insufficient credits',
            },
          ],
          error: null,
        },
      });

      const response = await simulateCreditGateResponse(
        mockClient,
        'send_sms',
        handlerSpy
      );

      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(response.headers.get('Content-Type')).toBe('application/json');
    });

    it('should include creditsRequired and currentBalance in error body', async () => {
      const mockClient = createMockSupabaseClient({
        isFreeTier: true,
        rpcResponse: {
          data: [
            {
              success: false,
              new_balance: 10,
              credits_cost: 250,
              error_message: 'Insufficient credits: need 250, have 10',
            },
          ],
          error: null,
        },
      });

      const response = await simulateCreditGateResponse(
        mockClient,
        'menu_ocr',
        handlerSpy
      );

      const body = await response.json();
      expect(body.creditsRequired).toBe(250);
      expect(body.currentBalance).toBe(10);
      expect(body.actionKey).toBe('menu_ocr');
    });
  });

  describe('when consume_credits RPC returns an error', () => {
    it('should return 402 when RPC errors out', async () => {
      const mockClient = createMockSupabaseClient({
        isFreeTier: true,
        rpcResponse: {
          data: null,
          error: { message: 'RPC call failed' },
        },
      });

      const response = await simulateCreditGateResponse(
        mockClient,
        'order_create_manual',
        handlerSpy
      );

      expect(response.status).toBe(402);
      const body = await response.json();
      expect(body.code).toBe('INSUFFICIENT_CREDITS');
      expect(body.message).toBe('RPC call failed');
    });

    it('should return 402 when RPC returns empty data', async () => {
      const mockClient = createMockSupabaseClient({
        isFreeTier: true,
        rpcResponse: {
          data: [],
          error: null,
        },
      });

      const response = await simulateCreditGateResponse(
        mockClient,
        'order_create_manual',
        handlerSpy
      );

      expect(response.status).toBe(402);
      const body = await response.json();
      expect(body.message).toBe('No response from credit check');
    });
  });

  describe('when consume_credits RPC succeeds', () => {
    it('should call the handler and return its response', async () => {
      const mockClient = createMockSupabaseClient({
        isFreeTier: true,
        rpcResponse: {
          data: [
            {
              success: true,
              new_balance: 950,
              credits_cost: 50,
              error_message: null,
            },
          ],
          error: null,
        },
      });

      const response = await simulateCreditGateResponse(
        mockClient,
        'order_create_manual',
        handlerSpy
      );

      expect(response.status).toBe(200);
      expect(handlerSpy).toHaveBeenCalledOnce();
    });

    it('should set X-Credits-Consumed header', async () => {
      const mockClient = createMockSupabaseClient({
        isFreeTier: true,
        rpcResponse: {
          data: [
            {
              success: true,
              new_balance: 975,
              credits_cost: 25,
              error_message: null,
            },
          ],
          error: null,
        },
      });

      const response = await simulateCreditGateResponse(
        mockClient,
        'send_sms',
        handlerSpy
      );

      expect(response.headers.get('X-Credits-Consumed')).toBe('25');
    });

    it('should set X-Credits-Remaining header', async () => {
      const mockClient = createMockSupabaseClient({
        isFreeTier: true,
        rpcResponse: {
          data: [
            {
              success: true,
              new_balance: 975,
              credits_cost: 25,
              error_message: null,
            },
          ],
          error: null,
        },
      });

      const response = await simulateCreditGateResponse(
        mockClient,
        'send_sms',
        handlerSpy
      );

      expect(response.headers.get('X-Credits-Remaining')).toBe('975');
    });
  });

  describe('paid tier bypass', () => {
    it('should skip credit check for paid tier tenants', async () => {
      const mockClient = createMockSupabaseClient({
        isFreeTier: false,
        subscriptionStatus: 'active',
        rpcResponse: {
          data: null,
          error: { message: 'Should not be called' },
        },
      });

      const response = await simulateCreditGateResponse(
        mockClient,
        'order_create_manual',
        handlerSpy
      );

      expect(response.status).toBe(200);
      expect(handlerSpy).toHaveBeenCalledOnce();
      expect(mockClient.rpc).not.toHaveBeenCalled();
    });
  });

  describe('CORS preflight', () => {
    it('should return 200 for OPTIONS requests', async () => {
      const mockClient = createMockSupabaseClient({});

      const response = await simulateCreditGateResponse(
        mockClient,
        'order_create_manual',
        handlerSpy,
        { method: 'OPTIONS' }
      );

      expect(response.status).toBe(200);
      expect(handlerSpy).not.toHaveBeenCalled();
    });
  });

  describe('unauthorized access', () => {
    it('should return 401 when no user found from JWT', async () => {
      const mockClient = createMockSupabaseClient({
        userId: null,
      });

      const response = await simulateCreditGateResponse(
        mockClient,
        'order_create_manual',
        handlerSpy
      );

      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.error).toBe('Unauthorized - no tenant found');
    });
  });
});

describe('withCreditGate — Source Code Contract Verification', () => {
  /**
   * These tests read the actual creditGate.ts source to verify it
   * implements the expected response contract, ensuring the simulation
   * tests above stay in sync with the real implementation.
   */

  let source: string;

  beforeEach(async () => {
    const fs = await import('fs');
    const path = await import('path');
    source = fs.readFileSync(
      path.resolve(__dirname, '..', '_shared', 'creditGate.ts'),
      'utf-8'
    );
  });

  it('should return status 402 for insufficient credits', () => {
    expect(source).toContain('status: 402');
  });

  it('should include INSUFFICIENT_CREDITS error code', () => {
    expect(source).toContain("code: 'INSUFFICIENT_CREDITS'");
  });

  it('should set X-Credits-Consumed response header', () => {
    expect(source).toContain("'X-Credits-Consumed'");
  });

  it('should set X-Credits-Remaining response header', () => {
    expect(source).toContain("'X-Credits-Remaining'");
  });

  it('should include creditsRequired in error response', () => {
    expect(source).toContain('creditsRequired');
  });

  it('should include currentBalance in error response', () => {
    expect(source).toContain('currentBalance');
  });

  it('should include actionKey in error response', () => {
    expect(source).toContain('actionKey');
  });

  it('should call consume_credits RPC', () => {
    expect(source).toContain("rpc('consume_credits'");
  });

  it('should check creditResult.success before returning 402', () => {
    expect(source).toContain('!creditResult.success');
  });

  it('should skip credit check for paid tiers by default', () => {
    expect(source).toContain('skipForPaidTiers');
    expect(source).toContain('!tenantInfo.isFreeTier');
  });

  it('should track blocked actions in credit_analytics', () => {
    expect(source).toContain('action_blocked_insufficient_credits');
    expect(source).toContain('credit_analytics');
  });

  it('should handle CORS preflight with OPTIONS method', () => {
    expect(source).toContain("req.method === 'OPTIONS'");
  });

  it('should extract tenant from JWT auth, never from request body', () => {
    // Verify it uses Authorization header
    expect(source).toContain("req.headers.get('Authorization')");
    // Verify the security note about not falling back to client-supplied tenant_id
    expect(source).toContain(
      'Never fall back to client-supplied tenant_id'
    );
  });
});
