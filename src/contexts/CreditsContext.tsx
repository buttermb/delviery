/**
 * CreditsContext - User-facing Credit Management Provider
 *
 * Provides credit balance, transactions, purchase functionality, and
 * credit-gated action execution through context. Subscribes to real-time
 * credit balance updates via Supabase realtime and shows low balance
 * warnings when below threshold. Integrates with AuthContext for user identity.
 */

import { createContext, useContext, useCallback, useEffect, useState, useRef, type ReactNode } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { logger } from '@/lib/logger';
import { toast } from 'sonner';
import {
  getCreditBalance,
  getCreditTransactions,
  purchaseCredits as purchaseCreditsFn,
  consumeCredits,
  getCreditCost,
  getCreditCostInfo,
  LOW_CREDIT_WARNING_THRESHOLD,
  CRITICAL_CREDIT_THRESHOLD,
  LOW_BALANCE_WARNING_LEVELS,
  type CreditBalance,
  type CreditTransaction,
  type ConsumeCreditsResult,
} from '@/lib/credits';
import { showCreditDeductionToast } from '@/components/credits/CreditDeductionToast';

// ============================================================================
// Types
// ============================================================================

export interface CreditsActionResult {
  success: boolean;
  newBalance: number;
  creditsCost: number;
  errorMessage?: string;
}

export interface CreditsContextType {
  /** Current credit balance */
  balance: number;
  /** Whether balance data is loading */
  isLoading: boolean;
  /** Error from balance fetch */
  error: Error | null;
  /** Whether user is on free tier */
  isFreeTier: boolean;
  /** Whether credits are low (below warning threshold) */
  isLowCredits: boolean;
  /** Whether credits are critically low */
  isCriticalCredits: boolean;
  /** Whether user has no credits */
  isOutOfCredits: boolean;
  /** Lifetime credits earned */
  lifetimeEarned: number;
  /** Lifetime credits spent */
  lifetimeSpent: number;

  /** Recent credit transactions */
  transactions: CreditTransaction[];
  /** Whether transactions are loading */
  isLoadingTransactions: boolean;
  /** Refetch transactions */
  refetchTransactions: () => void;

  /** Purchase credits for the user's tenant */
  purchaseCredits: (amount: number, stripePaymentId?: string) => Promise<{ success: boolean; newBalance?: number; error?: string }>;
  /** Whether a purchase is in progress */
  isPurchasing: boolean;

  /** Execute a credit-gated action: checks balance, consumes credits, returns result */
  useCreditsAction: (
    actionKey: string,
    referenceId?: string,
    referenceType?: string
  ) => Promise<CreditsActionResult>;

  /** Refetch balance data */
  refetch: () => void;

  /** Whether low balance warning is visible */
  showLowBalanceWarning: boolean;
  /** Dismiss low balance warning */
  dismissLowBalanceWarning: () => void;
}

// ============================================================================
// Context
// ============================================================================

const CreditsContext = createContext<CreditsContextType | undefined>(undefined);

// ============================================================================
// Constants
// ============================================================================

const CREDITS_QUERY_KEY = 'user-credits';
const TRANSACTIONS_QUERY_KEY = 'user-credit-transactions';
const TRANSACTIONS_LIMIT = 20;

// ============================================================================
// Provider
// ============================================================================

