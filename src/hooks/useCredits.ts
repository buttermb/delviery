/**
 * useCredits Hook
 * 
 * Provides real-time credit balance and credit operations for components.
 * Handles credit checking, consumption, and low credit warnings.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { logger } from '@/lib/logger';
import { queryKeys } from '@/lib/queryKeys';
import {
  getCreditBalance,
  checkCredits,
  consumeCredits,
  trackCreditEvent,
  getCreditCost,
  getCreditCostInfo,
  LOW_CREDIT_WARNING_THRESHOLD,
  CRITICAL_CREDIT_THRESHOLD,
  FREE_TIER_MONTHLY_CREDITS,
  type CreditBalance,
  type ConsumeCreditsResult,
} from '@/lib/credits';
import { showCreditDeductionToast } from '@/components/credits/CreditDeductionToast';
import { toast } from 'sonner';

// ============================================================================
// Types
// ============================================================================

export interface UseCreditsReturn {
  // Balance info
  balance: number;
  isFreeTier: boolean;
  isLoading: boolean;
  error: Error | null;

  // Status flags
  isLowCredits: boolean;
  isCriticalCredits: boolean;
  isOutOfCredits: boolean;

  // Helper values
  lifetimeEarned: number;
  lifetimeSpent: number;
  nextFreeGrantAt: Date | null;
  percentUsed: number;

  // Actions
  canPerformAction: (actionKey: string) => Promise<boolean>;
  performAction: (
    actionKey: string,
    referenceId?: string,
    referenceType?: string
  ) => Promise<ConsumeCreditsResult>;
  refetch: () => void;
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useCredits(): UseCreditsReturn {
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();
  const [showWarning, setShowWarning] = useState(false);

  const tenantId = tenant?.id;

  // Fetch credit balance
  const {
    data: creditData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['credits', tenantId],
    queryFn: async () => {
      if (!tenantId) return null;
      return getCreditBalance(tenantId);
    },
    enabled: !!tenantId,
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 60 * 1000, // Refetch every minute
  });

  // Subscribe to real-time credit updates
  useEffect(() => {
    if (!tenantId) return;

    const channel = supabase
      .channel(`credits:${tenantId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tenant_credits',
          filter: `tenant_id=eq.${tenantId}`,
        },
        (payload) => {
          logger.info('Credit balance updated', { payload });
          queryClient.invalidateQueries({ queryKey: ['credits', tenantId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenantId, queryClient]);

  // Derived values
  const balance = creditData?.balance ?? FREE_TIER_MONTHLY_CREDITS;
  const isFreeTier = creditData?.isFreeTier ?? false;
  const lifetimeEarned = creditData?.lifetimeEarned ?? FREE_TIER_MONTHLY_CREDITS;
  const lifetimeSpent = creditData?.lifetimeSpent ?? 0;
  const nextFreeGrantAt = creditData?.nextFreeGrantAt
    ? new Date(creditData.nextFreeGrantAt)
    : null;

  // Status flags
  const isLowCredits = isFreeTier && balance <= LOW_CREDIT_WARNING_THRESHOLD;
  const isCriticalCredits = isFreeTier && balance <= CRITICAL_CREDIT_THRESHOLD;
  const isOutOfCredits = isFreeTier && balance <= 0;

  // Calculate percent used
  const percentUsed = useMemo(() => {
    if (!isFreeTier || lifetimeEarned === 0) return 0;
    return Math.round((lifetimeSpent / lifetimeEarned) * 100);
  }, [isFreeTier, lifetimeSpent, lifetimeEarned]);

  // Track low credit warnings
  useEffect(() => {
    if (isLowCredits && !showWarning && tenantId) {
      setShowWarning(true);
      trackCreditEvent(tenantId, 'low_credit_warning_shown', balance);
    }
  }, [isLowCredits, showWarning, tenantId, balance]);

  // Check if can perform action
  const canPerformAction = useCallback(async (actionKey: string): Promise<boolean> => {
    if (!tenantId) return false;

    // Not on free tier = unlimited
    if (!isFreeTier) return true;

    const cost = getCreditCost(actionKey);
    if (cost === 0) return true;

    return balance >= cost;
  }, [tenantId, isFreeTier, balance]);

  // Perform action with credit consumption
  const performAction = useCallback(async (
    actionKey: string,
    referenceId?: string,
    referenceType?: string
  ): Promise<ConsumeCreditsResult> => {
    if (!tenantId) {
      return {
        success: false,
        newBalance: 0,
        creditsCost: 0,
        errorMessage: 'No tenant found',
      };
    }

    // Not on free tier = skip credit consumption
    if (!isFreeTier) {
      return {
        success: true,
        newBalance: -1,
        creditsCost: 0,
      };
    }

    // IDEMPOTENCY FIX: Ensure we always have a reference ID
    const safeReferenceId = referenceId || crypto.randomUUID();

    const result = await consumeCredits(
      tenantId,
      actionKey,
      safeReferenceId,
      referenceType
    );

    // Refetch balance after consumption
    if (result.success) {
      queryClient.invalidateQueries({ queryKey: ['credits', tenantId] });

      // Show credit deduction toast
      const costInfo = getCreditCostInfo(actionKey);
      if (costInfo && result.creditsCost > 0) {
        showCreditDeductionToast(
          result.creditsCost,
          costInfo.actionName,
          result.newBalance
        );
      }
    } else {
      // Track failed action due to insufficient credits
      trackCreditEvent(
        tenantId,
        'action_blocked_insufficient_credits',
        balance,
        actionKey
      );
    }

    return result;
  }, [tenantId, isFreeTier, balance, queryClient]);

  return {
    // Balance info
    balance,
    isFreeTier,
    isLoading,
    error: error as Error | null,

    // Status flags
    isLowCredits,
    isCriticalCredits,
    isOutOfCredits,

    // Helper values
    lifetimeEarned,
    lifetimeSpent,
    nextFreeGrantAt,
    percentUsed,

    // Actions
    canPerformAction,
    performAction,
    refetch,
  };
}

// ============================================================================
// Helper Hook for Credit-Gated Actions
// ============================================================================

/**
 * Hook that wraps an action with credit checking
 * Use this to gate specific actions behind credit consumption
 */
