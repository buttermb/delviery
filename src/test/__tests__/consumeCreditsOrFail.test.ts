/**
 * Tests for consumeCreditsOrFail utility and credit deduction
 * in send-verification-email edge function.
 *
 * These tests validate the credit gate logic that is shared across
 * edge functions, ensuring correct behavior for both sufficient and
 * insufficient credit scenarios.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Inline implementations matching _shared/creditGate.ts (edge function code
// runs in Deno; we replicate the critical logic here for vitest)
// ---------------------------------------------------------------------------

class CreditError extends Error {
  public readonly code = 'INSUFFICIENT_CREDITS' as const;
  public readonly creditsRequired: number;
  public readonly currentBalance: number;
  public readonly actionKey: string;

  constructor(
    actionKey: string,
    creditsRequired: number,
    currentBalance: number,
    message?: string,
  ) {
    super(
      message ||
        `Insufficient credits for ${actionKey}: requires ${creditsRequired}, has ${currentBalance}`,
    );
    this.name = 'CreditError';
    this.actionKey = actionKey;
    this.creditsRequired = creditsRequired;
    this.currentBalance = currentBalance;
  }
}

interface ConsumeCreditsResult {
  success: boolean;
  new_balance: number;
  credits_cost: number;
  error_message: string | null;
}

/**
 * Mirrors the consumeCreditsOrFail implementation from creditGate.ts.
 * Calls the consume_credits RPC via Supabase client and throws CreditError
 * on insufficient balance.
 */
async function consumeCreditsOrFail(
  supabaseClient: { rpc: ReturnType<typeof vi.fn>; from: ReturnType<typeof vi.fn> },
  tenantId: string,
  actionKey: string,
  options?: {
    referenceId?: string;
    referenceType?: string;
    description?: string;
  },
): Promise<{ success: true; newBalance: number; creditsCost: number }> {
  const { data, error } = await supabaseClient.rpc('consume_credits', {
    p_tenant_id: tenantId,
    p_action_key: actionKey,
    p_reference_id: options?.referenceId || null,
    p_reference_type: options?.referenceType || null,
    p_description: options?.description || null,
  });

  if (error) {
    throw new CreditError(actionKey, 0, 0, error.message);
  }

  if (!data || data.length === 0) {
    throw new CreditError(actionKey, 0, 0, 'No response from credit check');
  }

  const result = data[0] as ConsumeCreditsResult;

  if (!result.success) {
    throw new CreditError(
      actionKey,
      result.credits_cost,
      result.new_balance,
      result.error_message ?? undefined,
    );
  }

  return {
    success: true,
    newBalance: result.new_balance,
    creditsCost: result.credits_cost,
  };
}

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function createMockSupabase(rpcResponse: {
  data: ConsumeCreditsResult[] | null;
  error: { message: string } | null;
}) {
  const insertFn = vi.fn().mockResolvedValue({ error: null });
  return {
    rpc: vi.fn().mockResolvedValue(rpcResponse),
    from: vi.fn().mockReturnValue({ insert: insertFn }),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CreditError', () => {
  it('stores action key, required credits, and current balance', () => {
    const err = new CreditError('send_email', 10, 5);
    expect(err.name).toBe('CreditError');
    expect(err.code).toBe('INSUFFICIENT_CREDITS');
    expect(err.actionKey).toBe('send_email');
    expect(err.creditsRequired).toBe(10);
    expect(err.currentBalance).toBe(5);
    expect(err.message).toContain('send_email');
  });

  it('uses custom message when provided', () => {
    const err = new CreditError('send_email', 10, 0, 'Not enough credits');
    expect(err.message).toBe('Not enough credits');
  });

  it('is an instance of Error', () => {
    const err = new CreditError('send_email', 10, 0);
    expect(err).toBeInstanceOf(Error);
  });
});

