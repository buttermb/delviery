/**
 * consumeCreditsOrFail Tests
 *
 * Verifies that consumeCreditsOrFail throws CreditError
 * when consume_credits RPC returns { success: false }.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { consumeCreditsOrFail, CreditError } from '../creditService';

// ============================================================================
// Mocks
// ============================================================================

const mockRpc = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// ============================================================================
// Test Data
// ============================================================================

const TEST_TENANT_ID = 'tenant-test-001';

// ============================================================================
// Tests
// ============================================================================

describe('consumeCreditsOrFail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should throw CreditError when consume_credits returns success: false', async () => {
    mockRpc.mockResolvedValue({
      data: {
        success: false,
        error: 'Insufficient credits',
        consumed: 0,
        balance: 30,
      },
      error: null,
    });

    await expect(
      consumeCreditsOrFail(TEST_TENANT_ID, 'menu_create', 'ref-001')
    ).rejects.toThrow(CreditError);
  });

  it('should include correct properties on thrown CreditError', async () => {
    mockRpc.mockResolvedValue({
      data: {
        success: false,
        error: 'Insufficient credits',
        consumed: 0,
        balance: 30,
      },
      error: null,
    });

    try {
      await consumeCreditsOrFail(TEST_TENANT_ID, 'menu_create', 'ref-002');
      expect.fail('Expected CreditError to be thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(CreditError);
      const creditErr = err as CreditError;
      expect(creditErr.code).toBe('INSUFFICIENT_CREDITS');
      expect(creditErr.actionKey).toBe('menu_create');
      expect(creditErr.creditsRequired).toBe(100); // menu_create costs 100
      expect(creditErr.currentBalance).toBe(30);
      expect(creditErr.name).toBe('CreditError');
    }
  });

  it('should use error_message from RPC as CreditError message', async () => {
    mockRpc.mockResolvedValue({
      data: {
        success: false,
        error: 'Custom insufficient error',
        consumed: 0,
        balance: 10,
      },
      error: null,
    });

    await expect(
      consumeCreditsOrFail(TEST_TENANT_ID, 'send_sms', 'sms-001')
    ).rejects.toThrow('Custom insufficient error');
  });

  it('should throw CreditError when RPC returns database error', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'Database connection failed' },
    });

    await expect(
      consumeCreditsOrFail(TEST_TENANT_ID, 'menu_create', 'ref-003')
    ).rejects.toThrow(CreditError);
  });

  it('should throw CreditError when RPC returns null data', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: null,
    });

    await expect(
      consumeCreditsOrFail(TEST_TENANT_ID, 'menu_create')
    ).rejects.toThrow(CreditError);
  });

  it('should return newBalance and creditsCost on success', async () => {
    mockRpc.mockResolvedValue({
      data: {
        success: true,
        consumed: 100,
        balance: 900,
      },
      error: null,
    });

    const result = await consumeCreditsOrFail(
      TEST_TENANT_ID,
      'menu_create',
      'ref-004',
      'Test menu creation'
    );

    expect(result.newBalance).toBe(900);
    expect(result.creditsCost).toBe(100);
  });

  it('should not throw when credits are sufficient', async () => {
    mockRpc.mockResolvedValue({
      data: {
        success: true,
        consumed: 25,
        balance: 975,
      },
      error: null,
    });

    await expect(
      consumeCreditsOrFail(TEST_TENANT_ID, 'send_sms', 'sms-ok')
    ).resolves.toEqual({
      newBalance: 975,
      creditsCost: 25,
    });
  });

  it('should pass all parameters through to consumeCredits', async () => {
    mockRpc.mockResolvedValue({
      data: {
        success: true,
        consumed: 50,
        balance: 950,
      },
      error: null,
    });

    const metadata = { source: 'test' };

    await consumeCreditsOrFail(
      TEST_TENANT_ID,
      'order_create_manual',
      'order-001',
      'Manual order',
      metadata
    );

    expect(mockRpc).toHaveBeenCalledWith('consume_credits', {
      p_tenant_id: TEST_TENANT_ID,
      p_amount: 50,
      p_action_key: 'order_create_manual',
      p_description: 'Manual order',
      p_reference_id: 'order-001',
      p_metadata: metadata,
    });
  });

  it('should fallback to getCreditCost when consumed is 0 in error response', async () => {
    mockRpc.mockResolvedValue({
      data: {
        success: false,
        error: 'Not enough credits',
        consumed: 0,
        balance: 5,
      },
      error: null,
    });

    try {
      await consumeCreditsOrFail(TEST_TENANT_ID, 'send_sms');
      expect.fail('Expected CreditError to be thrown');
    } catch (err) {
      const creditErr = err as CreditError;
      // When consumed is 0 (falsy), creditsRequired falls back to getCreditCost
      expect(creditErr.creditsRequired).toBe(25); // send_sms costs 25
      expect(creditErr.currentBalance).toBe(5);
    }
  });
});

// ============================================================================
// CreditError class tests
// ============================================================================

describe('CreditError', () => {
  it('should be an instance of Error', () => {
    const err = new CreditError({
      actionKey: 'menu_create',
      creditsRequired: 100,
      currentBalance: 30,
    });

    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(CreditError);
  });

  it('should have correct name property', () => {
    const err = new CreditError({
      actionKey: 'menu_create',
      creditsRequired: 100,
      currentBalance: 30,
    });

    expect(err.name).toBe('CreditError');
  });

  it('should generate default message when none provided', () => {
    const err = new CreditError({
      actionKey: 'send_sms',
      creditsRequired: 25,
      currentBalance: 10,
    });

    expect(err.message).toBe(
      'Insufficient credits for send_sms: need 25, have 10'
    );
  });

  it('should use custom message when provided', () => {
    const err = new CreditError({
      actionKey: 'send_sms',
      creditsRequired: 25,
      currentBalance: 10,
      message: 'Custom error message',
    });

    expect(err.message).toBe('Custom error message');
  });

  it('should expose readonly code property', () => {
    const err = new CreditError({
      actionKey: 'menu_create',
      creditsRequired: 100,
      currentBalance: 0,
    });

    expect(err.code).toBe('INSUFFICIENT_CREDITS');
  });
});
