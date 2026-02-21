/**
 * Credit Recovery Service
 * 
 * Handles refunding credits when actions fail after deduction.
 * Ensures users don't lose credits for operations that didn't complete.
 */

import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

// ============================================================================
// Types
// ============================================================================

export type RefundReason =
  | 'action_failed'        // Action failed after credit deduction
  | 'duplicate'            // Duplicate charge detected
  | 'support_request'      // Manual refund via support
  | 'system_error'         // System error caused failure
  | 'timeout'              // Action timed out
  | 'cancelled'            // User cancelled mid-action
  | 'partial_completion';  // Action partially completed

export interface RefundRequest {
  /** ID of the tenant */
  tenantId: string;
  /** Original transaction ID to refund */
  transactionId: string;
  /** Reason for the refund */
  reason: RefundReason;
  /** Optional additional context */
  context?: string;
  /** Optional reference to the failed action */
  referenceId?: string;
}

export interface RefundResult {
  success: boolean;
  refundedAmount?: number;
  newBalance?: number;
  refundTransactionId?: string;
  error?: string;
}

export interface RecoveryResult {
  success: boolean;
  refundedAmount: number;
  newBalance: number;
  transactionId?: string;
  error?: string;
}

// ============================================================================
// Main Functions
// ============================================================================

/**
 * Refund credits for a specific transaction
 */
export async function refundCredits(request: RefundRequest): Promise<RefundResult> {
  const { tenantId, transactionId, reason, context, referenceId } = request;

  try {
    // Get the original transaction
    const { data: transaction, error: txError } = await supabase
      .from('credit_transactions')
      .select('*')
      .eq('id', transactionId)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (txError || !transaction) {
      logger.error('Transaction not found for refund', { transactionId, tenantId });
      return {
        success: false,
        error: 'Original transaction not found',
      };
    }

    // Only refund usage transactions (negative amounts)
    if (transaction.amount >= 0) {
      return {
        success: false,
        error: 'Can only refund usage transactions',
      };
    }

    // Check if already refunded
    const { data: existingRefund } = await (supabase as any)
      .from('credit_transactions')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('metadata->original_transaction_id', transactionId)
      .eq('transaction_type', 'refund')
      .maybeSingle();

    if (existingRefund) {
      return {
        success: false,
        error: 'Transaction already refunded',
      };
    }

    // Calculate refund amount (absolute value of original negative amount)
    const refundAmount = Math.abs(transaction.amount);

    // Get current balance
    const { data: credits, error: creditsError } = await supabase
      .from('tenant_credits')
      .select('balance')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (creditsError || !credits) {
      logger.error('Credits record not found', { tenantId });
      return {
        success: false,
        error: 'Credits record not found',
      };
    }

    const newBalance = credits.balance + refundAmount;

    // Update balance
    const { error: updateError } = await supabase
      .from('tenant_credits')
      .update({ balance: newBalance })
      .eq('tenant_id', tenantId);

    if (updateError) {
      logger.error('Failed to update balance for refund', { updateError });
      return {
        success: false,
        error: 'Failed to process refund',
      };
    }

    // Create refund transaction
    const { data: refundTx, error: txInsertError } = await supabase
      .from('credit_transactions')
      .insert({
        tenant_id: tenantId,
        amount: refundAmount,
        balance_after: newBalance,
        transaction_type: 'refund',
        action_type: transaction.action_type,
        reference_id: referenceId || transaction.reference_id,
        description: getRefundDescription(reason, transaction.action_type, context),
        metadata: {
          original_transaction_id: transactionId,
          refund_reason: reason,
          context,
          original_amount: transaction.amount,
          original_action: transaction.action_type,
        },
      })
      .select('id')
      .maybeSingle();

    if (txInsertError) {
      logger.error('Failed to create refund transaction', { txInsertError });
      // Note: Balance was already updated, this is a logging issue only
    }

    logger.info('Credit refund processed', {
      tenantId,
      transactionId,
      refundAmount,
      newBalance,
      reason,
    });

    return {
      success: true,
      refundedAmount: refundAmount,
      newBalance,
      refundTransactionId: refundTx?.id,
    };
  } catch (error) {
    logger.error('Error processing credit refund', { error, tenantId, transactionId });
    return {
      success: false,
      error: (error as Error).message,
    };
  }
}

/**
 * Automatic recovery after a failed action
 * Call this when an action fails after credits were deducted
 */
export async function recoverFailedAction(
  tenantId: string,
  actionKey: string,
  creditsCost: number,
  errorContext?: string
): Promise<RecoveryResult> {
  try {
    // Find the most recent matching transaction
    const { data: recentTx, error: findError } = await supabase
      .from('credit_transactions')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('action_type', actionKey)
      .eq('amount', -creditsCost)
      .eq('transaction_type', 'usage')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (findError || !recentTx) {
      logger.warn('Could not find recent transaction to recover', {
        tenantId,
        actionKey,
        creditsCost,
      });

      // Proceed with direct refund anyway
      return await directRefund(tenantId, creditsCost, actionKey, 'action_failed', errorContext);
    }

    // Check if transaction is recent (within last 5 minutes)
    const txTime = new Date(recentTx.created_at).getTime();
    const now = Date.now();
    const fiveMinutes = 5 * 60 * 1000;

    if (now - txTime > fiveMinutes) {
      logger.warn('Transaction too old for automatic recovery', {
        tenantId,
        transactionId: recentTx.id,
        age: now - txTime,
      });
      return {
        success: false,
        refundedAmount: 0,
        newBalance: 0,
        error: 'Transaction too old for automatic recovery',
      };
    }

    // Refund the transaction
    const result = await refundCredits({
      tenantId,
      transactionId: recentTx.id,
      reason: 'action_failed',
      context: errorContext,
    });

    return {
      success: result.success,
      refundedAmount: result.refundedAmount || 0,
      newBalance: result.newBalance || 0,
      transactionId: result.refundTransactionId,
      error: result.error,
    };
  } catch (error) {
    logger.error('Error in recoverFailedAction', { error, tenantId, actionKey });
    return {
      success: false,
      refundedAmount: 0,
      newBalance: 0,
      error: (error as Error).message,
    };
  }
}

