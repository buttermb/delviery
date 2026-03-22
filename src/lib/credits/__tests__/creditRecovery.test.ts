/**
 * Credit Recovery Tests
 *
 * Tests refundCredits, recoverFailedAction, directRefund, batchRefund,
 * isTransactionRefunded, and getRefundHistory.
 * Verifies that credits are properly added back after failed actions.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  refundCredits,
  recoverFailedAction,
  directRefund,
  batchRefund,
  isTransactionRefunded,
  getRefundHistory,
} from '../creditRecovery';
import type { RefundRequest } from '../creditRecovery';

// ============================================================================
// Mocks
// ============================================================================

const mockRpc = vi.fn();
const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockMaybeSingle = vi.fn();
const mockOrder = vi.fn();
const mockLimit = vi.fn();
const mockInsert = vi.fn();

// Default return for limit() — can be overridden per test via mockLimit.mockReturnValueOnce
mockLimit.mockReturnValue({ data: [], error: null });

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
    from: (...args: unknown[]) => {
      mockFrom(...args);
      return {
        select: (...selectArgs: unknown[]) => {
          mockSelect(...selectArgs);
          return {
            eq: (...eqArgs: unknown[]) => {
              mockEq(...eqArgs);
              return {
                eq: (...innerEqArgs: unknown[]) => {
                  mockEq(...innerEqArgs);
                  return {
                    maybeSingle: () => mockMaybeSingle(),
                    order: (...orderArgs: unknown[]) => {
                      mockOrder(...orderArgs);
                      return {
                        limit: (...limitArgs: unknown[]) => mockLimit(...limitArgs),
                      };
                    },
                  };
                },
                maybeSingle: () => mockMaybeSingle(),
                order: (...orderArgs: unknown[]) => {
                  mockOrder(...orderArgs);
                  return {
                    limit: (...limitArgs: unknown[]) => mockLimit(...limitArgs),
                  };
                },
              };
            },
          };
        },
        insert: (...insertArgs: unknown[]) => {
          mockInsert(...insertArgs);
          return { data: null, error: null };
        },
      };
    },
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

const TEST_TENANT_ID = 'tenant-test-recovery-001';
const TEST_TRANSACTION_ID = 'txn-sms-failed-001';

// ============================================================================
// refundCredits Tests
// ============================================================================

describe('refundCredits', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call refund_credits RPC with correct parameters', async () => {
    mockRpc.mockResolvedValue({
      data: { amount: 25 },
      error: null,
    });

    const request: RefundRequest = {
      transactionId: TEST_TRANSACTION_ID,
      tenantId: TEST_TENANT_ID,
      reason: 'failed_action',
      notes: 'SMS delivery failed',
    };

    await refundCredits(request);

    expect(mockRpc).toHaveBeenCalledWith('refund_credits', {
      p_transaction_id: TEST_TRANSACTION_ID,
      p_tenant_id: TEST_TENANT_ID,
      p_reason: 'failed_action',
      p_notes: 'SMS delivery failed',
    });
  });

  it('should return success with refunded amount after failed action', async () => {
    mockRpc.mockResolvedValue({
      data: { amount: 25 },
      error: null,
    });

    const request: RefundRequest = {
      transactionId: TEST_TRANSACTION_ID,
      tenantId: TEST_TENANT_ID,
      reason: 'failed_action',
      notes: 'SMS delivery failed',
    };

    const result = await refundCredits(request);

    expect(result.success).toBe(true);
    expect(result.refundedAmount).toBe(25);
    expect(result.error).toBeUndefined();
  });

  it('should return failure when RPC returns error', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'Transaction not found' },
    });

    const request: RefundRequest = {
      transactionId: 'txn-nonexistent',
      tenantId: TEST_TENANT_ID,
      reason: 'failed_action',
    };

    const result = await refundCredits(request);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Transaction not found');
    expect(result.refundedAmount).toBeUndefined();
  });

  it('should handle exceptions gracefully', async () => {
    mockRpc.mockRejectedValue(new Error('Network timeout'));

    const request: RefundRequest = {
      transactionId: TEST_TRANSACTION_ID,
      tenantId: TEST_TENANT_ID,
      reason: 'service_error',
    };

    const result = await refundCredits(request);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Network timeout');
  });

  it('should default notes to empty string when not provided', async () => {
    mockRpc.mockResolvedValue({
      data: { amount: 50 },
      error: null,
    });

    const request: RefundRequest = {
      transactionId: TEST_TRANSACTION_ID,
      tenantId: TEST_TENANT_ID,
      reason: 'duplicate_charge',
    };

    await refundCredits(request);

    expect(mockRpc).toHaveBeenCalledWith('refund_credits', {
      p_transaction_id: TEST_TRANSACTION_ID,
      p_tenant_id: TEST_TENANT_ID,
      p_reason: 'duplicate_charge',
      p_notes: '',
    });
  });

  it('should return 0 refunded amount when RPC data.amount is null', async () => {
    mockRpc.mockResolvedValue({
      data: { amount: null },
      error: null,
    });

    const request: RefundRequest = {
      transactionId: TEST_TRANSACTION_ID,
      tenantId: TEST_TENANT_ID,
      reason: 'system_error',
    };

    const result = await refundCredits(request);

    expect(result.success).toBe(true);
    expect(result.refundedAmount).toBe(0);
  });

  it('should handle all valid refund reasons', async () => {
    const reasons: RefundRequest['reason'][] = [
      'failed_action',
      'duplicate_charge',
      'service_error',
      'customer_request',
      'system_error',
      'other',
    ];

    for (const reason of reasons) {
      mockRpc.mockResolvedValueOnce({
        data: { amount: 10 },
        error: null,
      });

      const result = await refundCredits({
        transactionId: TEST_TRANSACTION_ID,
        tenantId: TEST_TENANT_ID,
        reason,
      });

      expect(result.success).toBe(true);
    }

    expect(mockRpc).toHaveBeenCalledTimes(reasons.length);
  });
});

// ============================================================================
// recoverFailedAction Tests
// ============================================================================

describe('recoverFailedAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call recover_failed_credits RPC with correct parameters', async () => {
    mockRpc.mockResolvedValue({
      data: { recovered: 25 },
      error: null,
    });

    await recoverFailedAction(TEST_TENANT_ID, 'send_sms', 'txn-sms-001');

    expect(mockRpc).toHaveBeenCalledWith('recover_failed_credits', {
      p_tenant_id: TEST_TENANT_ID,
      p_action_type: 'send_sms',
      p_transaction_id: 'txn-sms-001',
    });
  });

  it('should return recovered credits amount on success', async () => {
    mockRpc.mockResolvedValue({
      data: { recovered: 25 },
      error: null,
    });

    const result = await recoverFailedAction(TEST_TENANT_ID, 'send_sms', 'txn-sms-001');

    expect(result.success).toBe(true);
    expect(result.creditsRecovered).toBe(25);
    expect(result.error).toBeUndefined();
  });

  it('should pass null transaction_id when not provided', async () => {
    mockRpc.mockResolvedValue({
      data: { recovered: 100 },
      error: null,
    });

    await recoverFailedAction(TEST_TENANT_ID, 'menu_create');

    expect(mockRpc).toHaveBeenCalledWith('recover_failed_credits', {
      p_tenant_id: TEST_TENANT_ID,
      p_action_type: 'menu_create',
      p_transaction_id: null,
    });
  });

  it('should return failure when RPC returns error', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'No recoverable credits found' },
    });

    const result = await recoverFailedAction(TEST_TENANT_ID, 'send_sms');

    expect(result.success).toBe(false);
    expect(result.error).toBe('No recoverable credits found');
  });

  it('should handle exceptions gracefully', async () => {
    mockRpc.mockRejectedValue(new Error('Database connection failed'));

    const result = await recoverFailedAction(TEST_TENANT_ID, 'send_sms');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Database connection failed');
  });

  it('should return 0 recovered when data.recovered is null', async () => {
    mockRpc.mockResolvedValue({
      data: { recovered: null },
      error: null,
    });

    const result = await recoverFailedAction(TEST_TENANT_ID, 'send_sms');

    expect(result.success).toBe(true);
    expect(result.creditsRecovered).toBe(0);
  });
});

// ============================================================================
// directRefund Tests
// ============================================================================

describe('directRefund', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call direct_credit_refund RPC with correct parameters', async () => {
    mockRpc.mockResolvedValue({
      data: { amount: 100 },
      error: null,
    });

    await directRefund(TEST_TENANT_ID, 100, 'customer_request', 'Customer complaint');

    expect(mockRpc).toHaveBeenCalledWith('direct_credit_refund', {
      p_tenant_id: TEST_TENANT_ID,
      p_amount: 100,
      p_reason: 'customer_request',
      p_notes: 'Customer complaint',
    });
  });

  it('should return success with refunded amount', async () => {
    mockRpc.mockResolvedValue({
      data: { amount: 50 },
      error: null,
    });

    const result = await directRefund(TEST_TENANT_ID, 50, 'service_error');

    expect(result.success).toBe(true);
    expect(result.refundedAmount).toBe(50);
  });

  it('should fall back to requested amount when data.amount is null', async () => {
    mockRpc.mockResolvedValue({
      data: { amount: null },
      error: null,
    });

    const result = await directRefund(TEST_TENANT_ID, 75, 'other');

    expect(result.success).toBe(true);
    expect(result.refundedAmount).toBe(75);
  });

  it('should default notes to empty string when not provided', async () => {
    mockRpc.mockResolvedValue({
      data: { amount: 25 },
      error: null,
    });

    await directRefund(TEST_TENANT_ID, 25, 'failed_action');

    expect(mockRpc).toHaveBeenCalledWith('direct_credit_refund', expect.objectContaining({
      p_notes: '',
    }));
  });

  it('should return failure on RPC error', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'Insufficient permissions' },
    });

    const result = await directRefund(TEST_TENANT_ID, 100, 'customer_request');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Insufficient permissions');
  });

  it('should handle exceptions gracefully', async () => {
    mockRpc.mockRejectedValue(new Error('RPC timeout'));

    const result = await directRefund(TEST_TENANT_ID, 50, 'system_error');

    expect(result.success).toBe(false);
    expect(result.error).toBe('RPC timeout');
  });
});

// ============================================================================
// batchRefund Tests
// ============================================================================

describe('batchRefund', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should refund all transactions and sum total refunded', async () => {
    mockRpc
      .mockResolvedValueOnce({ data: { amount: 25 }, error: null })
      .mockResolvedValueOnce({ data: { amount: 50 }, error: null })
      .mockResolvedValueOnce({ data: { amount: 100 }, error: null });

    const requests: RefundRequest[] = [
      { transactionId: 'txn-1', tenantId: TEST_TENANT_ID, reason: 'failed_action' },
      { transactionId: 'txn-2', tenantId: TEST_TENANT_ID, reason: 'failed_action' },
      { transactionId: 'txn-3', tenantId: TEST_TENANT_ID, reason: 'failed_action' },
    ];

    const { results, totalRefunded } = await batchRefund(requests);

    expect(results).toHaveLength(3);
    expect(results.every(r => r.success)).toBe(true);
    expect(totalRefunded).toBe(175);
    expect(mockRpc).toHaveBeenCalledTimes(3);
  });

  it('should continue processing after individual failures', async () => {
    mockRpc
      .mockResolvedValueOnce({ data: { amount: 25 }, error: null })
      .mockResolvedValueOnce({ data: null, error: { message: 'Not found' } })
      .mockResolvedValueOnce({ data: { amount: 50 }, error: null });

    const requests: RefundRequest[] = [
      { transactionId: 'txn-1', tenantId: TEST_TENANT_ID, reason: 'failed_action' },
      { transactionId: 'txn-2', tenantId: TEST_TENANT_ID, reason: 'failed_action' },
      { transactionId: 'txn-3', tenantId: TEST_TENANT_ID, reason: 'failed_action' },
    ];

    const { results, totalRefunded } = await batchRefund(requests);

    expect(results).toHaveLength(3);
    expect(results[0].success).toBe(true);
    expect(results[1].success).toBe(false);
    expect(results[2].success).toBe(true);
    expect(totalRefunded).toBe(75); // 25 + 50, skipped failed
  });

  it('should return zero total when all refunds fail', async () => {
    mockRpc
      .mockResolvedValueOnce({ data: null, error: { message: 'Error 1' } })
      .mockResolvedValueOnce({ data: null, error: { message: 'Error 2' } });

    const requests: RefundRequest[] = [
      { transactionId: 'txn-1', tenantId: TEST_TENANT_ID, reason: 'service_error' },
      { transactionId: 'txn-2', tenantId: TEST_TENANT_ID, reason: 'service_error' },
    ];

    const { results, totalRefunded } = await batchRefund(requests);

    expect(results).toHaveLength(2);
    expect(results.every(r => !r.success)).toBe(true);
    expect(totalRefunded).toBe(0);
  });

  it('should handle empty batch', async () => {
    const { results, totalRefunded } = await batchRefund([]);

    expect(results).toHaveLength(0);
    expect(totalRefunded).toBe(0);
    expect(mockRpc).not.toHaveBeenCalled();
  });
});

// ============================================================================
// isTransactionRefunded Tests
// ============================================================================

describe('isTransactionRefunded', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return true when refund record exists', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: { id: 'refund-001' },
      error: null,
    });

    const result = await isTransactionRefunded('txn-already-refunded');

    expect(result).toBe(true);
    expect(mockFrom).toHaveBeenCalledWith('credit_transactions');
    expect(mockEq).toHaveBeenCalledWith('reference_id', 'txn-already-refunded');
    expect(mockEq).toHaveBeenCalledWith('type', 'refund');
  });

  it('should return false when no refund record exists', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: null,
      error: null,
    });

    const result = await isTransactionRefunded('txn-not-refunded');

    expect(result).toBe(false);
  });

  it('should return false on query error', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: null,
      error: { message: 'Query failed' },
    });

    const result = await isTransactionRefunded('txn-error');

    expect(result).toBe(false);
  });

  it('should return false on exception', async () => {
    mockMaybeSingle.mockRejectedValue(new Error('Connection lost'));

    const result = await isTransactionRefunded('txn-exception');

    expect(result).toBe(false);
  });
});

// ============================================================================
// getRefundHistory Tests
// ============================================================================

describe('getRefundHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should query credit_transactions filtered by tenant and type', async () => {
    // Need to set up chain for getRefundHistory's query pattern
    const mockLimitResult = { data: [], error: null };
    mockLimit.mockReturnValue(mockLimitResult);

    // getRefundHistory calls from().select().eq(tenant_id).eq(type).order().limit()
    // Our mock chain handles this via the nested mock structure

    const result = await getRefundHistory(TEST_TENANT_ID);

    expect(mockFrom).toHaveBeenCalledWith('credit_transactions');
    expect(mockEq).toHaveBeenCalledWith('tenant_id', TEST_TENANT_ID);
    expect(mockEq).toHaveBeenCalledWith('type', 'refund');
    expect(result.error).toBeNull();
  });

  it('should return empty array on error', async () => {
    mockLimit.mockReturnValueOnce({ data: null, error: { message: 'Query failed' } });

    const result = await getRefundHistory(TEST_TENANT_ID);

    expect(result.data).toEqual([]);
    expect(result.error).toBe('Query failed');
  });

  it('should return empty array on exception', async () => {
    mockLimit.mockImplementationOnce(() => {
      throw new Error('Unexpected error');
    });

    const result = await getRefundHistory(TEST_TENANT_ID);

    expect(result.data).toEqual([]);
    expect(result.error).toBe('Unexpected error');
  });
});

// ============================================================================
// End-to-End Refund Scenario: Failed SMS sends credits back
// ============================================================================

describe('Failed action refund scenario', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should refund 25 credits after SMS delivery failure via refundCredits', async () => {
    // Step 1: SMS was consumed (25 credits)
    // Step 2: SMS delivery failed
    // Step 3: Refund the credits
    mockRpc.mockResolvedValue({
      data: { amount: 25 },
      error: null,
    });

    const result = await refundCredits({
      transactionId: 'txn-sms-failed-123',
      tenantId: TEST_TENANT_ID,
      reason: 'failed_action',
      notes: 'SMS delivery failed',
    });

    expect(result.success).toBe(true);
    expect(result.refundedAmount).toBe(25);
    expect(mockRpc).toHaveBeenCalledWith('refund_credits', {
      p_transaction_id: 'txn-sms-failed-123',
      p_tenant_id: TEST_TENANT_ID,
      p_reason: 'failed_action',
      p_notes: 'SMS delivery failed',
    });
  });

  it('should recover credits via recoverFailedAction for send_sms', async () => {
    mockRpc.mockResolvedValue({
      data: { recovered: 25 },
      error: null,
    });

    const result = await recoverFailedAction(
      TEST_TENANT_ID,
      'send_sms',
      'txn-sms-failed-456'
    );

    expect(result.success).toBe(true);
    expect(result.creditsRecovered).toBe(25);
    expect(mockRpc).toHaveBeenCalledWith('recover_failed_credits', {
      p_tenant_id: TEST_TENANT_ID,
      p_action_type: 'send_sms',
      p_transaction_id: 'txn-sms-failed-456',
    });
  });

  it('should recover credits for failed menu creation (100 credits)', async () => {
    mockRpc.mockResolvedValue({
      data: { recovered: 100 },
      error: null,
    });

    const result = await recoverFailedAction(TEST_TENANT_ID, 'menu_create', 'txn-menu-failed');

    expect(result.success).toBe(true);
    expect(result.creditsRecovered).toBe(100);
  });

  it('should allow admin direct refund of 25 credits for failed SMS', async () => {
    mockRpc.mockResolvedValue({
      data: { amount: 25 },
      error: null,
    });

    const result = await directRefund(
      TEST_TENANT_ID,
      25,
      'failed_action',
      'SMS delivery failed — manual refund'
    );

    expect(result.success).toBe(true);
    expect(result.refundedAmount).toBe(25);
  });
});
