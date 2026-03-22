/**
 * consumeBatchCredits Tests
 *
 * Tests the batch credit consumption function which calculates
 * total cost across multiple actions and performs a single deduction.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getCreditCost } from '../creditCosts';
import { consumeBatchCredits } from '../creditService';

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

const TEST_TENANT_ID = 'tenant-batch-001';

// ============================================================================
// Tests
// ============================================================================

describe('consumeBatchCredits', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ==========================================================================
  // Total Calculation
  // ==========================================================================

  describe('calculates correct total for multiple actions', () => {
    it('should calculate total for a single action with count > 1', async () => {
      // send_sms costs 25 credits each, 5 × 25 = 125
      const smsCost = getCreditCost('send_sms');
      expect(smsCost).toBe(25);

      mockRpc.mockResolvedValue({
        data: { success: true, consumed: 125, balance: 875 },
        error: null,
      });

      const result = await consumeBatchCredits(
        TEST_TENANT_ID,
        [{ actionKey: 'send_sms', count: 5 }],
      );

      expect(result.success).toBe(true);
      expect(result.creditsCost).toBe(125);
      expect(result.newBalance).toBe(875);

      // Verify single RPC call with total amount
      expect(mockRpc).toHaveBeenCalledTimes(1);
      expect(mockRpc).toHaveBeenCalledWith('consume_credits', expect.objectContaining({
        p_tenant_id: TEST_TENANT_ID,
        p_amount: 125,
        p_action_key: 'batch_operation',
      }));
    });

    it('should calculate total for multiple different actions', async () => {
      // send_sms: 25 × 3 = 75
      // product_add: 10 × 2 = 20
      // menu_create: 100 × 1 = 100
      // Total: 195
      const expectedTotal = (25 * 3) + (10 * 2) + (100 * 1);
      expect(expectedTotal).toBe(195);

      mockRpc.mockResolvedValue({
        data: { success: true, consumed: expectedTotal, balance: 805 },
        error: null,
      });

      const result = await consumeBatchCredits(
        TEST_TENANT_ID,
        [
          { actionKey: 'send_sms', count: 3 },
          { actionKey: 'product_add', count: 2 },
          { actionKey: 'menu_create', count: 1 },
        ],
      );

      expect(result.success).toBe(true);
      expect(result.creditsCost).toBe(195);
      expect(mockRpc).toHaveBeenCalledTimes(1);
      expect(mockRpc).toHaveBeenCalledWith('consume_credits', expect.objectContaining({
        p_amount: 195,
      }));
    });

    it('should handle actions with zero cost in batch', async () => {
      // dashboard_view costs 0, send_sms costs 25
      // 0 × 10 + 25 × 2 = 50
      mockRpc.mockResolvedValue({
        data: { success: true, consumed: 50, balance: 950 },
        error: null,
      });

      const result = await consumeBatchCredits(
        TEST_TENANT_ID,
        [
          { actionKey: 'dashboard_view', count: 10 },
          { actionKey: 'send_sms', count: 2 },
        ],
      );

      expect(result.success).toBe(true);
      expect(result.creditsCost).toBe(50);
      expect(mockRpc).toHaveBeenCalledWith('consume_credits', expect.objectContaining({
        p_amount: 50,
      }));
    });

    it('should handle all-free actions batch (0 total)', async () => {
      mockRpc.mockResolvedValue({
        data: { success: true, consumed: 0, balance: 1000 },
        error: null,
      });

      const result = await consumeBatchCredits(
        TEST_TENANT_ID,
        [
          { actionKey: 'dashboard_view', count: 5 },
          { actionKey: 'orders_view', count: 3 },
        ],
      );

      expect(result.success).toBe(true);
      expect(result.creditsCost).toBe(0);
      expect(mockRpc).toHaveBeenCalledWith('consume_credits', expect.objectContaining({
        p_amount: 0,
      }));
    });

    it('should handle large batch counts', async () => {
      // send_bulk_sms: 20 × 100 = 2000
      const expectedTotal = 20 * 100;

      mockRpc.mockResolvedValue({
        data: { success: true, consumed: expectedTotal, balance: 8000 },
        error: null,
      });

      const result = await consumeBatchCredits(
        TEST_TENANT_ID,
        [{ actionKey: 'send_bulk_sms', count: 100 }],
      );

      expect(result.success).toBe(true);
      expect(result.creditsCost).toBe(2000);
      expect(mockRpc).toHaveBeenCalledWith('consume_credits', expect.objectContaining({
        p_amount: 2000,
      }));
    });
  });

  // ==========================================================================
  // Breakdown
  // ==========================================================================

  describe('returns correct breakdown', () => {
    it('should include per-action breakdown in result', async () => {
      mockRpc.mockResolvedValue({
        data: { success: true, consumed: 125, balance: 875 },
        error: null,
      });

      const result = await consumeBatchCredits(
        TEST_TENANT_ID,
        [{ actionKey: 'send_sms', count: 5 }],
      );

      expect(result.breakdown).toEqual([
        { actionKey: 'send_sms', count: 5, costPerAction: 25, subtotal: 125 },
      ]);
    });

    it('should include breakdown for multiple actions', async () => {
      mockRpc.mockResolvedValue({
        data: { success: true, consumed: 195, balance: 805 },
        error: null,
      });

      const result = await consumeBatchCredits(
        TEST_TENANT_ID,
        [
          { actionKey: 'send_sms', count: 3 },
          { actionKey: 'product_add', count: 2 },
          { actionKey: 'menu_create', count: 1 },
        ],
      );

      expect(result.breakdown).toEqual([
        { actionKey: 'send_sms', count: 3, costPerAction: 25, subtotal: 75 },
        { actionKey: 'product_add', count: 2, costPerAction: 10, subtotal: 20 },
        { actionKey: 'menu_create', count: 1, costPerAction: 100, subtotal: 100 },
      ]);
    });
  });

  // ==========================================================================
  // Metadata
  // ==========================================================================

  describe('sends correct metadata', () => {
    it('should include batch flag and action details in metadata', async () => {
      mockRpc.mockResolvedValue({
        data: { success: true, consumed: 125, balance: 875 },
        error: null,
      });

      await consumeBatchCredits(
        TEST_TENANT_ID,
        [{ actionKey: 'send_sms', count: 5 }],
      );

      expect(mockRpc).toHaveBeenCalledWith('consume_credits', expect.objectContaining({
        p_metadata: expect.objectContaining({
          batch: true,
          totalActions: 5,
          actions: expect.arrayContaining([
            expect.objectContaining({
              actionKey: 'send_sms',
              count: 5,
              costPerAction: 25,
              subtotal: 125,
            }),
          ]),
        }),
      }));
    });

    it('should pass custom description', async () => {
      mockRpc.mockResolvedValue({
        data: { success: true, consumed: 125, balance: 875 },
        error: null,
      });

      await consumeBatchCredits(
        TEST_TENANT_ID,
        [{ actionKey: 'send_sms', count: 5 }],
        'Bulk SMS campaign',
      );

      expect(mockRpc).toHaveBeenCalledWith('consume_credits', expect.objectContaining({
        p_description: 'Bulk SMS campaign',
      }));
    });

    it('should auto-generate description when not provided', async () => {
      mockRpc.mockResolvedValue({
        data: { success: true, consumed: 125, balance: 875 },
        error: null,
      });

      await consumeBatchCredits(
        TEST_TENANT_ID,
        [{ actionKey: 'send_sms', count: 5 }],
      );

      expect(mockRpc).toHaveBeenCalledWith('consume_credits', expect.objectContaining({
        p_description: 'Batch: 5x send_sms',
      }));
    });

    it('should pass reference_id when provided', async () => {
      mockRpc.mockResolvedValue({
        data: { success: true, consumed: 125, balance: 875 },
        error: null,
      });

      await consumeBatchCredits(
        TEST_TENANT_ID,
        [{ actionKey: 'send_sms', count: 5 }],
        'Campaign batch',
        'campaign-ref-001',
      );

      expect(mockRpc).toHaveBeenCalledWith('consume_credits', expect.objectContaining({
        p_reference_id: 'campaign-ref-001',
      }));
    });

    it('should pass null reference_id when not provided', async () => {
      mockRpc.mockResolvedValue({
        data: { success: true, consumed: 125, balance: 875 },
        error: null,
      });

      await consumeBatchCredits(
        TEST_TENANT_ID,
        [{ actionKey: 'send_sms', count: 5 }],
      );

      expect(mockRpc).toHaveBeenCalledWith('consume_credits', expect.objectContaining({
        p_reference_id: null,
      }));
    });
  });

  // ==========================================================================
  // Single RPC Call
  // ==========================================================================

  describe('makes single RPC call', () => {
    it('should make exactly one RPC call regardless of action count', async () => {
      mockRpc.mockResolvedValue({
        data: { success: true, consumed: 195, balance: 805 },
        error: null,
      });

      await consumeBatchCredits(
        TEST_TENANT_ID,
        [
          { actionKey: 'send_sms', count: 3 },
          { actionKey: 'product_add', count: 2 },
          { actionKey: 'menu_create', count: 1 },
        ],
      );

      expect(mockRpc).toHaveBeenCalledTimes(1);
    });

    it('should use batch_operation as action_key for the single call', async () => {
      mockRpc.mockResolvedValue({
        data: { success: true, consumed: 125, balance: 875 },
        error: null,
      });

      await consumeBatchCredits(
        TEST_TENANT_ID,
        [{ actionKey: 'send_sms', count: 5 }],
      );

      expect(mockRpc).toHaveBeenCalledWith('consume_credits', expect.objectContaining({
        p_action_key: 'batch_operation',
      }));
    });
  });

  // ==========================================================================
  // Error Handling
  // ==========================================================================

  describe('error handling', () => {
    it('should handle RPC error', async () => {
      mockRpc.mockResolvedValue({
        data: null,
        error: { message: 'Database connection failed' },
      });

      const result = await consumeBatchCredits(
        TEST_TENANT_ID,
        [{ actionKey: 'send_sms', count: 5 }],
      );

      expect(result.success).toBe(false);
      expect(result.errorMessage).toBe('Database connection failed');
      expect(result.creditsCost).toBe(125); // Still calculates the expected cost
      expect(result.breakdown).toHaveLength(1);
    });

    it('should handle null RPC response', async () => {
      mockRpc.mockResolvedValue({
        data: null,
        error: null,
      });

      const result = await consumeBatchCredits(
        TEST_TENANT_ID,
        [{ actionKey: 'send_sms', count: 5 }],
      );

      expect(result.success).toBe(false);
      expect(result.errorMessage).toBe('No response from credit consumption');
    });

    it('should handle exceptions', async () => {
      mockRpc.mockRejectedValue(new Error('Network timeout'));

      const result = await consumeBatchCredits(
        TEST_TENANT_ID,
        [{ actionKey: 'send_sms', count: 5 }],
      );

      expect(result.success).toBe(false);
      expect(result.errorMessage).toBe('Network timeout');
      expect(result.breakdown).toEqual([]);
    });

    it('should handle insufficient credits from server', async () => {
      mockRpc.mockResolvedValue({
        data: {
          success: false,
          error: 'Insufficient credits',
          consumed: 0,
          balance: 50,
        },
        error: null,
      });

      const result = await consumeBatchCredits(
        TEST_TENANT_ID,
        [{ actionKey: 'send_sms', count: 5 }],
      );

      expect(result.success).toBe(false);
      expect(result.newBalance).toBe(50);
      expect(result.errorMessage).toBe('Insufficient credits');
      // Breakdown is still available even on failure
      expect(result.breakdown).toHaveLength(1);
      expect(result.breakdown[0].subtotal).toBe(125);
    });

    it('should handle unknown action keys (defaulting to 0 cost)', async () => {
      mockRpc.mockResolvedValue({
        data: { success: true, consumed: 25, balance: 975 },
        error: null,
      });

      const result = await consumeBatchCredits(
        TEST_TENANT_ID,
        [
          { actionKey: 'nonexistent_action', count: 10 },
          { actionKey: 'send_sms', count: 1 },
        ],
      );

      expect(result.success).toBe(true);
      // nonexistent_action: 0 × 10 = 0, send_sms: 25 × 1 = 25
      expect(mockRpc).toHaveBeenCalledWith('consume_credits', expect.objectContaining({
        p_amount: 25,
      }));
      expect(result.breakdown[0]).toEqual({
        actionKey: 'nonexistent_action',
        count: 10,
        costPerAction: 0,
        subtotal: 0,
      });
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================

  describe('edge cases', () => {
    it('should handle empty actions array', async () => {
      mockRpc.mockResolvedValue({
        data: { success: true, consumed: 0, balance: 1000 },
        error: null,
      });

      const result = await consumeBatchCredits(
        TEST_TENANT_ID,
        [],
      );

      expect(result.success).toBe(true);
      expect(result.creditsCost).toBe(0);
      expect(result.breakdown).toEqual([]);
    });

    it('should handle action with count of 1', async () => {
      mockRpc.mockResolvedValue({
        data: { success: true, consumed: 25, balance: 975 },
        error: null,
      });

      const result = await consumeBatchCredits(
        TEST_TENANT_ID,
        [{ actionKey: 'send_sms', count: 1 }],
      );

      expect(result.success).toBe(true);
      expect(result.creditsCost).toBe(25);
    });
  });
});