/**
 * Direct refund without a matching transaction
 * Used for system errors or edge cases
 */
export async function directRefund(
  tenantId: string,
  amount: number,
  actionKey: string,
  reason: RefundReason,
  context?: string
): Promise<RecoveryResult> {
  try {
    // Get current balance
    const { data: credits, error: fetchError } = await supabase
      .from('tenant_credits')
      .select('balance')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (fetchError || !credits) {
      return {
        success: false,
        refundedAmount: 0,
        newBalance: 0,
        error: 'Credits record not found',
      };
    }

    const newBalance = credits.balance + amount;

    // Update balance
    const { error: updateError } = await supabase
      .from('tenant_credits')
      .update({ balance: newBalance })
      .eq('tenant_id', tenantId);

    if (updateError) {
      return {
        success: false,
        refundedAmount: 0,
        newBalance: 0,
        error: 'Failed to update balance',
      };
    }

    // Create refund transaction
    const { data: refundTx } = await supabase
      .from('credit_transactions')
      .insert({
        tenant_id: tenantId,
        amount: amount,
        balance_after: newBalance,
        transaction_type: 'refund',
        action_type: actionKey,
        description: getRefundDescription(reason, actionKey, context),
        metadata: {
          direct_refund: true,
          refund_reason: reason,
          context,
        },
      })
      .select('id')
      .maybeSingle();

    logger.info('Direct refund processed', {
      tenantId,
      amount,
      actionKey,
      reason,
      newBalance,
    });

    return {
      success: true,
      refundedAmount: amount,
      newBalance,
      transactionId: refundTx?.id,
    };
  } catch (error) {
    logger.error('Error in directRefund', { error, tenantId, amount });
    return {
      success: false,
      refundedAmount: 0,
      newBalance: 0,
      error: (error as Error).message,
    };
  }
}

/**
 * Batch refund for multiple failed actions
 */
export async function batchRefund(
  tenantId: string,
  transactionIds: string[],
  reason: RefundReason,
  context?: string
): Promise<{
  success: boolean;
  totalRefunded: number;
  newBalance: number;
  results: Array<{ transactionId: string; success: boolean; amount?: number; error?: string }>;
}> {
  const results: Array<{
    transactionId: string;
    success: boolean;
    amount?: number;
    error?: string;
  }> = [];

  let totalRefunded = 0;
  let newBalance = 0;

  for (const transactionId of transactionIds) {
    const result = await refundCredits({
      tenantId,
      transactionId,
      reason,
      context,
    });

    results.push({
      transactionId,
      success: result.success,
      amount: result.refundedAmount,
      error: result.error,
    });

    if (result.success && result.refundedAmount) {
      totalRefunded += result.refundedAmount;
      newBalance = result.newBalance || newBalance;
    }
  }

  return {
    success: results.some((r) => r.success),
    totalRefunded,
    newBalance,
    results,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate a human-readable refund description
 */
function getRefundDescription(
  reason: RefundReason,
  actionType?: string,
  context?: string
): string {
  const actionName = actionType?.replace(/_/g, ' ') || 'action';

  switch (reason) {
    case 'action_failed':
      return `Refund - ${actionName} failed${context ? `: ${context}` : ''}`;
    case 'duplicate':
      return `Refund - duplicate charge for ${actionName}`;
    case 'support_request':
      return `Refund - support request${context ? `: ${context}` : ''}`;
    case 'system_error':
      return `Refund - system error during ${actionName}`;
    case 'timeout':
      return `Refund - ${actionName} timed out`;
    case 'cancelled':
      return `Refund - ${actionName} cancelled`;
    case 'partial_completion':
      return `Partial refund - ${actionName} partially completed`;
    default:
      return `Refund - ${actionName}`;
  }
}

/**
 * Check if a transaction has already been refunded
 */
export async function isTransactionRefunded(
  tenantId: string,
  transactionId: string
): Promise<boolean> {
  const { data } = await (supabase as any)
    .from('credit_transactions')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('metadata->original_transaction_id', transactionId)
    .eq('transaction_type', 'refund')
    .maybeSingle();

  return !!data;
}

/**
 * Get refund history for a tenant
 */
export async function getRefundHistory(
  tenantId: string,
  limit: number = 20
): Promise<Array<{
  id: string;
  amount: number;
  reason: string;
  actionType?: string;
  createdAt: string;
}>> {
  const { data, error } = await supabase
    .from('credit_transactions')
    .select('id, amount, description, action_type, metadata, created_at')
    .eq('tenant_id', tenantId)
    .eq('transaction_type', 'refund')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error || !data) {
    return [];
  }

  return data.map((tx) => ({
    id: tx.id,
    amount: tx.amount,
    reason: (tx.metadata as Record<string, unknown>)?.refund_reason as string || 'unknown',
    actionType: tx.action_type ?? undefined,
    createdAt: tx.created_at,
  }));
}