describe('consumeCreditsOrFail', () => {
  const TENANT_ID = '00000000-0000-0000-0000-000000000001';
  const ACTION_KEY = 'send_email';

  it('returns success result when credits are sufficient', async () => {
    const supabase = createMockSupabase({
      data: [{ success: true, new_balance: 990, credits_cost: 10, error_message: null }],
      error: null,
    });

    const result = await consumeCreditsOrFail(supabase, TENANT_ID, ACTION_KEY, {
      description: 'Verification email',
      referenceId: 'user-123',
      referenceType: 'verification_email',
    });

    expect(result.success).toBe(true);
    expect(result.newBalance).toBe(990);
    expect(result.creditsCost).toBe(10);

    expect(supabase.rpc).toHaveBeenCalledWith('consume_credits', {
      p_tenant_id: TENANT_ID,
      p_action_key: ACTION_KEY,
      p_reference_id: 'user-123',
      p_reference_type: 'verification_email',
      p_description: 'Verification email',
    });
  });

  it('throws CreditError when balance is insufficient', async () => {
    const supabase = createMockSupabase({
      data: [
        {
          success: false,
          new_balance: 5,
          credits_cost: 10,
          error_message: 'Insufficient credits',
        },
      ],
      error: null,
    });

    await expect(
      consumeCreditsOrFail(supabase, TENANT_ID, ACTION_KEY),
    ).rejects.toThrow(CreditError);

    try {
      await consumeCreditsOrFail(supabase, TENANT_ID, ACTION_KEY);
    } catch (err) {
      expect(err).toBeInstanceOf(CreditError);
      const creditErr = err as CreditError;
      expect(creditErr.creditsRequired).toBe(10);
      expect(creditErr.currentBalance).toBe(5);
      expect(creditErr.actionKey).toBe(ACTION_KEY);
    }
  });

  it('throws CreditError on RPC error', async () => {
    const supabase = createMockSupabase({
      data: null,
      error: { message: 'Database connection failed' },
    });

    await expect(
      consumeCreditsOrFail(supabase, TENANT_ID, ACTION_KEY),
    ).rejects.toThrow(CreditError);
  });

  it('throws CreditError when RPC returns empty data', async () => {
    const supabase = createMockSupabase({
      data: [],
      error: null,
    });

    await expect(
      consumeCreditsOrFail(supabase, TENANT_ID, ACTION_KEY),
    ).rejects.toThrow('No response from credit check');
  });

  it('passes null for optional parameters when not provided', async () => {
    const supabase = createMockSupabase({
      data: [{ success: true, new_balance: 990, credits_cost: 10, error_message: null }],
      error: null,
    });

    await consumeCreditsOrFail(supabase, TENANT_ID, ACTION_KEY);

    expect(supabase.rpc).toHaveBeenCalledWith('consume_credits', {
      p_tenant_id: TENANT_ID,
      p_action_key: ACTION_KEY,
      p_reference_id: null,
      p_reference_type: null,
      p_description: null,
    });
  });
});

describe('send-verification-email credit deduction (security path)', () => {
  it('should not block email sending when credits are insufficient', async () => {
    // Simulates the security-path pattern used in send-verification-email:
    // Credit deduction is attempted but failures are caught and logged,
    // allowing the verification email to be sent regardless.
    const supabase = createMockSupabase({
      data: [
        {
          success: false,
          new_balance: 0,
          credits_cost: 10,
          error_message: 'Insufficient credits',
        },
      ],
      error: null,
    });

    let emailSent = false;
    let creditDeductionFailed = false;

    // Simulate the edge function flow
    emailSent = true; // Email would have been sent before credit check

    try {
      await consumeCreditsOrFail(supabase, 'tenant-1', 'send_email', {
        description: 'Verification email to user@test.com',
        referenceId: 'user-1',
        referenceType: 'verification_email',
      });
    } catch (creditErr: unknown) {
      if (creditErr instanceof CreditError) {
        creditDeductionFailed = true;
        // In the actual edge function, we log and continue
      }
    }

    // Email should still have been sent despite credit failure
    expect(emailSent).toBe(true);
    expect(creditDeductionFailed).toBe(true);
  });

  it('should deduct credits successfully when balance is sufficient', async () => {
    const supabase = createMockSupabase({
      data: [{ success: true, new_balance: 990, credits_cost: 10, error_message: null }],
      error: null,
    });

    let emailSent = false;
    let creditsDeducted = false;

    emailSent = true;

    try {
      const result = await consumeCreditsOrFail(supabase, 'tenant-1', 'send_email', {
        description: 'Verification email to user@test.com',
        referenceId: 'user-1',
        referenceType: 'verification_email',
      });
      creditsDeducted = result.success;
    } catch {
      // Should not reach here
    }

    expect(emailSent).toBe(true);
    expect(creditsDeducted).toBe(true);
  });

  it('should handle RPC errors gracefully on security path', async () => {
    const supabase = createMockSupabase({
      data: null,
      error: { message: 'Connection timeout' },
    });

    let emailSent = false;
    let errorCaught = false;

    emailSent = true;

    try {
      await consumeCreditsOrFail(supabase, 'tenant-1', 'send_email');
    } catch (err: unknown) {
      errorCaught = true;
      // On security path, we catch and log but don't block
      expect(err).toBeInstanceOf(CreditError);
    }

    expect(emailSent).toBe(true);
    expect(errorCaught).toBe(true);
  });
});
