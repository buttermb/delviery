/**
 * useCreditAlert Hook
 *
 * Hook to check if credit alert should be shown.
 * Useful for conditionally rendering the CreditAlertBanner in layouts.
 */

import { useMemo } from 'react';
import { useCredits } from '@/hooks/useCredits';
import {
  LOW_BALANCE_WARNING_LEVELS,
  getCurrentThreshold,
  type CreditThresholdConfig,
} from '@/lib/credits';

export interface UseCreditAlertReturn {
  shouldShowAlert: boolean;
  currentThreshold: CreditThresholdConfig | null;
  balance: number;
  isFreeTier: boolean;
}

export function useCreditAlert(): UseCreditAlertReturn {
  const { balance, isFreeTier, isLoading } = useCredits();

  const shouldShowAlert = useMemo(() => {
    if (isLoading || !isFreeTier || balance <= 0) return false;
    return LOW_BALANCE_WARNING_LEVELS.some((threshold) => balance <= threshold);
  }, [balance, isFreeTier, isLoading]);

  const currentThreshold = useMemo(() => {
    if (!shouldShowAlert) return null;
    return getCurrentThreshold(balance);
  }, [balance, shouldShowAlert]);

  return {
    shouldShowAlert,
    currentThreshold,
    balance,
    isFreeTier,
  };
}
