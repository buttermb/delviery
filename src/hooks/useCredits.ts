/**
 * useCredits Hook - Master Credits Hook
 *
 * Fetches credit balance from the credits-balance edge function.
 * Provides balance, lifetimeStats, subscription info, and hasCredits check.
 * Auto-refreshes every 30 seconds and invalidates on relevant mutations.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { logger } from '@/lib/logger';
import { queryKeys } from '@/lib/queryKeys';
import {
  consumeCredits,
  trackCreditEvent,
  getCreditCost,
  getCreditCostInfo,
  LOW_CREDIT_WARNING_THRESHOLD,
  CRITICAL_CREDIT_THRESHOLD,
  FREE_TIER_MONTHLY_CREDITS,
  LOW_BALANCE_WARNING_LEVELS,
  type CreditBalance,
  type ConsumeCreditsResult,
} from '@/lib/credits';
import { showCreditDeductionToast } from '@/components/credits/CreditDeductionToast';
import { toast } from 'sonner';
import { humanizeError } from '@/lib/humanizeError';

// ============================================================================
// Types
// ============================================================================

export interface LifetimeStats {
  earned: number;
  spent: number;
  purchased: number;
  expired: number;
  refunded: number;
}

export interface SubscriptionInfo {
  status: 'active' | 'trial' | 'cancelled' | 'past_due' | 'none';
  isFreeTier: boolean;
  creditsPerPeriod: number;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

export interface CreditsBalanceResponse {
  balance: number;
  lifetimeStats: LifetimeStats;
  subscription: SubscriptionInfo;
  nextFreeGrantAt: string | null;
  pendingTransactions: number;
}

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

  // Structured data
  lifetimeStats: LifetimeStats;
  subscription: SubscriptionInfo;

  // Legacy helper values (backward compat)
  lifetimeEarned: number;
  lifetimeSpent: number;
  nextFreeGrantAt: Date | null;
  percentUsed: number;

  // Functions
  hasCredits: (amount: number) => boolean;
  canPerformAction: (actionKey: string) => Promise<boolean>;
  performAction: (
    actionKey: string,
    referenceId?: string,
    referenceType?: string
  ) => Promise<ConsumeCreditsResult>;
  refetch: () => void;
  invalidate: () => void;
}

// ============================================================================
// Constants
// ============================================================================

const REFETCH_INTERVAL_MS = 30_000; // 30 seconds
const STALE_TIME_MS = 15_000; // 15 seconds

const DEFAULT_LIFETIME_STATS: LifetimeStats = {
  earned: FREE_TIER_MONTHLY_CREDITS,
  spent: 0,
  purchased: 0,
  expired: 0,
  refunded: 0,
};

const DEFAULT_SUBSCRIPTION: SubscriptionInfo = {
  status: 'none',
  isFreeTier: true,
  creditsPerPeriod: FREE_TIER_MONTHLY_CREDITS,
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
};

// Client-side rate limiting config
const RATE_LIMIT = {
  maxOperations: 30,
  windowMs: 60 * 1000, // 1 minute
};

/**
 * Get warning message based on threshold level
 */
function getWarningMessage(threshold: number, balance: number): { title: string; description: string } | null {
  switch (threshold) {
    case 2000:
      return {
        title: 'Credits Running Low',
        description: `You have ${balance.toLocaleString()} credits remaining. Consider purchasing more to avoid interruptions.`,
      };
    case 1000:
      return {
        title: 'Credit Balance Warning',
        description: `Only ${balance.toLocaleString()} credits left. Some features may become unavailable soon.`,
      };
    case 500:
      return {
        title: 'Low Credit Balance',
        description: `${balance.toLocaleString()} credits remaining. Purchase credits now to continue using premium features.`,
      };
    case 100:
      return {
        title: 'Critical Credit Balance',
        description: `Only ${balance.toLocaleString()} credits left! Actions will be blocked when credits run out.`,
      };
    default:
      return null;
  }
}

// Safe wrapper to get tenant and session
// Note: useTenantAdminAuth must be called unconditionally per React hooks rules
function useTenantSafe() {
  const authContext = useTenantAdminAuth();
  // Return tenant from context, or null if context is unavailable
  return { tenant: authContext?.tenant ?? null, session: null };
}

// Fetch credits balance from edge function
async function fetchCreditsBalance(tenantId: string): Promise<CreditsBalanceResponse> {
  const { data, error } = await supabase.functions.invoke('credits-balance', {
    body: { tenant_id: tenantId },
  });

  if (error) {
    logger.error('Failed to fetch credits balance', error, { tenantId });
    throw error;
  }

  return data as CreditsBalanceResponse;
}

