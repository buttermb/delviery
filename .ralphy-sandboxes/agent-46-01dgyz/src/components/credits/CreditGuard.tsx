/**
 * CreditGuard Component
 *
 * Guards content behind a credit check. Accepts a required credits amount,
 * renders children (via render props) if sufficient balance exists,
 * and shows InsufficientCreditsModal when credits are insufficient.
 *
 * Provides a `consumeCredits` function to children via render props
 * so the gated action can trigger credit consumption on demand.
 */

import { useState, useCallback } from 'react';
import { useCredits } from '@/hooks/useCredits';
import { OutOfCreditsModal } from '@/components/credits/OutOfCreditsModal';
import { logger } from '@/lib/logger';
import type { ConsumeCreditsResult } from '@/lib/credits';

// ============================================================================
// Types
// ============================================================================

export interface CreditGuardRenderProps {
  /** Consume credits for the guarded action. Returns result with success/failure. */
  consumeCredits: (referenceId?: string, referenceType?: string) => Promise<ConsumeCreditsResult>;
  /** Current credit balance */
  balance: number;
  /** Whether the user has sufficient credits for this action */
  hasSufficientCredits: boolean;
  /** Whether a credit consumption is currently in progress */
  isConsuming: boolean;
  /** Whether the user is on the free tier */
  isFreeTier: boolean;
}

export interface CreditGuardProps {
  /** Number of credits required for this action */
  requiredCredits: number;
  /** Optional action key for tracking and cost lookup */
  actionKey?: string;
  /** Render prop function receiving credit guard context */
  children: (props: CreditGuardRenderProps) => React.ReactNode;
  /** Optional fallback to render when credits are insufficient (instead of nothing) */
  fallback?: React.ReactNode;
  /** Callback when credits are successfully consumed */
  onCreditsConsumed?: (result: ConsumeCreditsResult) => void;
  /** Callback when consumption fails */
  onConsumptionFailed?: (error: string) => void;
}

// ============================================================================
// Component
// ============================================================================

export function CreditGuard({
  requiredCredits,
  actionKey,
  children,
  fallback,
  onCreditsConsumed,
  onConsumptionFailed,
}: CreditGuardProps) {
  const {
    balance,
    isFreeTier,
    performAction,
  } = useCredits();

  const [showModal, setShowModal] = useState(false);
  const [isConsuming, setIsConsuming] = useState(false);

  // Determine if user has sufficient credits
  // Non-free-tier users always have sufficient credits (unlimited)
  const hasSufficientCredits = !isFreeTier || balance >= requiredCredits;

  const consumeCredits = useCallback(async (
    referenceId?: string,
    referenceType?: string,
  ): Promise<ConsumeCreditsResult> => {
    // Prevent double-execution
    if (isConsuming) {
      return {
        success: false,
        newBalance: balance,
        creditsCost: 0,
        errorMessage: 'Credit consumption already in progress',
      };
    }

    // Check balance before attempting
    if (isFreeTier && balance < requiredCredits) {
      setShowModal(true);
      const errorMsg = `Insufficient credits: need ${requiredCredits}, have ${balance}`;
      onConsumptionFailed?.(errorMsg);
      return {
        success: false,
        newBalance: balance,
        creditsCost: requiredCredits,
        errorMessage: errorMsg,
      };
    }

    setIsConsuming(true);
    try {
      const effectiveActionKey = actionKey || 'custom_action';
      const result = await performAction(effectiveActionKey, referenceId, referenceType);

      if (result.success) {
        onCreditsConsumed?.(result);
      } else {
        // Show modal on insufficient credits
        if (result.errorMessage?.includes('nsufficient') || result.newBalance < requiredCredits) {
          setShowModal(true);
        }
        onConsumptionFailed?.(result.errorMessage || 'Credit consumption failed');
      }

      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error consuming credits';
      logger.error('CreditGuard: consumeCredits failed', err instanceof Error ? err : new Error(errorMessage));
      onConsumptionFailed?.(errorMessage);
      return {
        success: false,
        newBalance: balance,
        creditsCost: 0,
        errorMessage,
      };
    } finally {
      setIsConsuming(false);
    }
  }, [
    isConsuming,
    isFreeTier,
    balance,
    requiredCredits,
    actionKey,
    performAction,
    onCreditsConsumed,
    onConsumptionFailed,
  ]);

  const handleOpenChange = useCallback((open: boolean) => {
    setShowModal(open);
  }, []);

  // If insufficient credits: show modal + render fallback (if provided)
  if (!hasSufficientCredits) {
    return (
      <>
        {fallback ?? null}
        <OutOfCreditsModal
          open={showModal || true}
          onOpenChange={handleOpenChange}
          actionAttempted={actionKey}
        />
      </>
    );
  }

  // Sufficient credits: render children with render props
  return (
    <>
      {children({
        consumeCredits,
        balance,
        hasSufficientCredits,
        isConsuming,
        isFreeTier,
      })}
      <OutOfCreditsModal
        open={showModal}
        onOpenChange={handleOpenChange}
        actionAttempted={actionKey}
      />
    </>
  );
}
