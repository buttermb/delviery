/**
 * useCreditGate Hook
 *
 * Lightweight wrapper for gating useMutation calls with credit checks.
 * Unlike useCreditGatedAction (which manages its own execution flow),
 * this hook wraps an existing mutation's mutationFn to inject credit
 * checks and consumption transparently.
 *
 * Usage:
 *   const { gate, cost, canAfford, isFreeTier } = useCreditGate('order_create_manual');
 *
 *   const mutation = useMutation({
 *     mutationFn: gate(async (input: OrderInput) => {
 *       const { data, error } = await supabase.from('orders').insert(input).select().maybeSingle();
 *       if (error) throw error;
 *       return data;
 *     }),
 *     onSuccess: () => {
 *       queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });
 *       toast.success('Order created');
 *     },
 *   });
 */

import { useCallback, useRef, useMemo } from 'react';
import { useCredits } from '@/hooks/useCredits';
import { getCreditCost, getCreditCostInfo } from '@/lib/credits';
import { logger } from '@/lib/logger';

// ============================================================================
// Types
// ============================================================================

export interface UseCreditGateOptions {
  /** Optional reference type for credit tracking (e.g., 'order', 'menu') */
  referenceType?: string;
  /** Optional callback when action is blocked due to insufficient credits */
  onInsufficientCredits?: (actionKey: string, cost: number, balance: number) => void;
}

export interface UseCreditGateReturn {
  /** Wraps a mutation function with credit gating */
  gate: <TArgs extends unknown[], TResult>(
    fn: (...args: TArgs) => Promise<TResult>
  ) => (...args: TArgs) => Promise<TResult>;
  /** The credit cost for this action */
  cost: number;
  /** The human-readable action name */
  actionName: string | null;
  /** Whether the current balance can afford this action */
  canAfford: boolean;
  /** Whether the user is on free tier (credit-gated) */
  isFreeTier: boolean;
  /** Current credit balance */
  balance: number;
}

// ============================================================================
// Hook
// ============================================================================

export function useCreditGate(
  actionKey: string,
  options?: UseCreditGateOptions
): UseCreditGateReturn {
  const credits = useCredits();

  const cost = useMemo(() => getCreditCost(actionKey), [actionKey]);
  const costInfo = useMemo(() => getCreditCostInfo(actionKey), [actionKey]);

  const canAfford = useMemo(() => {
    if (!credits.isFreeTier) return true;
    return credits.hasCredits(cost);
  }, [credits.isFreeTier, credits.hasCredits, cost]);

  // Use refs to avoid stale closures in the gate function.
  // gate() returns a function that may be called later,
  // so it must read the latest values at call time.
  const creditsRef = useRef(credits);
  creditsRef.current = credits;

  const optionsRef = useRef(options);
  optionsRef.current = options;

  const gate = useCallback(
    <TArgs extends unknown[], TResult>(
      fn: (...args: TArgs) => Promise<TResult>
    ): ((...args: TArgs) => Promise<TResult>) => {
      return async (...args: TArgs): Promise<TResult> => {
        const currentCredits = creditsRef.current;
        const currentOptions = optionsRef.current;

        // Free actions bypass credit gate
        if (cost === 0) {
          return fn(...args);
        }

        // Non-free-tier users bypass credit gate
        if (!currentCredits.isFreeTier) {
          return fn(...args);
        }

        // Check balance
        if (!currentCredits.hasCredits(cost)) {
          logger.info('Credit gate blocked action', {
            actionKey,
            cost,
            balance: currentCredits.balance,
          });
          currentOptions?.onInsufficientCredits?.(
            actionKey,
            cost,
            currentCredits.balance
          );
          throw new CreditGateError(actionKey, cost, currentCredits.balance);
        }

        // Consume credits first
        const creditResult = await currentCredits.performAction(
          actionKey,
          undefined,
          currentOptions?.referenceType
        );

        if (!creditResult.success) {
          logger.warn('Credit consumption failed', {
            actionKey,
            errorMessage: creditResult.errorMessage,
          });
          currentOptions?.onInsufficientCredits?.(
            actionKey,
            cost,
            currentCredits.balance
          );
          throw new CreditGateError(
            actionKey,
            cost,
            currentCredits.balance,
            creditResult.errorMessage
          );
        }

        // Execute the actual mutation
        return fn(...args);
      };
    },
    [actionKey, cost]
  );

  return {
    gate,
    cost,
    actionName: costInfo?.actionName ?? null,
    canAfford,
    isFreeTier: credits.isFreeTier,
    balance: credits.balance,
  };
}

// ============================================================================
// Error Class
// ============================================================================

export class CreditGateError extends Error {
  public readonly actionKey: string;
  public readonly creditCost: number;
  public readonly currentBalance: number;

  constructor(
    actionKey: string,
    creditCost: number,
    currentBalance: number,
    message?: string
  ) {
    super(message ?? `Insufficient credits for ${actionKey}: need ${creditCost}, have ${currentBalance}`);
    this.name = 'CreditGateError';
    this.actionKey = actionKey;
    this.creditCost = creditCost;
    this.currentBalance = currentBalance;
  }
}
