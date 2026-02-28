/**
 * useCreditGatedAction Hook
 *
 * A specialized hook for gating actions behind credit consumption with:
 * - Pre-action balance checking
 * - OutOfCreditsModal integration when insufficient
 * - Optimistic UI updates (deduct immediately)
 * - Automatic rollback on error
 * - Pre-configured hooks for common actions
 */

import { useState, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useCredits } from '@/hooks/useCredits';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { logger } from '@/lib/logger';
import { getCreditCost, getCreditCostInfo } from '@/lib/credits';
import { queryKeys } from '@/lib/queryKeys';

// ============================================================================
// Types
// ============================================================================

export interface CreditGatedActionOptions<T> {
  /** The credit action key (e.g., 'menu_create', 'marketplace_order_created') */
  actionKey: string;
  /** The async action to execute after credits are verified */
  action: () => Promise<T>;
  /** Optional reference ID for idempotency */
  referenceId?: string;
  /** Optional reference type for tracking */
  referenceType?: string;
  /** Callback when user lacks credits (opens modal) */
  onInsufficientCredits?: (actionKey: string) => void;
  /** Callback on successful action completion */
  onSuccess?: (result: T) => void;
  /** Callback on action error (after rollback) */
  onError?: (error: Error) => void;
  /** Skip showing the OutOfCreditsModal (for custom handling) */
  skipModal?: boolean;
}

export interface CreditGatedActionResult<T> {
  success: boolean;
  result?: T;
  error?: Error;
  creditsCost: number;
  wasBlocked: boolean;
}

export interface UseCreditGatedActionReturn {
  /**
   * Execute a credit-gated action
   * - Checks balance before executing
   * - Optimistically deducts credits
   * - Reverts on error
   */
  execute: <T>(
    options: CreditGatedActionOptions<T>
  ) => Promise<CreditGatedActionResult<T>>;
  /** Whether an action is currently executing */
  isExecuting: boolean;
  /** Whether the out of credits modal should be shown */
  showOutOfCreditsModal: boolean;
  /** Close the out of credits modal */
  closeOutOfCreditsModal: () => void;
  /** The action that was blocked (for modal display) */
  blockedAction: string | null;
  /** Current credit balance */
  balance: number;
  /** Whether on free tier */
  isFreeTier: boolean;
}

// ============================================================================
// Main Hook
// ============================================================================

export function useCreditGatedAction(): UseCreditGatedActionReturn {
  const queryClient = useQueryClient();
  const { tenant } = useTenantAdminAuth();
  const {
    balance,
    isFreeTier,
    canPerformAction,
    performAction,
  } = useCredits();

  const [isExecuting, setIsExecuting] = useState(false);
  const [showOutOfCreditsModal, setShowOutOfCreditsModal] = useState(false);
  const [blockedAction, setBlockedAction] = useState<string | null>(null);

  // Track in-flight actions to prevent double execution
  const inFlightRef = useRef<Set<string>>(new Set());

  const tenantId = tenant?.id;

  const execute = useCallback(
    async <T>(
      options: CreditGatedActionOptions<T>
    ): Promise<CreditGatedActionResult<T>> => {
      const {
        actionKey,
        action,
        referenceId,
        referenceType,
        onInsufficientCredits,
        onSuccess,
        onError,
        skipModal = false,
      } = options;

      // Get credit cost info
      const cost = getCreditCost(actionKey);
      getCreditCostInfo(actionKey);

      // Create idempotency key
      const idempotencyKey = `${actionKey}:${referenceId || crypto.randomUUID()}`;

      // Prevent double execution
      if (inFlightRef.current.has(idempotencyKey)) {
        logger.warn('Duplicate credit-gated action prevented', {
          actionKey,
          referenceId,
        });
        return {
          success: false,
          creditsCost: 0,
          wasBlocked: true,
          error: new Error('Action already in progress'),
        };
      }

      // Skip credit check for non-free-tier users
      if (!isFreeTier) {
        try {
          setIsExecuting(true);
          inFlightRef.current.add(idempotencyKey);
          const result = await action();
          onSuccess?.(result);
          return {
            success: true,
            result,
            creditsCost: 0,
            wasBlocked: false,
          };
        } catch (err) {
          const error = err instanceof Error ? err : new Error(String(err));
          onError?.(error);
          return {
            success: false,
            error,
            creditsCost: 0,
            wasBlocked: false,
          };
        } finally {
          setIsExecuting(false);
          inFlightRef.current.delete(idempotencyKey);
        }
      }

      // Check if user has enough credits
      const canDo = await canPerformAction(actionKey);
      if (!canDo) {
        logger.info('Credit-gated action blocked due to insufficient credits', {
          actionKey,
          balance,
          cost,
        });

        // Store blocked action for modal
        setBlockedAction(actionKey);

        // Show modal unless skipped
        if (!skipModal) {
          setShowOutOfCreditsModal(true);
        }

        // Call custom callback
        onInsufficientCredits?.(actionKey);

        return {
          success: false,
          creditsCost: cost,
          wasBlocked: true,
        };
      }

      // Start executing
      setIsExecuting(true);
      inFlightRef.current.add(idempotencyKey);

      // Store previous balance for rollback
      const previousBalance = balance;

      try {
        // OPTIMISTIC UPDATE: Deduct credits immediately in the UI
        queryClient.setQueryData(queryKeys.credits.balance(tenantId), (oldData: unknown) => {
          if (!oldData || typeof oldData !== 'object') return oldData;
          const data = oldData as { balance?: number };
          return {
            ...data,
            balance: Math.max(0, (data.balance ?? 0) - cost),
          };
        });

        // Consume credits via the service
        const creditResult = await performAction(actionKey, referenceId, referenceType);

        if (!creditResult.success) {
          // ROLLBACK: Revert optimistic update
          queryClient.setQueryData(queryKeys.credits.balance(tenantId), (oldData: unknown) => {
            if (!oldData || typeof oldData !== 'object') return oldData;
            return {
              ...(oldData as object),
              balance: previousBalance,
            };
          });

          // Handle insufficient credits error
          if (
            creditResult.errorMessage === 'Insufficient credits' ||
            creditResult.errorMessage?.includes('insufficient')
          ) {
            setBlockedAction(actionKey);
            if (!skipModal) {
              setShowOutOfCreditsModal(true);
            }
            onInsufficientCredits?.(actionKey);
            return {
              success: false,
              creditsCost: cost,
              wasBlocked: true,
            };
          }

          // Other errors
          const error = new Error(creditResult.errorMessage || 'Credit consumption failed');
          onError?.(error);
          return {
            success: false,
            error,
            creditsCost: 0,
            wasBlocked: false,
          };
        }

        // Execute the actual action
        const result = await action();

        // Sync with server balance
        queryClient.invalidateQueries({ queryKey: queryKeys.credits.balance(tenantId) });

        onSuccess?.(result);

        logger.info('Credit-gated action completed successfully', {
          actionKey,
          creditsCost: creditResult.creditsCost,
          newBalance: creditResult.newBalance,
        });

        return {
          success: true,
          result,
          creditsCost: creditResult.creditsCost,
          wasBlocked: false,
        };
      } catch (err) {
        // ROLLBACK: Revert optimistic update on action failure
        logger.error('Credit-gated action failed, rolling back', err as Error, {
          actionKey,
          previousBalance,
        });

        queryClient.setQueryData(queryKeys.credits.balance(tenantId), (oldData: unknown) => {
          if (!oldData || typeof oldData !== 'object') return oldData;
          return {
            ...(oldData as object),
            balance: previousBalance,
          };
        });

        // Invalidate to sync with server
        queryClient.invalidateQueries({ queryKey: queryKeys.credits.balance(tenantId) });

        const error = err instanceof Error ? err : new Error(String(err));
        toast.error('Action Failed', {
          description: 'An error occurred. Your credits have been restored.',
        });

        onError?.(error);

        return {
          success: false,
          error,
          creditsCost: 0,
          wasBlocked: false,
        };
      } finally {
        setIsExecuting(false);
        inFlightRef.current.delete(idempotencyKey);
      }
    },
    [tenantId, balance, isFreeTier, canPerformAction, performAction, queryClient]
  );

  const closeOutOfCreditsModal = useCallback(() => {
    setShowOutOfCreditsModal(false);
    setBlockedAction(null);
  }, []);

  return {
    execute,
    isExecuting,
    showOutOfCreditsModal,
    closeOutOfCreditsModal,
    blockedAction,
    balance,
    isFreeTier,
  };
}

