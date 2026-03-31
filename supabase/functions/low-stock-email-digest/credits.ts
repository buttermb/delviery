// Low Stock Email Digest — Credit Operations

import { createLogger } from '../_shared/logger.ts';
import type { CreditDeductionResult } from './types.ts';

const logger = createLogger('low-stock-email-digest');

const CREDIT_ACTION_KEY = 'send_email';

/**
 * Deduct credits for sending a digest email.
 * Calls the consume_credits RPC directly since this is a system-triggered function
 * (no JWT/user context — runs as cron with service role).
 */
export async function deductCredits(
  supabase: any,
  tenantId: string
): Promise<CreditDeductionResult> {
  try {
    const { data, error } = await supabase
      .rpc('consume_credits', {
        p_tenant_id: tenantId,
        p_action_key: CREDIT_ACTION_KEY,
        p_reference_id: null,
        p_reference_type: 'low_stock_digest',
        p_description: 'Low stock email digest',
      });

    if (error) {
      logger.error('Credit deduction RPC error', { tenantId, error: error.message });
      return {
        success: false,
        newBalance: 0,
        creditsCost: 0,
        errorMessage: error.message,
      };
    }

    if (!data || data.length === 0) {
      logger.error('No response from consume_credits', { tenantId });
      return {
        success: false,
        newBalance: 0,
        creditsCost: 0,
        errorMessage: 'No response from credit check',
      };
    }

    const result = data[0];
    return {
      success: result.success,
      newBalance: result.new_balance,
      creditsCost: result.credits_cost,
      errorMessage: result.error_message,
    };
  } catch (err) {
    logger.error('Credit deduction failed', { tenantId, error: (err as Error).message });
    return {
      success: false,
      newBalance: 0,
      creditsCost: 0,
      errorMessage: (err as Error).message,
    };
  }
}

/**
 * Refund credits when the email send fails after deduction.
 */
export async function refundCredits(
  supabase: any,
  tenantId: string,
  amount: number,
  reason: string
): Promise<void> {
  try {
    await supabase
      .rpc('refund_credits', {
        p_tenant_id: tenantId,
        p_amount: amount,
        p_action_key: CREDIT_ACTION_KEY,
        p_reason: reason,
      });

    logger.info('Credits refunded after failed digest send', {
      tenantId,
      amount,
      reason,
    });
  } catch (err) {
    logger.error('Failed to refund credits', {
      tenantId,
      amount,
      error: (err as Error).message,
    });
  }
}
