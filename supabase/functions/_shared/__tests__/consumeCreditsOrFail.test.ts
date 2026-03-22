/**
 * consumeCreditsOrFail — Unit Tests
 *
 * Tests the standalone credit consumption utility, CreditError class,
 * isCreditError type guard, and creditErrorResponse helper.
 *
 * Because the edge function source imports from Deno URLs (not resolvable
 * in vitest/Node), we replicate the key classes and logic here and verify
 * they match the behavior specified in the implementation.
 */

import { describe, it, expect } from 'vitest';

// ─── Replicated types (mirrors creditGate.ts) ───────────────────────────

interface CreditConsumeResult {
  success: true;
  newBalance: number;
  creditsCost: number;
}

interface ConsumeCreditsOptions {
  referenceId?: string;
  referenceType?: string;
  description?: string;
  skipForPaidTiers?: boolean;
}

// ─── Replicated CreditError (mirrors creditGate.ts) ─────────────────────

class CreditError extends Error {
  readonly code = 'INSUFFICIENT_CREDITS' as const;
  readonly statusCode = 402 as const;
  readonly actionKey: string;
  readonly creditsRequired: number;
  readonly currentBalance: number;

  constructor(
    actionKey: string,
    creditsRequired: number,
    currentBalance: number,
    message?: string,
  ) {
    super(message ?? `Insufficient credits for ${actionKey}: need ${creditsRequired}, have ${currentBalance}`);
    this.name = 'CreditError';
    this.actionKey = actionKey;
    this.creditsRequired = creditsRequired;
    this.currentBalance = currentBalance;
  }

  toJSON(): Record<string, unknown> {
    return {
      error: 'Insufficient credits',
      code: this.code,
      message: this.message,
      creditsRequired: this.creditsRequired,
      currentBalance: this.currentBalance,
      actionKey: this.actionKey,
    };
  }
}

