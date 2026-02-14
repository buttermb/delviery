/**
 * useCreditAlert Hook
 *
 * Hook to check if credit alert should be shown.
 * Useful for conditionally rendering the CreditAlertBanner in layouts.
 */

import { useMemo } from 'react';
import { useCredits } from '@/hooks/useCredits';
import { LOW_BALANCE_WARNING_LEVELS } from '@/lib/credits';

interface ThresholdConfig {
  threshold: number;
  severity: 'info' | 'warning' | 'critical' | 'danger';
  title: string;
  description: string;
}

const THRESHOLD_CONFIGS: ThresholdConfig[] = [
  {
    threshold: 2000,
    severity: 'info',
    title: 'Credits Running Low',
    description: 'Your credit balance is getting low. Consider purchasing more to avoid interruptions.',
  },
  {
    threshold: 1000,
    severity: 'warning',
    title: 'Credit Balance Warning',
    description: 'You have less than 1,000 credits. Some features may become unavailable soon.',
  },
  {
    threshold: 500,
    severity: 'critical',
    title: 'Low Credit Balance',
    description: 'Only {balance} credits remaining. Purchase credits now to continue using premium features.',
  },
  {
    threshold: 100,
    severity: 'danger',
    title: 'Critical Credit Balance',
    description: 'Only {balance} credits left! Actions will be blocked when credits run out.',
  },
];

/**
 * Determine the current warning threshold based on balance
 */
function getCurrentThreshold(balance: number): ThresholdConfig | null {
  // Find the highest threshold that the balance is at or below
  // Sort thresholds in descending order and find the first one the balance qualifies for
  const sortedThresholds = [...THRESHOLD_CONFIGS].sort((a, b) => b.threshold - a.threshold);

  for (const config of sortedThresholds) {
    if (balance <= config.threshold && balance > 0) {
      return config;
    }
  }

  return null;
}

export interface UseCreditAlertReturn {
  shouldShowAlert: boolean;
  currentThreshold: ThresholdConfig | null;
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
