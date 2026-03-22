/**
 * Credit Analytics Events Tests
 *
 * Verifies that the credit_analytics table receives correct entries for:
 * 1. credit_consumed — with correct action_key after successful consumption
 * 2. action_blocked_insufficient_credits — when action is blocked
 * 3. credit_refunded — when a refund is processed
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { trackCreditEvent } from '../creditService';

// ============================================================================
// Mocks
// ============================================================================

const mockInsert = vi.fn().mockResolvedValue({ data: null, error: null });

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      insert: mockInsert,
    })),
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

const TEST_TENANT_ID = 'tenant-analytics-001';

// ============================================================================
// Tests
// ============================================================================

describe('Credit Analytics Event Tracking', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ========================================================================
  // 1. credit_consumed events
  // ========================================================================

  describe('credit_consumed events', () => {
    it('should insert a credit_consumed event with correct action_key', async () => {
      await trackCreditEvent(
        TEST_TENANT_ID,
        'credit_consumed',
        900,
        'menu_create'
      );

      expect(mockInsert).toHaveBeenCalledWith({
        tenant_id: TEST_TENANT_ID,
        event_type: 'credit_consumed',
        credits_at_event: 900,
        action_attempted: 'menu_create',
        metadata: {},
      });
    });

    it('should record the balance after consumption in credits_at_event', async () => {
      await trackCreditEvent(
        TEST_TENANT_ID,
        'credit_consumed',
        450,
        'order_create_manual'
      );

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          credits_at_event: 450,
          action_attempted: 'order_create_manual',
        })
      );
    });

    it('should include metadata when provided for consumed events', async () => {
      const metadata = {
        credits_deducted: 100,
        reference_id: 'menu-ref-001',
        source: 'admin_panel',
      };

      await trackCreditEvent(
        TEST_TENANT_ID,
        'credit_consumed',
        800,
        'menu_create',
        metadata
      );

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: 'credit_consumed',
          metadata,
        })
      );
    });

    it('should default metadata to empty object when not provided', async () => {
      await trackCreditEvent(
        TEST_TENANT_ID,
        'credit_consumed',
        975,
        'send_sms'
      );

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: {},
        })
      );
    });

    it('should track different action types for consumed events', async () => {
      const actions = ['menu_create', 'pos_process_sale', 'send_sms', 'product_add'];

      for (const actionKey of actions) {
        vi.clearAllMocks();

        await trackCreditEvent(
          TEST_TENANT_ID,
          'credit_consumed',
          500,
          actionKey
        );

        expect(mockInsert).toHaveBeenCalledWith(
          expect.objectContaining({
            event_type: 'credit_consumed',
            action_attempted: actionKey,
          })
        );
      }
    });
  });

  // ========================================================================
  // 2. action_blocked_insufficient_credits events
  // ========================================================================

  describe('action_blocked_insufficient_credits events', () => {
    it('should insert a blocked event when action is blocked due to insufficient credits', async () => {
      await trackCreditEvent(
        TEST_TENANT_ID,
        'action_blocked_insufficient_credits',
        30,
        'menu_create'
      );

      expect(mockInsert).toHaveBeenCalledWith({
        tenant_id: TEST_TENANT_ID,
        event_type: 'action_blocked_insufficient_credits',
        credits_at_event: 30,
        action_attempted: 'menu_create',
        metadata: {},
      });
    });

    it('should record zero balance when completely out of credits', async () => {
      await trackCreditEvent(
        TEST_TENANT_ID,
        'action_blocked_insufficient_credits',
        0,
        'pos_process_sale'
      );

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          credits_at_event: 0,
          action_attempted: 'pos_process_sale',
        })
      );
    });

    it('should record the attempted action when blocked', async () => {
      await trackCreditEvent(
        TEST_TENANT_ID,
        'action_blocked_insufficient_credits',
        10,
        'storefront_create'
      );

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          action_attempted: 'storefront_create',
          event_type: 'action_blocked_insufficient_credits',
        })
      );
    });

    it('should include metadata with block reason when provided', async () => {
      const metadata = {
        required_credits: 100,
        available_credits: 30,
        shortfall: 70,
      };

      await trackCreditEvent(
        TEST_TENANT_ID,
        'action_blocked_insufficient_credits',
        30,
        'menu_create',
        metadata
      );

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata,
        })
      );
    });
  });

  // ========================================================================
  // 3. credit_refunded events
  // ========================================================================

  describe('credit_refunded events', () => {
    it('should insert a credit_refunded event when refund is processed', async () => {
      await trackCreditEvent(
        TEST_TENANT_ID,
        'credit_refunded',
        1100,
        'menu_create'
      );

      expect(mockInsert).toHaveBeenCalledWith({
        tenant_id: TEST_TENANT_ID,
        event_type: 'credit_refunded',
        credits_at_event: 1100,
        action_attempted: 'menu_create',
        metadata: {},
      });
    });

    it('should record the balance after refund in credits_at_event', async () => {
      await trackCreditEvent(
        TEST_TENANT_ID,
        'credit_refunded',
        1500,
        'order_create_manual'
      );

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          credits_at_event: 1500,
        })
      );
    });

    it('should include refund metadata when provided', async () => {
      const metadata = {
        refund_amount: 100,
        original_transaction_id: 'txn-001',
        reason: 'order_cancelled',
      };

      await trackCreditEvent(
        TEST_TENANT_ID,
        'credit_refunded',
        1100,
        'menu_create',
        metadata
      );

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: 'credit_refunded',
          metadata,
        })
      );
    });

    it('should track the original action that was refunded', async () => {
      await trackCreditEvent(
        TEST_TENANT_ID,
        'credit_refunded',
        525,
        'send_sms'
      );

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          action_attempted: 'send_sms',
        })
      );
    });
  });

  // ========================================================================
  // 4. Edge cases & error handling
  // ========================================================================

  describe('Error handling', () => {
    it('should not throw when insert fails', async () => {
      mockInsert.mockRejectedValueOnce(new Error('Database unavailable'));

      await expect(
        trackCreditEvent(
          TEST_TENANT_ID,
          'credit_consumed',
          900,
          'menu_create'
        )
      ).resolves.toBeUndefined();
    });

    it('should handle missing action_attempted gracefully', async () => {
      await trackCreditEvent(
        TEST_TENANT_ID,
        'credit_consumed',
        500
      );

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          action_attempted: undefined,
        })
      );
    });
  });

  // ========================================================================
  // 5. Correct table targeting
  // ========================================================================

  describe('Table targeting', () => {
    it('should always insert into credit_analytics table', async () => {
      const { supabase } = await import('@/integrations/supabase/client');

      await trackCreditEvent(
        TEST_TENANT_ID,
        'credit_consumed',
        900,
        'menu_create'
      );

      expect(supabase.from).toHaveBeenCalledWith('credit_analytics');
    });

    it('should always include tenant_id for RLS compliance', async () => {
      await trackCreditEvent(
        TEST_TENANT_ID,
        'credit_refunded',
        1100,
        'menu_create'
      );

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          tenant_id: TEST_TENANT_ID,
        })
      );
    });
  });
});