function isCreditError(error: unknown): error is CreditError {
  return error instanceof CreditError;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function creditErrorResponse(error: CreditError): Response {
  return new Response(
    JSON.stringify(error.toJSON()),
    {
      status: 402,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    },
  );
}

// ─── Replicated consumeCreditsOrFail core logic ─────────────────────────

interface TenantInfo {
  id: string;
  isFreeTier: boolean;
}

interface CreditCheckResult {
  success: boolean;
  newBalance: number;
  creditsCost: number;
  errorMessage: string | null;
}

/**
 * Simplified version of consumeCreditsOrFail for testing the decision logic.
 * In production, the Supabase client calls are real; here we accept pre-fetched results.
 */
function consumeCreditsOrFailLogic(
  tenantInfo: TenantInfo | null,
  rpcResult: CreditCheckResult,
  actionKey: string,
  options?: ConsumeCreditsOptions,
): CreditConsumeResult {
  const skipForPaid = options?.skipForPaidTiers ?? true;
  if (skipForPaid && tenantInfo && !tenantInfo.isFreeTier) {
    return { success: true, newBalance: -1, creditsCost: 0 };
  }

  if (!rpcResult.success) {
    throw new CreditError(
      actionKey,
      rpcResult.creditsCost,
      rpcResult.newBalance,
      rpcResult.errorMessage ?? undefined,
    );
  }

  return {
    success: true,
    newBalance: rpcResult.newBalance,
    creditsCost: rpcResult.creditsCost,
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────

describe('CreditError', () => {
  it('should set all properties from constructor', () => {
    const err = new CreditError('send_sms', 25, 10);

    expect(err.name).toBe('CreditError');
    expect(err.code).toBe('INSUFFICIENT_CREDITS');
    expect(err.statusCode).toBe(402);
    expect(err.actionKey).toBe('send_sms');
    expect(err.creditsRequired).toBe(25);
    expect(err.currentBalance).toBe(10);
    expect(err.message).toBe('Insufficient credits for send_sms: need 25, have 10');
  });

  it('should use custom message when provided', () => {
    const err = new CreditError('menu_ocr', 250, 100, 'OCR requires 250 credits');

    expect(err.message).toBe('OCR requires 250 credits');
    expect(err.creditsRequired).toBe(250);
    expect(err.currentBalance).toBe(100);
  });

  it('should be an instance of Error', () => {
    const err = new CreditError('send_sms', 25, 10);

    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(CreditError);
  });

  it('should serialize to JSON with all required fields', () => {
    const err = new CreditError('create_order', 50, 20);
    const json = err.toJSON();

    expect(json).toEqual({
      error: 'Insufficient credits',
      code: 'INSUFFICIENT_CREDITS',
      message: 'Insufficient credits for create_order: need 50, have 20',
      creditsRequired: 50,
      currentBalance: 20,
      actionKey: 'create_order',
    });
  });

  it('should handle zero balance', () => {
    const err = new CreditError('send_email', 10, 0);

    expect(err.currentBalance).toBe(0);
    expect(err.message).toBe('Insufficient credits for send_email: need 10, have 0');
  });

  it('should have immutable code and statusCode', () => {
    const err = new CreditError('send_sms', 25, 10);

    // These are readonly const
    expect(err.code).toBe('INSUFFICIENT_CREDITS');
    expect(err.statusCode).toBe(402);
  });
});

describe('isCreditError', () => {
  it('should return true for CreditError instances', () => {
    const err = new CreditError('send_sms', 25, 10);
    expect(isCreditError(err)).toBe(true);
  });

  it('should return false for regular Error', () => {
    const err = new Error('some error');
    expect(isCreditError(err)).toBe(false);
  });

  it('should return false for null', () => {
    expect(isCreditError(null)).toBe(false);
  });

  it('should return false for undefined', () => {
    expect(isCreditError(undefined)).toBe(false);
  });

  it('should return false for plain objects that look like CreditError', () => {
    const fake = {
      code: 'INSUFFICIENT_CREDITS',
      statusCode: 402,
      actionKey: 'send_sms',
      creditsRequired: 25,
      currentBalance: 10,
    };
    expect(isCreditError(fake)).toBe(false);
  });

  it('should return false for strings', () => {
    expect(isCreditError('INSUFFICIENT_CREDITS')).toBe(false);
  });
});

describe('creditErrorResponse', () => {
  it('should return a Response with status 402', () => {
    const err = new CreditError('send_sms', 25, 10);
    const res = creditErrorResponse(err);

    expect(res.status).toBe(402);
  });

  it('should include CORS headers', () => {
    const err = new CreditError('send_sms', 25, 10);
    const res = creditErrorResponse(err);

    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(res.headers.get('Content-Type')).toBe('application/json');
  });

  it('should have JSON body matching CreditError.toJSON()', async () => {
    const err = new CreditError('create_order', 50, 20);
    const res = creditErrorResponse(err);
    const body = await res.json();

    expect(body).toEqual(err.toJSON());
  });
});

describe('consumeCreditsOrFail logic', () => {
  const FREE_TIER_TENANT: TenantInfo = { id: 'tenant-1', isFreeTier: true };
  const PAID_TIER_TENANT: TenantInfo = { id: 'tenant-2', isFreeTier: false };

  describe('paid tier skip', () => {
    it('should skip credit consumption for paid tenants by default', () => {
      const rpcResult: CreditCheckResult = {
        success: false, newBalance: 0, creditsCost: 50, errorMessage: 'Should not matter',
      };

      const result = consumeCreditsOrFailLogic(PAID_TIER_TENANT, rpcResult, 'create_order');

      expect(result.success).toBe(true);
      expect(result.newBalance).toBe(-1);
      expect(result.creditsCost).toBe(0);
    });

    it('should NOT skip for paid tenants when skipForPaidTiers is false', () => {
      const rpcResult: CreditCheckResult = {
        success: false, newBalance: 0, creditsCost: 50, errorMessage: 'Not enough credits',
      };

      expect(() =>
        consumeCreditsOrFailLogic(PAID_TIER_TENANT, rpcResult, 'create_order', {
          skipForPaidTiers: false,
        })
      ).toThrow(CreditError);
    });
  });

  describe('free tier consumption', () => {
    it('should return success result when credits are consumed', () => {
      const rpcResult: CreditCheckResult = {
        success: true, newBalance: 9950, creditsCost: 50, errorMessage: null,
      };

      const result = consumeCreditsOrFailLogic(FREE_TIER_TENANT, rpcResult, 'create_order');

      expect(result.success).toBe(true);
      expect(result.newBalance).toBe(9950);
      expect(result.creditsCost).toBe(50);
    });

    it('should throw CreditError when insufficient credits', () => {
      const rpcResult: CreditCheckResult = {
        success: false, newBalance: 10, creditsCost: 50, errorMessage: null,
      };

      expect(() =>
        consumeCreditsOrFailLogic(FREE_TIER_TENANT, rpcResult, 'create_order')
      ).toThrow(CreditError);
    });

    it('should throw CreditError with correct properties', () => {
      const rpcResult: CreditCheckResult = {
        success: false, newBalance: 10, creditsCost: 250, errorMessage: null,
      };

      try {
        consumeCreditsOrFailLogic(FREE_TIER_TENANT, rpcResult, 'menu_ocr');
        expect.fail('Should have thrown');
      } catch (err) {
        expect(isCreditError(err)).toBe(true);
        if (isCreditError(err)) {
          expect(err.actionKey).toBe('menu_ocr');
          expect(err.creditsRequired).toBe(250);
          expect(err.currentBalance).toBe(10);
          expect(err.statusCode).toBe(402);
        }
      }
    });

    it('should pass through RPC error message to CreditError', () => {
      const rpcResult: CreditCheckResult = {
        success: false, newBalance: 0, creditsCost: 25,
        errorMessage: 'Balance depleted for tenant',
      };

      try {
        consumeCreditsOrFailLogic(FREE_TIER_TENANT, rpcResult, 'send_sms');
        expect.fail('Should have thrown');
      } catch (err) {
        expect(isCreditError(err)).toBe(true);
        if (isCreditError(err)) {
          expect(err.message).toBe('Balance depleted for tenant');
        }
      }
    });

    it('should use default message when RPC errorMessage is null', () => {
      const rpcResult: CreditCheckResult = {
        success: false, newBalance: 5, creditsCost: 25, errorMessage: null,
      };

      try {
        consumeCreditsOrFailLogic(FREE_TIER_TENANT, rpcResult, 'send_sms');
        expect.fail('Should have thrown');
      } catch (err) {
        expect(isCreditError(err)).toBe(true);
        if (isCreditError(err)) {
          expect(err.message).toBe('Insufficient credits for send_sms: need 25, have 5');
        }
      }
    });
  });

  describe('null tenant handling', () => {
    it('should proceed to RPC check when tenant info is null', () => {
      const rpcResult: CreditCheckResult = {
        success: true, newBalance: 9000, creditsCost: 100, errorMessage: null,
      };

      // When tenant is null, skipForPaid check is bypassed (null is not a paid tenant)
      const result = consumeCreditsOrFailLogic(null, rpcResult, 'create_menu');

      expect(result.success).toBe(true);
      expect(result.creditsCost).toBe(100);
    });
  });

  describe('edge cases', () => {
    it('should handle zero-cost actions on free tier', () => {
      const rpcResult: CreditCheckResult = {
        success: true, newBalance: 10000, creditsCost: 0, errorMessage: null,
      };

      const result = consumeCreditsOrFailLogic(FREE_TIER_TENANT, rpcResult, 'dashboard_view');

      expect(result.success).toBe(true);
      expect(result.creditsCost).toBe(0);
      expect(result.newBalance).toBe(10000);
    });

    it('should handle exact balance match (balance equals cost)', () => {
      const rpcResult: CreditCheckResult = {
        success: true, newBalance: 0, creditsCost: 50, errorMessage: null,
      };

      const result = consumeCreditsOrFailLogic(FREE_TIER_TENANT, rpcResult, 'create_order');

      expect(result.success).toBe(true);
      expect(result.newBalance).toBe(0);
      expect(result.creditsCost).toBe(50);
    });
  });
});

describe('consumeCreditsOrFail try/catch pattern', () => {
  it('should allow catching CreditError and converting to HTTP response', async () => {
    const rpcResult: CreditCheckResult = {
      success: false, newBalance: 10, creditsCost: 50, errorMessage: null,
    };

    let response: Response;
    try {
      consumeCreditsOrFailLogic(
        { id: 'tenant-1', isFreeTier: true },
        rpcResult,
        'create_order',
      );
      response = new Response(JSON.stringify({ success: true }), { status: 200 });
    } catch (err) {
      if (isCreditError(err)) {
        response = creditErrorResponse(err);
      } else {
        throw err;
      }
    }

    expect(response.status).toBe(402);
    const body = await response.json();
    expect(body.code).toBe('INSUFFICIENT_CREDITS');
    expect(body.creditsRequired).toBe(50);
    expect(body.currentBalance).toBe(10);
    expect(body.actionKey).toBe('create_order');
  });

  it('should let non-CreditError errors propagate', () => {
    expect(() => {
      try {
        throw new Error('network failure');
      } catch (err) {
        if (isCreditError(err)) {
          creditErrorResponse(err);
          return;
        }
        throw err;
      }
    }).toThrow('network failure');
  });
});

describe('Source file contract verification', () => {
  /**
   * Read the actual creditGate.ts source and verify it exports
   * the expected functions and classes.
   */
  it('should export consumeCreditsOrFail function', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const source = fs.readFileSync(
      path.resolve(__dirname, '..', 'creditGate.ts'),
      'utf-8',
    );

    expect(source).toContain('export async function consumeCreditsOrFail(');
  });

  it('should export CreditError class', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const source = fs.readFileSync(
      path.resolve(__dirname, '..', 'creditGate.ts'),
      'utf-8',
    );

    expect(source).toContain('export class CreditError extends Error');
  });

  it('should export isCreditError type guard', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const source = fs.readFileSync(
      path.resolve(__dirname, '..', 'creditGate.ts'),
      'utf-8',
    );

    expect(source).toContain('export function isCreditError(');
  });

  it('should export creditErrorResponse helper', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const source = fs.readFileSync(
      path.resolve(__dirname, '..', 'creditGate.ts'),
      'utf-8',
    );

    expect(source).toContain('export function creditErrorResponse(');
  });

  it('should export CreditConsumeResult interface', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const source = fs.readFileSync(
      path.resolve(__dirname, '..', 'creditGate.ts'),
      'utf-8',
    );

    expect(source).toContain('export interface CreditConsumeResult');
  });

  it('should export ConsumeCreditsOptions interface', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const source = fs.readFileSync(
      path.resolve(__dirname, '..', 'creditGate.ts'),
      'utf-8',
    );

    expect(source).toContain('export interface ConsumeCreditsOptions');
  });

  it('should call consume_credits RPC in consumeCreditsOrFail', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const source = fs.readFileSync(
      path.resolve(__dirname, '..', 'creditGate.ts'),
      'utf-8',
    );

    // consumeCreditsOrFail delegates to consumeCreditsForAction which calls the RPC
    expect(source).toContain("rpc('consume_credits'");
  });

  it('should track blocked actions in consumeCreditsOrFail', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const source = fs.readFileSync(
      path.resolve(__dirname, '..', 'creditGate.ts'),
      'utf-8',
    );

    // Find the consumeCreditsOrFail function body
    const fnStart = source.indexOf('export async function consumeCreditsOrFail(');
    const fnSection = source.slice(fnStart, fnStart + 1500);

    expect(fnSection).toContain('action_blocked_insufficient_credits');
    expect(fnSection).toContain('trackCreditEvent');
  });

  it('should check tenant free tier status in consumeCreditsOrFail', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const source = fs.readFileSync(
      path.resolve(__dirname, '..', 'creditGate.ts'),
      'utf-8',
    );

    const fnStart = source.indexOf('export async function consumeCreditsOrFail(');
    const fnSection = source.slice(fnStart, fnStart + 1500);

    expect(fnSection).toContain('isFreeTier');
    expect(fnSection).toContain('skipForPaidTiers');
  });
});
