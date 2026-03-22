/**
 * Credit Refund Helper for Edge Functions
 *
 * Refunds credits when the main action fails after deduction.
 * Uses update_credit_balance with transaction_type='refund' to
 * atomically restore the tenant's balance and log an audit trail.
 *
 * Usage:
 * ```typescript
 * import { refundCredits, withAutoRefund } from '../_shared/creditRefund.ts';
 *
 * // Manual refund after a failed action:
 * const refund = await refundCredits(supabase, {
 *   tenantId,
 *   amount: creditsCost,
 *   reason: 'failed_action',
 *   actionKey: 'menu_ocr',
 *   originalTransactionId: txId,
 * });
 *
 * // Automatic refund wrapper:
 * const response = await withAutoRefund(
 *   supabase, tenantId, creditsCost, 'menu_ocr',
 *   async () => {
 *     // your main action — if this throws, credits are refunded
 *     return new Response(JSON.stringify({ ok: true }));
 *   }
 * );
 * ```
 */

import type { SupabaseClient } from './deps.ts';
import { corsHeaders } from './deps.ts';

// ============================================================================
// Types
// ============================================================================

export type RefundReason =
  | 'failed_action'
  | 'duplicate_charge'
  | 'service_error'
  | 'system_error';

export interface RefundRequest {
  tenantId: string;
  amount: number;
  reason: RefundReason;
  actionKey: string;
  originalTransactionId?: string;
  description?: string;
}

export interface RefundResult {
  success: boolean;
  newBalance: number;
  transactionId?: string;
  error?: string;
}

// ============================================================================
// Core Refund Function
// ============================================================================

/**
 * Refund credits to a tenant after a failed action.
 *
 * Calls update_credit_balance with type='refund' which atomically
 * adds the amount back, records a credit_transaction, and uses
 * the reference_id for idempotency (prevents double refunds).
 */
export async function refundCredits(
  supabaseClient: SupabaseClient,
  request: RefundRequest
): Promise<RefundResult> {
  const {
    tenantId,
    amount,
    reason,
    actionKey,
    originalTransactionId,
    description,
  } = request;

  if (amount <= 0) {
    return { success: false, newBalance: 0, error: 'Refund amount must be positive' };
  }

  // Build a stable reference_id for idempotency.
  // If the same originalTransactionId is refunded twice, update_credit_balance
  // returns the existing transaction (duplicate=true) instead of double-refunding.
  const referenceId = originalTransactionId
    ? `refund:${originalTransactionId}`
    : `refund:${tenantId}:${actionKey}:${Date.now()}`;

  const refundDescription = description
    ?? `Refund ${amount} credits for failed ${actionKey} (${reason})`;

  try {
    const { data, error } = await supabaseClient.rpc('update_credit_balance', {
      p_user_id: '00000000-0000-0000-0000-000000000000', // system user for refunds
      p_tenant_id: tenantId,
      p_amount: amount,
      p_transaction_type: 'refund',
      p_description: refundDescription,
      p_reference_type: 'credit_refund',
      p_reference_id: referenceId,
    });

    if (error) {
      console.error('[creditRefund] RPC error:', error.message);
      return { success: false, newBalance: 0, error: error.message };
    }

    if (!data) {
      return { success: false, newBalance: 0, error: 'No response from refund RPC' };
    }

    return {
      success: data.success ?? false,
      newBalance: data.new_balance ?? 0,
      transactionId: data.transaction_id,
      error: data.success ? undefined : (data.message ?? 'Refund failed'),
    };
  } catch (err) {
    console.error('[creditRefund] Exception:', (err as Error).message);
    return { success: false, newBalance: 0, error: (err as Error).message };
  }
}

// ============================================================================
// Auto-Refund Wrapper
// ============================================================================

/**
 * Execute an action and automatically refund credits if it fails.
 *
 * "Fails" means the callback:
 *   - throws an error, OR
 *   - returns a Response with status >= 500 (server errors)
 *
 * Client errors (4xx) are NOT refunded since those indicate bad input,
 * not a system failure after legitimate work was attempted.
 */
export async function withAutoRefund(
  supabaseClient: SupabaseClient,
  tenantId: string,
  creditsCost: number,
  actionKey: string,
  action: () => Promise<Response>,
  options?: { originalTransactionId?: string }
): Promise<Response> {
  try {
    const response = await action();

    // Only refund on server errors (5xx) — the action infrastructure failed
    if (response.status >= 500) {
      const refundResult = await refundCredits(supabaseClient, {
        tenantId,
        amount: creditsCost,
        reason: 'service_error',
        actionKey,
        originalTransactionId: options?.originalTransactionId,
        description: `Auto-refund: ${actionKey} returned status ${response.status}`,
      });

      if (refundResult.success) {
        // Append refund info to the error response body
        const originalBody = await response.clone().text();
        let body: Record<string, unknown>;
        try {
          body = JSON.parse(originalBody);
        } catch {
          body = { error: originalBody };
        }

        body.creditsRefunded = creditsCost;
        body.newBalance = refundResult.newBalance;

        return new Response(JSON.stringify(body), {
          status: response.status,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
            'X-Credits-Refunded': String(creditsCost),
            'X-Credits-Remaining': String(refundResult.newBalance),
          },
        });
      }

      console.error('[creditRefund] Auto-refund failed:', refundResult.error);
    }

    return response;
  } catch (err) {
    // The action threw — refund credits
    console.error('[creditRefund] Action threw, refunding:', (err as Error).message);

    const refundResult = await refundCredits(supabaseClient, {
      tenantId,
      amount: creditsCost,
      reason: 'failed_action',
      actionKey,
      originalTransactionId: options?.originalTransactionId,
      description: `Auto-refund: ${actionKey} threw error: ${(err as Error).message}`,
    });

    const body: Record<string, unknown> = {
      error: 'Internal server error',
      message: (err as Error).message,
    };

    if (refundResult.success) {
      body.creditsRefunded = creditsCost;
      body.newBalance = refundResult.newBalance;
    }

    return new Response(JSON.stringify(body), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        ...(refundResult.success
          ? {
              'X-Credits-Refunded': String(creditsCost),
              'X-Credits-Remaining': String(refundResult.newBalance),
            }
          : {}),
      },
    });
  }
}