export function useCredits(): UseCreditsReturn {
  const { tenant, session } = useTenantSafe();
  const queryClient = useQueryClient();
  const [showWarning, setShowWarning] = useState(false);
  // Track which warning thresholds have been shown to avoid duplicates
  const [shownWarningThresholds, setShownWarningThresholds] = useState<Set<number>>(new Set());
  // RACE CONDITION FIX: Track in-flight actions to prevent double-execution
  const [inFlightActions, setInFlightActions] = useState<Set<string>>(new Set());
  const [recentOperations, setRecentOperations] = useState<number[]>([]);

  const tenantId = tenant?.id;
  // Only fetch credits when both tenant AND session exist (user is authenticated)
  const isAuthenticated = !!session?.access_token;

  // Fetch credit balance from credits-balance edge function
  const {
    data: creditData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: queryKeys.credits.balance(tenantId),
    queryFn: () => fetchCreditsBalance(tenantId!),
    enabled: !!tenantId && isAuthenticated,
    staleTime: STALE_TIME_MS,
    refetchInterval: REFETCH_INTERVAL_MS,
  });

  // Subscribe to real-time credit updates for instant invalidation
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
        () => {
          queryClient.invalidateQueries({ queryKey: queryKeys.credits.all });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'credit_transactions',
          filter: `tenant_id=eq.${tenantId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: queryKeys.credits.all });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenantId, queryClient]);

  // Derived values
  const balance = creditData?.balance ?? FREE_TIER_MONTHLY_CREDITS;
  const lifetimeStats: LifetimeStats = creditData?.lifetimeStats ?? DEFAULT_LIFETIME_STATS;
  const subscription: SubscriptionInfo = creditData?.subscription ?? DEFAULT_SUBSCRIPTION;
  
  // CRITICAL: If credits are disabled for tenant OR they have a paid plan,
  // force isFreeTier to false to prevent credit warnings
  const isPaidPlan = tenant?.subscription_plan === 'professional' || 
                     tenant?.subscription_plan === 'enterprise';
  const hasActiveStatus = tenant?.subscription_status === 'active';
  const creditsDisabled = (tenant as { credits_enabled?: boolean })?.credits_enabled === false;
  
  // Determine isFreeTier: use subscription data if available, else fallback to tenant context
  const isFreeTier = creditData 
    ? subscription.isFreeTier 
    : !(creditsDisabled || isPaidPlan || hasActiveStatus);

  // Legacy backward-compat values
  const lifetimeEarned = lifetimeStats.earned;
  const lifetimeSpent = lifetimeStats.spent;
  const nextFreeGrantAt = creditData?.nextFreeGrantAt
    ? new Date(creditData.nextFreeGrantAt)
    : null;

  // Status flags - ONLY show warnings for true free tier users
  const isLowCredits = isFreeTier && !creditsDisabled && balance <= LOW_CREDIT_WARNING_THRESHOLD;
  const isCriticalCredits = isFreeTier && !creditsDisabled && balance <= CRITICAL_CREDIT_THRESHOLD;
  const isOutOfCredits = isFreeTier && !creditsDisabled && balance <= 0;

  // Calculate percent used
  const percentUsed = useMemo(() => {
    if (!isFreeTier || lifetimeEarned === 0) return 0;
    return Math.round((lifetimeSpent / lifetimeEarned) * 100);
  }, [isFreeTier, lifetimeSpent, lifetimeEarned]);

  // hasCredits: Check if current balance is sufficient for a given amount
  const hasCredits = useCallback((amount: number): boolean => {
    if (!isFreeTier) return true;
    return balance >= amount;
  }, [isFreeTier, balance]);

  // Invalidate all credit queries (useful after mutations)
  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.credits.all });
  }, [queryClient]);

  // Track low credit warnings
  useEffect(() => {
    if (isLowCredits && !showWarning && tenantId) {
      setShowWarning(true);
      trackCreditEvent(tenantId, 'low_credit_warning_shown', balance);
    }
  }, [isLowCredits, showWarning, tenantId, balance]);

  // Show progressive low balance warnings at 2000, 1000, 500, 100 credits
  useEffect(() => {
    if (!tenantId || !isFreeTier || isLoading) return;

    // Check each warning level threshold
    for (const threshold of LOW_BALANCE_WARNING_LEVELS) {
      // Skip if we've already shown this warning
      if (shownWarningThresholds.has(threshold)) continue;

      // Show warning if balance just dropped to or below this threshold
      if (balance <= threshold) {
        setShownWarningThresholds(prev => new Set(prev).add(threshold));
        trackCreditEvent(tenantId, `low_balance_warning_${threshold}`, balance);

        // Show appropriate toast based on threshold severity
        const warningMessage = getWarningMessage(threshold, balance);
        if (warningMessage) {
          toast.warning(warningMessage.title, {
            description: warningMessage.description,
            duration: threshold <= 500 ? 8000 : 5000, // Longer duration for critical warnings
            action: threshold <= 500 ? {
              label: 'Buy Credits',
              onClick: () => {
                // This will be handled by the CreditContext opening the modal
                logger.info('Low balance warning: Buy Credits clicked', { threshold, balance });
              },
            } : undefined,
          });
        }

        // Only show one warning per balance check
        break;
      }
    }
  }, [balance, tenantId, isFreeTier, isLoading, shownWarningThresholds]);

  // Check if can perform action
  const canPerformAction = useCallback(async (actionKey: string): Promise<boolean> => {
    if (!tenantId) return false;
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

    if (!isFreeTier) {
      return {
        success: true,
        newBalance: -1,
        creditsCost: 0,
      };
    }

    // Client-side rate limiting
    const now = Date.now();
    const recentOps = recentOperations.filter(t => now - t < RATE_LIMIT.windowMs);
    if (recentOps.length >= RATE_LIMIT.maxOperations) {
      logger.warn('Client-side rate limit exceeded', { actionKey, operationsInWindow: recentOps.length });
      return {
        success: false,
        newBalance: balance,
        creditsCost: 0,
        errorMessage: 'Too many requests. Please wait a moment.',
      };
    }

    // Prevent double-execution of same action
    const idempotencyKey = `${actionKey}:${referenceId || 'default'}`;
    if (inFlightActions.has(idempotencyKey)) {
      logger.warn('Duplicate action prevented', { actionKey, referenceId });
      return {
        success: false,
        newBalance: balance,
        creditsCost: 0,
        errorMessage: 'Action already in progress',
      };
    }

    setInFlightActions(prev => new Set(prev).add(idempotencyKey));
    setRecentOperations(prev => [...prev.filter(t => now - t < RATE_LIMIT.windowMs), now]);

    try {
      const safeReferenceId = referenceId || crypto.randomUUID();

      const result = await consumeCredits(
        tenantId,
        actionKey,
        safeReferenceId,
        undefined,
        referenceType ? { reference_type: referenceType } : undefined
      );

      if (result.success) {
        // Invalidate credit queries after consumption
        queryClient.invalidateQueries({ queryKey: queryKeys.credits.all });

        const costInfo = getCreditCostInfo(actionKey);
        if (costInfo && result.creditsCost > 0) {
          showCreditDeductionToast(
            result.creditsCost,
            costInfo.actionName,
            result.newBalance
          );
        }
      } else {
        trackCreditEvent(
          tenantId,
          'action_blocked_insufficient_credits',
          balance,
          actionKey
        );
      }
      return result;
    } finally {
      setInFlightActions(prev => {
        const next = new Set(prev);
        next.delete(idempotencyKey);
        return next;
      });
    }
  }, [tenantId, isFreeTier, balance, queryClient, inFlightActions, recentOperations]);

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

    // Structured data
    lifetimeStats,
    subscription,

    // Legacy helper values
    lifetimeEarned,
    lifetimeSpent,
    nextFreeGrantAt,
    percentUsed,

    // Functions
    hasCredits,
    canPerformAction,
    performAction,
    refetch,
    invalidate,
  };
}

// ============================================================================
// Helper Hook for Credit-Gated Actions
// ============================================================================

/**
 * Hook that wraps an action with credit checking.
 * Use this to gate specific actions behind credit consumption.
 */
export function useCreditGatedAction() {
  const {
    isFreeTier,
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
    if (isPerforming) {
      return null;
    }

    const canDo = await canPerformAction(actionKey);
    if (!canDo) {
      options?.onInsufficientCredits?.();
      return null;
    }

    setIsPerforming(true);
    try {
      const creditResult = await performAction(
        actionKey,
        options?.referenceId,
        options?.referenceType
      );

      if (!creditResult.success) {
        if (creditResult.errorMessage && creditResult.errorMessage !== 'Insufficient credits') {
          toast.error('Action Failed', {
            description: creditResult.errorMessage,
          });
        }

        options?.onInsufficientCredits?.();
        return null;
      }

      const result = await action();
      return result;
    } catch (error) {
      toast.error('Action Failed', {
        description: humanizeError(error),
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
// Utility: Invalidate credits on relevant mutations
// ============================================================================

/**
 * Returns mutation options that invalidate credit queries on success.
 * Spread into any useMutation call that affects credits.
 */
export function withCreditInvalidation(queryClient: ReturnType<typeof useQueryClient>) {
  return {
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.credits.all });
    },
  };
}

// ============================================================================
// Export Types
// ============================================================================

export type { CreditBalance, ConsumeCreditsResult };
