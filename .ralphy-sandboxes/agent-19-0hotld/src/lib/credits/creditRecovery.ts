/**
 * Credit Recovery Module
 * Handles refunds, failed action recovery, and batch refunds
 */

import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

export type RefundReason =
    | 'failed_action'
    | 'duplicate_charge'
    | 'service_error'
    | 'customer_request'
    | 'system_error'
    | 'other';

export interface RefundRequest {
    transactionId: string;
    tenantId: string;
    reason: RefundReason;
    notes?: string;
}

export interface RefundResult {
    success: boolean;
    refundedAmount?: number;
    error?: string;
}

export interface RecoveryResult {
    success: boolean;
    creditsRecovered?: number;
    error?: string;
}

/**
 * Refund credits for a specific transaction
 */
export async function refundCredits(request: RefundRequest): Promise<RefundResult> {
    try {
        const { data, error } = await supabase.rpc('refund_credits', {
            p_transaction_id: request.transactionId,
            p_tenant_id: request.tenantId,
            p_reason: request.reason,
            p_notes: request.notes ?? '',
        });

        if (error) {
            logger.error('Failed to refund credits', error, { component: 'creditRecovery' });
            return { success: false, error: error.message };
        }

        return { success: true, refundedAmount: data?.amount ?? 0 };
    } catch (err) {
        logger.error('Credit refund exception', err as Error, { component: 'creditRecovery' });
        return { success: false, error: (err as Error).message };
    }
}

/**
 * Recover credits from a failed action
 */
export async function recoverFailedAction(
    tenantId: string,
    actionType: string,
    transactionId?: string
): Promise<RecoveryResult> {
    try {
        const { data, error } = await supabase.rpc('recover_failed_credits', {
            p_tenant_id: tenantId,
            p_action_type: actionType,
            p_transaction_id: transactionId ?? null,
        });

        if (error) {
            logger.error('Failed to recover credits', error, { component: 'creditRecovery' });
            return { success: false, error: error.message };
        }

        return { success: true, creditsRecovered: data?.recovered ?? 0 };
    } catch (err) {
        logger.error('Credit recovery exception', err as Error, { component: 'creditRecovery' });
        return { success: false, error: (err as Error).message };
    }
}

/**
 * Direct refund by amount (admin use)
 */
export async function directRefund(
    tenantId: string,
    amount: number,
    reason: RefundReason,
    notes?: string
): Promise<RefundResult> {
    try {
        const { data, error } = await supabase.rpc('direct_credit_refund', {
            p_tenant_id: tenantId,
            p_amount: amount,
            p_reason: reason,
            p_notes: notes ?? '',
        });

        if (error) {
            logger.error('Direct refund failed', error, { component: 'creditRecovery' });
            return { success: false, error: error.message };
        }

        return { success: true, refundedAmount: data?.amount ?? amount };
    } catch (err) {
        logger.error('Direct refund exception', err as Error, { component: 'creditRecovery' });
        return { success: false, error: (err as Error).message };
    }
}

/**
 * Batch refund multiple transactions
 */
export async function batchRefund(
    requests: RefundRequest[]
): Promise<{ results: RefundResult[]; totalRefunded: number }> {
    const results: RefundResult[] = [];
    let totalRefunded = 0;

    for (const request of requests) {
        const result = await refundCredits(request);
        results.push(result);
        if (result.success && result.refundedAmount) {
            totalRefunded += result.refundedAmount;
        }
    }

    return { results, totalRefunded };
}

/**
 * Check if a transaction has already been refunded
 */
export async function isTransactionRefunded(transactionId: string): Promise<boolean> {
    try {
        const { data, error } = await supabase
            .from('credit_transactions')
            .select('id')
            .eq('reference_id', transactionId)
            .eq('type', 'refund')
            .maybeSingle();

        if (error) {
            logger.warn('Error checking refund status', { error, component: 'creditRecovery' });
            return false;
        }

        return !!data;
    } catch {
        return false;
    }
}

/**
 * Get refund history for a tenant
 */
export async function getRefundHistory(
    tenantId: string,
    limit = 50
): Promise<{ data: unknown[]; error: string | null }> {
    try {
        const { data, error } = await supabase
            .from('credit_transactions')
            .select('id, tenant_id, amount, balance_after, transaction_type, action_type, reference_id, reference_type, description, metadata, created_at')
            .eq('tenant_id', tenantId)
            .eq('type', 'refund')
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) {
            return { data: [], error: error.message };
        }

        return { data: data ?? [], error: null };
    } catch (err) {
        return { data: [], error: (err as Error).message };
    }
}