// ============================================================================
// Pre-configured Hooks
// ============================================================================

/**
 * Pre-configured hook for menu generation actions
 * Uses 'menu_create' action key (100 credits)
 */
export function useGenerateMenu() {
  const creditGated = useCreditGatedAction();

  const generateMenu = useCallback(
    async <T>(
      action: () => Promise<T>,
      options?: {
        menuId?: string;
        onInsufficientCredits?: () => void;
        onSuccess?: (result: T) => void;
        onError?: (error: Error) => void;
      }
    ) => {
      return creditGated.execute({
        actionKey: 'menu_create',
        action,
        referenceId: options?.menuId,
        referenceType: 'menu',
        onInsufficientCredits: options?.onInsufficientCredits,
        onSuccess: options?.onSuccess,
        onError: options?.onError,
      });
    },
    [creditGated]
  );

  return {
    generateMenu,
    isGenerating: creditGated.isExecuting,
    showOutOfCreditsModal: creditGated.showOutOfCreditsModal,
    closeOutOfCreditsModal: creditGated.closeOutOfCreditsModal,
    blockedAction: creditGated.blockedAction,
    balance: creditGated.balance,
    isFreeTier: creditGated.isFreeTier,
  };
}

/**
 * Pre-configured hook for storefront creation actions
 * Uses 'storefront_create' action key (500 credits)
 */
export function useCreateStorefront() {
  const creditGated = useCreditGatedAction();

  const createStorefront = useCallback(
    async <T>(
      action: () => Promise<T>,
      options?: {
        storefrontId?: string;
        onInsufficientCredits?: () => void;
        onSuccess?: (result: T) => void;
        onError?: (error: Error) => void;
      }
    ) => {
      return creditGated.execute({
        actionKey: 'storefront_create',
        action,
        referenceId: options?.storefrontId,
        referenceType: 'storefront',
        onInsufficientCredits: options?.onInsufficientCredits,
        onSuccess: options?.onSuccess,
        onError: options?.onError,
      });
    },
    [creditGated]
  );

  return {
    createStorefront,
    isCreating: creditGated.isExecuting,
    showOutOfCreditsModal: creditGated.showOutOfCreditsModal,
    closeOutOfCreditsModal: creditGated.closeOutOfCreditsModal,
    blockedAction: creditGated.blockedAction,
    balance: creditGated.balance,
    isFreeTier: creditGated.isFreeTier,
  };
}

