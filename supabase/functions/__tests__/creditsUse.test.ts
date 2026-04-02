/**
 * Credits Use Edge Function Tests
 *
 * Verifies the credits-use endpoint handles:
 * - Auth: 401 for missing/invalid tokens (NOT 500)
 * - Validation: 400 for invalid request bodies
 * - Credit usage: 200 on success, 402 on insufficient credits
 * - CORS: proper headers on all responses
 * - Method: 405 for non-POST, 200 for OPTIONS preflight
 *
 * Since credits-use runs in Deno, these tests simulate the handler logic
 * with mock Supabase client responses (same pattern as creditGate.test.ts).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Schema — mirrors the edge function's RequestSchema
// ---------------------------------------------------------------------------

const RequestSchema = z.object({
  amount: z.number().int().positive('Amount must be a positive integer'),
  reference_type: z.string().min(1, 'reference_type is required'),
  reference_id: z.string().min(1, 'reference_id is required'),
  description: z.string().optional(),
});

// ---------------------------------------------------------------------------
// CORS headers matching deps.ts
// ---------------------------------------------------------------------------

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

// ---------------------------------------------------------------------------
// Mock Supabase client factory
// ---------------------------------------------------------------------------

interface MockRpcResult {
  success: boolean;
  new_balance: number;
  transaction_id: string;
  error?: string;
  current_balance?: number;
  shortfall?: number;
}

interface MockSupabaseOptions {
  userId?: string | null;
  authError?: { message: string } | null;
  tenantId?: string | null;
  tenantError?: { message: string } | null;
  rpcResult?: MockRpcResult | null;
  rpcError?: { message: string } | null;
}

function createMockSupabaseClient(options: MockSupabaseOptions = {}) {
  const {
    userId = 'user-123',
    authError = null,
    tenantId = 'tenant-456',
    tenantError = null,
    rpcResult = { success: true, new_balance: 950, transaction_id: 'txn-789' },
    rpcError = null,
  } = options;

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: userId ? { id: userId } : null },
        error: authError,
      }),
    },
    from: vi.fn().mockImplementation((table: string) => {
      if (table === 'tenant_users') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: tenantId ? { tenant_id: tenantId } : null,
                error: tenantError,
              }),
            }),
          }),
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
    rpc: vi.fn().mockResolvedValue({
      data: rpcResult,
      error: rpcError,
    }),
  };
}

// ---------------------------------------------------------------------------
// Simulated handler — mirrors credits-use/index.ts logic
// ---------------------------------------------------------------------------

async function simulateCreditsUse(
  mockClient: ReturnType<typeof createMockSupabaseClient>,
  requestOptions: {
    method?: string;
    authHeader?: string | null;
    body?: unknown;
    invalidJson?: boolean;
  } = {}
): Promise<Response> {
  const {
    method = 'POST',
    authHeader = 'Bearer test-jwt-token',
    body = { amount: 50, reference_type: 'order', reference_id: 'order-123' },
    invalidJson = false,
  } = requestOptions;

  // CORS preflight
  if (method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Method check
  if (method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    // Auth check — missing header
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized', code: 'MISSING_AUTH' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Auth check — invalid token
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await mockClient.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized', code: 'INVALID_TOKEN' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // JSON parse
    if (invalidJson) {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON body', code: 'INVALID_JSON' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate body
    const parseResult = RequestSchema.safeParse(body);

    if (!parseResult.success) {
      return new Response(
        JSON.stringify({
          error: 'Validation failed',
          code: 'INVALID_REQUEST',
          details: parseResult.error.errors,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { amount, reference_type, reference_id, description } = parseResult.data;

    // Tenant lookup
    const { data: tenantUser, error: tenantError } = await mockClient
      .from('tenant_users')
      .select('tenant_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (tenantError || !tenantUser?.tenant_id) {
      return new Response(
        JSON.stringify({ error: 'No tenant found for user', code: 'NO_TENANT' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tenantId = tenantUser.tenant_id;

    // RPC call
    const { data: result, error: rpcError } = await mockClient.rpc('update_credit_balance', {
      p_user_id: user.id,
      p_tenant_id: tenantId,
      p_amount: amount,
      p_transaction_type: 'usage',
      p_description: description || `Credit usage: ${reference_type}/${reference_id}`,
      p_reference_type: reference_type,
      p_reference_id: reference_id,
    });

    if (rpcError) {
      return new Response(
        JSON.stringify({
          error: 'Failed to process credit usage',
          code: 'RPC_ERROR',
          message: rpcError.message,
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!result || !result.success) {
      const errorCode = result?.error === 'Insufficient credits'
        ? 'INSUFFICIENT_CREDITS'
        : 'USAGE_FAILED';

      return new Response(
        JSON.stringify({
          error: result?.error || 'Credit usage failed',
          code: errorCode,
          current_balance: result?.current_balance ?? 0,
          required: amount,
          shortfall: result?.shortfall ?? 0,
        }),
        {
          status: errorCode === 'INSUFFICIENT_CREDITS' ? 402 : 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        new_balance: result.new_balance,
        transaction_id: result.transaction_id,
        amount_used: amount,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Internal server error', code: 'INTERNAL_ERROR' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('credits-use — Authentication', () => {
  it('should return 401 when no Authorization header is present', async () => {
    const mockClient = createMockSupabaseClient();
    const response = await simulateCreditsUse(mockClient, { authHeader: null });

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe('Unauthorized');
    expect(body.code).toBe('MISSING_AUTH');
  });

  it('should return 401 (NOT 500) for unauthenticated requests', async () => {
    const mockClient = createMockSupabaseClient();
    const response = await simulateCreditsUse(mockClient, { authHeader: null });

    expect(response.status).toBe(401);
    expect(response.status).not.toBe(500);
  });

  it('should return 401 when token is invalid', async () => {
    const mockClient = createMockSupabaseClient({
      userId: null,
      authError: { message: 'Invalid JWT' },
    });
    const response = await simulateCreditsUse(mockClient);

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.code).toBe('INVALID_TOKEN');
  });

  it('should return 401 when user is null (expired token)', async () => {
    const mockClient = createMockSupabaseClient({ userId: null });
    const response = await simulateCreditsUse(mockClient);

    expect(response.status).toBe(401);
  });

  it('should include CORS headers in 401 response', async () => {
    const mockClient = createMockSupabaseClient();
    const response = await simulateCreditsUse(mockClient, { authHeader: null });

    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(response.headers.get('Content-Type')).toBe('application/json');
  });
});

describe('credits-use — HTTP Methods', () => {
  it('should return 200 for OPTIONS preflight', async () => {
    const mockClient = createMockSupabaseClient();
    const response = await simulateCreditsUse(mockClient, { method: 'OPTIONS' });

    expect(response.status).toBe(200);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });

  it('should return 405 for GET requests', async () => {
    const mockClient = createMockSupabaseClient();
    const response = await simulateCreditsUse(mockClient, { method: 'GET' });

    expect(response.status).toBe(405);
    const body = await response.json();
    expect(body.error).toBe('Method not allowed');
  });

  it('should return 405 for PUT requests', async () => {
    const mockClient = createMockSupabaseClient();
    const response = await simulateCreditsUse(mockClient, { method: 'PUT' });

    expect(response.status).toBe(405);
  });
});

describe('credits-use — Request Validation', () => {
  it('should return 400 for invalid JSON body', async () => {
    const mockClient = createMockSupabaseClient();
    const response = await simulateCreditsUse(mockClient, { invalidJson: true });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.code).toBe('INVALID_JSON');
  });

  it('should return 400 when amount is missing', async () => {
    const mockClient = createMockSupabaseClient();
    const response = await simulateCreditsUse(mockClient, {
      body: { reference_type: 'order', reference_id: 'order-1' },
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.code).toBe('INVALID_REQUEST');
  });

  it('should return 400 when amount is negative', async () => {
    const mockClient = createMockSupabaseClient();
    const response = await simulateCreditsUse(mockClient, {
      body: { amount: -5, reference_type: 'order', reference_id: 'order-1' },
    });

    expect(response.status).toBe(400);
  });

  it('should return 400 when amount is zero', async () => {
    const mockClient = createMockSupabaseClient();
    const response = await simulateCreditsUse(mockClient, {
      body: { amount: 0, reference_type: 'order', reference_id: 'order-1' },
    });

    expect(response.status).toBe(400);
  });

  it('should return 400 when amount is a float', async () => {
    const mockClient = createMockSupabaseClient();
    const response = await simulateCreditsUse(mockClient, {
      body: { amount: 1.5, reference_type: 'order', reference_id: 'order-1' },
    });

    expect(response.status).toBe(400);
  });

  it('should return 400 when reference_type is empty', async () => {
    const mockClient = createMockSupabaseClient();
    const response = await simulateCreditsUse(mockClient, {
      body: { amount: 10, reference_type: '', reference_id: 'order-1' },
    });

    expect(response.status).toBe(400);
  });

  it('should return 400 when reference_id is missing', async () => {
    const mockClient = createMockSupabaseClient();
    const response = await simulateCreditsUse(mockClient, {
      body: { amount: 10, reference_type: 'order' },
    });

    expect(response.status).toBe(400);
  });
});

describe('credits-use — Tenant Lookup', () => {
  it('should return 403 when user has no tenant', async () => {
    const mockClient = createMockSupabaseClient({ tenantId: null });
    const response = await simulateCreditsUse(mockClient);

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.code).toBe('NO_TENANT');
  });

  it('should return 403 when tenant lookup errors', async () => {
    const mockClient = createMockSupabaseClient({
      tenantError: { message: 'DB error' },
    });
    const response = await simulateCreditsUse(mockClient);

    expect(response.status).toBe(403);
  });
});

describe('credits-use — Successful Credit Usage', () => {
  it('should return 200 with success body', async () => {
    const mockClient = createMockSupabaseClient({
      rpcResult: { success: true, new_balance: 950, transaction_id: 'txn-abc' },
    });
    const response = await simulateCreditsUse(mockClient);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.new_balance).toBe(950);
    expect(body.transaction_id).toBe('txn-abc');
    expect(body.amount_used).toBe(50);
  });

  it('should call update_credit_balance RPC with correct params', async () => {
    const mockClient = createMockSupabaseClient({
      rpcResult: { success: true, new_balance: 900, transaction_id: 'txn-1' },
    });

    await simulateCreditsUse(mockClient, {
      body: {
        amount: 100,
        reference_type: 'sms',
        reference_id: 'sms-456',
        description: 'SMS blast',
      },
    });

    expect(mockClient.rpc).toHaveBeenCalledWith('update_credit_balance', {
      p_user_id: 'user-123',
      p_tenant_id: 'tenant-456',
      p_amount: 100,
      p_transaction_type: 'usage',
      p_description: 'SMS blast',
      p_reference_type: 'sms',
      p_reference_id: 'sms-456',
    });
  });

  it('should use default description when none provided', async () => {
    const mockClient = createMockSupabaseClient({
      rpcResult: { success: true, new_balance: 900, transaction_id: 'txn-1' },
    });

    await simulateCreditsUse(mockClient, {
      body: { amount: 50, reference_type: 'order', reference_id: 'order-123' },
    });

    expect(mockClient.rpc).toHaveBeenCalledWith(
      'update_credit_balance',
      expect.objectContaining({
        p_description: 'Credit usage: order/order-123',
      })
    );
  });

  it('should include CORS headers in success response', async () => {
    const mockClient = createMockSupabaseClient();
    const response = await simulateCreditsUse(mockClient);

    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(response.headers.get('Content-Type')).toBe('application/json');
  });
});

describe('credits-use — Insufficient Credits', () => {
  it('should return 402 when credits are insufficient', async () => {
    const mockClient = createMockSupabaseClient({
      rpcResult: {
        success: false,
        new_balance: 0,
        transaction_id: '',
        error: 'Insufficient credits',
        current_balance: 10,
        shortfall: 40,
      },
    });
    const response = await simulateCreditsUse(mockClient);

    expect(response.status).toBe(402);
    const body = await response.json();
    expect(body.code).toBe('INSUFFICIENT_CREDITS');
    expect(body.current_balance).toBe(10);
    expect(body.required).toBe(50);
    expect(body.shortfall).toBe(40);
  });

  it('should return 500 for non-insufficient-credit failures', async () => {
    const mockClient = createMockSupabaseClient({
      rpcResult: {
        success: false,
        new_balance: 0,
        transaction_id: '',
        error: 'Unknown failure',
      },
    });
    const response = await simulateCreditsUse(mockClient);

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.code).toBe('USAGE_FAILED');
  });
});

describe('credits-use — RPC Errors', () => {
  it('should return 500 when RPC call fails', async () => {
    const mockClient = createMockSupabaseClient({
      rpcResult: null,
      rpcError: { message: 'Database connection failed' },
    });
    const response = await simulateCreditsUse(mockClient);

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.code).toBe('RPC_ERROR');
    expect(body.message).toBe('Database connection failed');
  });

  it('should return 500 when RPC returns null result', async () => {
    const mockClient = createMockSupabaseClient({ rpcResult: null, rpcError: null });
    const response = await simulateCreditsUse(mockClient);

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.code).toBe('USAGE_FAILED');
  });
});

describe('credits-use — Source Code Contract Verification', () => {
  let source: string;

  beforeEach(async () => {
    const fs = await import('fs');
    const path = await import('path');
    source = fs.readFileSync(
      path.resolve(__dirname, '..', 'credits-use', 'index.ts'),
      'utf-8'
    );
  });

  it('should check for Authorization header before parsing body', () => {
    const authCheckPos = source.indexOf("req.headers.get('Authorization')");
    const jsonParsePos = source.indexOf('req.json()');
    expect(authCheckPos).toBeGreaterThan(-1);
    expect(jsonParsePos).toBeGreaterThan(-1);
    expect(authCheckPos).toBeLessThan(jsonParsePos);
  });

  it('should return 401 for missing auth (not 500)', () => {
    expect(source).toContain("status: 401");
    expect(source).toContain("code: 'MISSING_AUTH'");
  });

  it('should return 401 for invalid token', () => {
    expect(source).toContain("code: 'INVALID_TOKEN'");
  });

  it('should return 400 for invalid JSON body', () => {
    expect(source).toContain("code: 'INVALID_JSON'");
  });

  it('should return 402 for insufficient credits', () => {
    expect(source).toContain('? 402 : 500');
    expect(source).toContain("'INSUFFICIENT_CREDITS'");
  });

  it('should return 405 for wrong HTTP method', () => {
    expect(source).toContain('status: 405');
  });

  it('should call update_credit_balance RPC', () => {
    expect(source).toContain("rpc('update_credit_balance'");
  });

  it('should use safeParse for body validation (not parse)', () => {
    expect(source).toContain('RequestSchema.safeParse');
    expect(source).not.toContain('RequestSchema.parse');
  });

  it('should use maybeSingle for tenant lookup', () => {
    expect(source).toContain('.maybeSingle()');
  });

  it('should handle CORS preflight', () => {
    expect(source).toContain("req.method === 'OPTIONS'");
  });
});