export function useCreditGatedAction() {
  const {
    isFreeTier,
    balance,
    canPerformAction,
    performAction
  } = useCredits();
  const [isPerforming, setIsPerforming] = useState(false);

  const execute = useCallback(async <T>(
    actionKey: string,
    action: () => Promise<T>,
    options?: {
      onInsufficientCredits?: () => void;
      referenceId?: string;
      referenceType?: string;
    }
  ): Promise<T | null> => {
    // RACE CONDITION FIX: Prevent double-execution
    if (isPerforming) {
      return null;
    }

    // Check credits first
    const canDo = await canPerformAction(actionKey);
    if (!canDo) {
      options?.onInsufficientCredits?.();
      return null;
    }

    setIsPerforming(true);
    try {
      // Consume credits
      const creditResult = await performAction(
        actionKey,
        options?.referenceId,
        options?.referenceType
      );

      if (!creditResult.success) {
        // If it's a specific system error (not just low balance), show it
        if (creditResult.errorMessage && creditResult.errorMessage !== 'Insufficient credits') {
          toast.error('Action Failed', {
            description: creditResult.errorMessage,
          });
        }

        options?.onInsufficientCredits?.();
        return null;
      }

      // Execute the actual action
      const result = await action();
      return result;
    } catch (err) {
      // Catch unexpected errors during execution
      toast.error('Action Failed', {
        description: 'An unexpected error occurred. Please try again.',
      });
      return null;
    } finally {
      setIsPerforming(false);
    }
  }, [canPerformAction, performAction, isPerforming]);

  return {
    execute,
    isPerforming,
    isFreeTier,
  };
}

// ============================================================================
// Export Types
// ============================================================================

export type { CreditBalance, ConsumeCreditsResult };







