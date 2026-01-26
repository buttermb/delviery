/**
 * useConsumeCredits Hook
 *
 * A TanStack Query useMutation hook for consuming credits via the credits-use
 * edge function. Provides optimistic balance updates with automatic rollback
 * on error. Used by features that consume credits.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useCredits } from '@/hooks/useCredits';
import { logger } from '@/lib/logger';
import { toast } from 'sonner';

// ============================================================================
// Types
// ============================================================================

export interface ConsumeCreditsParams {
  /** Number of credits to consume */
  amount: number;
  /** Reference type for tracking (e.g., 'order', 'menu', 'storefront') */
  referenceType?: string;
  /** Reference ID for tracking (e.g., order ID) */
  referenceId?: string;
  /** Human-readable description of the credit usage */
  description?: string;
}

export interface ConsumeCreditsResponse {
  success: boolean;
  newBalance: number;
  transactionId: string;
  amount: number;
}

export interface ConsumeCreditsError {
  message: string;
  code?: string;
}

export interface UseConsumeCreditsOptions {
  /** Callback on successful credit consumption */
  onSuccess?: (data: ConsumeCreditsResponse) => void;
  /** Callback on error (after rollback) */
  onError?: (error: ConsumeCreditsError) => void;
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useConsumeCredits(options?: UseConsumeCreditsOptions) {
  const queryClient = useQueryClient();
  const { tenant } = useTenantAdminAuth();
  const { balance, isFreeTier } = useCredits();

  const tenantId = tenant?.id;

  const mutation = useMutation<
    ConsumeCreditsResponse,
    ConsumeCreditsError,
    ConsumeCreditsParams,
    { previousBalance: unknown }
  >({
    mutationFn: async (params: ConsumeCreditsParams) => {
      if (!tenantId) {
        throw { message: 'No tenant context available', code: 'NO_TENANT' };
      }

      // Pre-flight balance check for free tier users
      if (isFreeTier && balance < params.amount) {
        throw {
          message: 'Insufficient credits',
          code: 'INSUFFICIENT_BALANCE',
        };
      }

      const { data, error } = await supabase.functions.invoke('credits-use', {
        body: {
          amount: params.amount,
          reference_type: params.referenceType,
          reference_id: params.referenceId,
          description: params.description,
        },
      });

      if (error) {
        logger.error('credits-use edge function error', error, {
          tenantId,
          amount: params.amount,
        });
        throw {
          message: error.message || 'Failed to consume credits',
          code: 'EDGE_FUNCTION_ERROR',
        };
      }

      if (!data || !data.success) {
        const errorMessage = data?.error || 'Credit consumption failed';
        logger.warn('credits-use returned failure', {
          tenantId,
          amount: params.amount,
          error: errorMessage,
        });
        throw {
          message: errorMessage,
          code: data?.code || 'CONSUMPTION_FAILED',
        };
      }

      return {
        success: true,
        newBalance: data.balance ?? 0,
        transactionId: data.transaction_id ?? '',
        amount: params.amount,
      };
    },

    onMutate: async (params) => {
      // Cancel outgoing refetches to avoid overwriting optimistic update
      await queryClient.cancelQueries({ queryKey: ['credits', tenantId] });

      // Snapshot the previous value for rollback
      const previousBalance = queryClient.getQueryData(['credits', tenantId]);

      // Optimistic update: deduct credits immediately
      queryClient.setQueryData(['credits', tenantId], (oldData: unknown) => {
        if (!oldData || typeof oldData !== 'object') return oldData;
        const data = oldData as { balance?: number };
        return {
          ...data,
          balance: Math.max(0, (data.balance ?? 0) - params.amount),
        };
      });

      return { previousBalance };
    },

    onError: (error, _params, context) => {
      // Rollback optimistic update
      if (context?.previousBalance !== undefined) {
        queryClient.setQueryData(['credits', tenantId], context.previousBalance);
      }

      logger.error('Credit consumption failed, rolled back', new Error(error.message), {
        tenantId,
        code: error.code,
      });

      if (error.code === 'INSUFFICIENT_BALANCE') {
        toast.error('Insufficient Credits', {
          description: 'You do not have enough credits for this action.',
        });
      } else {
        toast.error('Credit Error', {
          description: 'An error occurred. Your credits have been restored.',
        });
      }

      options?.onError?.(error);
    },

    onSuccess: (data) => {
      // Invalidate to sync with server state
      queryClient.invalidateQueries({ queryKey: ['credits', tenantId] });

      toast.success('Credits consumed successfully', {
        description: `${data.amount} credits used. New balance: ${data.newBalance}`,
      });

      options?.onSuccess?.(data);
    },
  });

  /**
   * Check if the user has sufficient balance for the given amount.
   * Returns true for non-free-tier users (unlimited).
   */
  function hasSufficientBalance(amount: number): boolean {
    if (!isFreeTier) return true;
    return balance >= amount;
  }

  return {
    /** Execute credit consumption */
    consumeCredits: mutation.mutate,
    /** Execute credit consumption (async) */
    consumeCreditsAsync: mutation.mutateAsync,
    /** Whether a consumption is in progress */
    isConsuming: mutation.isPending,
    /** Whether the last consumption was successful */
    isSuccess: mutation.isSuccess,
    /** Whether the last consumption resulted in an error */
    isError: mutation.isError,
    /** The error from the last failed consumption */
    error: mutation.error,
    /** The response data from the last successful consumption */
    data: mutation.data,
    /** Check if balance is sufficient for a given amount */
    hasSufficientBalance,
    /** Current credit balance */
    balance,
    /** Whether user is on free tier */
    isFreeTier,
    /** Reset mutation state */
    reset: mutation.reset,
  };
}