export const CreditsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [showLowBalanceWarning, setShowLowBalanceWarning] = useState(false);
  const [shownWarningThresholds, setShownWarningThresholds] = useState<Set<number>>(new Set());
  const inFlightActionsRef = useRef<Set<string>>(new Set());

  // Derive tenant ID from user metadata (Supabase stores this in app_metadata)
  const tenantId = user?.app_metadata?.tenant_id as string | undefined;

  // --------------------------------------------------------------------------
  // Balance Query
  // --------------------------------------------------------------------------

  const {
    data: creditData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: [CREDITS_QUERY_KEY, tenantId],
    queryFn: async () => {
      if (!tenantId) return null;
      return getCreditBalance(tenantId);
    },
    enabled: !!tenantId && !!user,
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });

  // --------------------------------------------------------------------------
  // Transactions Query
  // --------------------------------------------------------------------------

  const {
    data: transactions,
    isLoading: isLoadingTransactions,
    refetch: refetchTransactions,
  } = useQuery({
    queryKey: [TRANSACTIONS_QUERY_KEY, tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      return getCreditTransactions(tenantId, { limit: TRANSACTIONS_LIMIT });
    },
    enabled: !!tenantId && !!user,
    staleTime: 60 * 1000,
  });

  // --------------------------------------------------------------------------
  // Real-time Subscription
  // --------------------------------------------------------------------------

  useEffect(() => {
    if (!tenantId) return;

    const channel = supabase
      .channel(`credits-ctx:${tenantId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tenant_credits',
          filter: `tenant_id=eq.${tenantId}`,
        },
        (payload) => {
          logger.info('CreditsContext: Real-time balance update', {
            event: payload.eventType,
            tenantId,
          });
          queryClient.invalidateQueries({ queryKey: [CREDITS_QUERY_KEY, tenantId] });
          queryClient.invalidateQueries({ queryKey: [TRANSACTIONS_QUERY_KEY, tenantId] });
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
          queryClient.invalidateQueries({ queryKey: [TRANSACTIONS_QUERY_KEY, tenantId] });
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          logger.debug('CreditsContext: Realtime subscribed', { tenantId });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenantId, queryClient]);

  // --------------------------------------------------------------------------
  // Derived Values
  // --------------------------------------------------------------------------

  const balance = creditData?.balance ?? 0;
  const isFreeTier = creditData?.isFreeTier ?? true;
  const lifetimeEarned = creditData?.lifetimeEarned ?? 0;
  const lifetimeSpent = creditData?.lifetimeSpent ?? 0;

  const isLowCredits = balance <= LOW_CREDIT_WARNING_THRESHOLD;
  const isCriticalCredits = balance <= CRITICAL_CREDIT_THRESHOLD;
  const isOutOfCredits = balance <= 0;

  // --------------------------------------------------------------------------
  // Low Balance Warning
  // --------------------------------------------------------------------------

  useEffect(() => {
    if (!tenantId || isLoading || !user) return;

    for (const threshold of LOW_BALANCE_WARNING_LEVELS) {
      if (shownWarningThresholds.has(threshold)) continue;

      if (balance <= threshold && balance > 0) {
        setShownWarningThresholds((prev) => new Set(prev).add(threshold));

        // Show warning once per session per threshold
        const sessionKey = `credits_warning_${threshold}_shown`;
        if (sessionStorage.getItem(sessionKey)) continue;
        sessionStorage.setItem(sessionKey, 'true');

        setShowLowBalanceWarning(true);

        if (threshold <= CRITICAL_CREDIT_THRESHOLD) {
          toast.warning('Critical Credit Balance', {
            description: `Only ${balance.toLocaleString()} credits remaining. Actions may be blocked.`,
            duration: 8000,
          });
        } else {
          toast.warning('Credits Running Low', {
            description: `You have ${balance.toLocaleString()} credits remaining.`,
            duration: 5000,
          });
        }

        logger.info('CreditsContext: Low balance warning shown', {
          threshold,
          balance,
          tenantId,
        });

        break;
      }
    }
  }, [balance, tenantId, isLoading, user, shownWarningThresholds]);

  const dismissLowBalanceWarning = useCallback(() => {
    setShowLowBalanceWarning(false);
  }, []);

  // --------------------------------------------------------------------------
  // Purchase Credits
  // --------------------------------------------------------------------------

  const purchaseMutation = useMutation({
    mutationFn: async ({ amount, stripePaymentId }: { amount: number; stripePaymentId?: string }) => {
      if (!tenantId) {
        return { success: false, error: 'No tenant found' };
      }
      return purchaseCreditsFn(tenantId, amount, stripePaymentId);
    },
    onSuccess: (result) => {
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: [CREDITS_QUERY_KEY, tenantId] });
        queryClient.invalidateQueries({ queryKey: [TRANSACTIONS_QUERY_KEY, tenantId] });
        toast.success('Credits Purchased', {
          description: `Your new balance is ${result.newBalance?.toLocaleString() ?? 'updated'} credits.`,
        });
      }
    },
  });

  const purchaseCredits = useCallback(
    async (amount: number, stripePaymentId?: string) => {
      return purchaseMutation.mutateAsync({ amount, stripePaymentId });
    },
    [purchaseMutation]
  );

  // --------------------------------------------------------------------------
  // Credit-Gated Action Execution
  // --------------------------------------------------------------------------

  const useCreditsAction = useCallback(
    async (
      actionKey: string,
      referenceId?: string,
      referenceType?: string
    ): Promise<CreditsActionResult> => {
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

      // Prevent double-execution
      const idempotencyKey = `${actionKey}:${referenceId || 'default'}`;
      if (inFlightActionsRef.current.has(idempotencyKey)) {
        logger.warn('CreditsContext: Duplicate action prevented', { actionKey, referenceId });
        return {
          success: false,
          newBalance: balance,
          creditsCost: 0,
          errorMessage: 'Action already in progress',
        };
      }

      // Check balance
      const cost = getCreditCost(actionKey);
      if (cost > 0 && balance < cost) {
        toast.error('Insufficient Credits', {
          description: `This action requires ${cost} credits, but you only have ${balance}.`,
        });
        return {
          success: false,
          newBalance: balance,
          creditsCost: cost,
          errorMessage: 'Insufficient credits',
        };
      }

      inFlightActionsRef.current.add(idempotencyKey);

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
          queryClient.invalidateQueries({ queryKey: [CREDITS_QUERY_KEY, tenantId] });
          queryClient.invalidateQueries({ queryKey: [TRANSACTIONS_QUERY_KEY, tenantId] });

          const costInfo = getCreditCostInfo(actionKey);
          if (costInfo && result.creditsCost > 0) {
            showCreditDeductionToast(
              result.creditsCost,
              costInfo.actionName,
              result.newBalance
            );
          }
        }

        return {
          success: result.success,
          newBalance: result.newBalance,
          creditsCost: result.creditsCost,
          errorMessage: result.errorMessage,
        };
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        logger.error('CreditsContext: Action failed', err instanceof Error ? err : new Error(errorMessage), {
          actionKey,
          tenantId,
        });
        return {
          success: false,
          newBalance: balance,
          creditsCost: 0,
          errorMessage,
        };
      } finally {
        inFlightActionsRef.current.delete(idempotencyKey);
      }
    },
    [tenantId, isFreeTier, balance, queryClient]
  );

  // --------------------------------------------------------------------------
  // Context Value
  // --------------------------------------------------------------------------

  const value: CreditsContextType = {
    balance,
    isLoading,
    error: error as Error | null,
    isFreeTier,
    isLowCredits,
    isCriticalCredits,
    isOutOfCredits,
    lifetimeEarned,
    lifetimeSpent,

    transactions: transactions ?? [],
    isLoadingTransactions,
    refetchTransactions,

    purchaseCredits,
    isPurchasing: purchaseMutation.isPending,

    useCreditsAction,

    refetch,

    showLowBalanceWarning,
    dismissLowBalanceWarning,
  };

  return (
    <CreditsContext.Provider value={value}>
      {children}
    </CreditsContext.Provider>
  );
};

// ============================================================================
// Hook
// ============================================================================

export const useCreditsContext = () => {
  const context = useContext(CreditsContext);
  if (!context) {
    throw new Error('useCreditsContext must be used within a CreditsProvider');
  }
  return context;
};
