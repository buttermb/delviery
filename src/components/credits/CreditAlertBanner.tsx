/**
 * CreditAlertBanner Component
 *
 * Dismissible alert banner that shows at specific credit thresholds.
 * Returns when balance changes to a new threshold level.
 *
 * Features:
 * - Shows at 2000, 1000, 500, 100 credits
 * - Dismissible but returns on balance change to new threshold
 * - Buy credits button
 * - Different severity colors based on threshold
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { AlertTriangle, X, Coins, TrendingDown } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useCredits } from '@/hooks/useCredits';
import {
  getCurrentThreshold,
  getAlertSeverityStyles,
  type CreditThresholdConfig,
} from '@/lib/credits';

export interface CreditAlertBannerProps {
  /** Callback when buy credits button is clicked */
  onBuyCredits?: () => void;
  /** Custom class name for the banner */
  className?: string;
}

export function CreditAlertBanner({ onBuyCredits, className }: CreditAlertBannerProps) {
  const { balance, isFreeTier, isLoading } = useCredits();

  // Track which threshold was dismissed
  const [dismissedThreshold, setDismissedThreshold] = useState<number | null>(null);

  // Get the current threshold config based on balance
  const currentConfig = useMemo(() => getCurrentThreshold(balance), [balance]);

  // Reset dismissed state when balance changes to a different threshold
  useEffect(() => {
    if (currentConfig && dismissedThreshold !== currentConfig.threshold) {
      // Balance changed to a different threshold, reset dismiss state
      // But only if moving to a MORE severe threshold (lower number)
      if (dismissedThreshold === null || currentConfig.threshold < dismissedThreshold) {
        setDismissedThreshold(null);
      }
    }
  }, [currentConfig, dismissedThreshold]);

  const handleDismiss = useCallback(() => {
    if (currentConfig) {
      setDismissedThreshold(currentConfig.threshold);
    }
  }, [currentConfig]);

  const handleBuyCredits = useCallback(() => {
    onBuyCredits?.();
  }, [onBuyCredits]);

  // Don't show if:
  // - Loading
  // - Not on free tier (unlimited credits)
  // - No threshold triggered (balance is high enough)
  // - Balance is 0 or negative (OutOfCreditsModal handles this)
  // - User dismissed this specific threshold
  if (
    isLoading ||
    !isFreeTier ||
    !currentConfig ||
    balance <= 0 ||
    dismissedThreshold === currentConfig.threshold
  ) {
    return null;
  }

  const styles = getAlertSeverityStyles(currentConfig.severity);
  const description = currentConfig.description.replace('{balance}', balance.toLocaleString());

  return (
    <Alert
      variant={styles.variant}
      className={`${styles.bgColor} ${styles.borderColor} ${className ?? ''}`}
      data-testid="credit-alert-banner"
      data-severity={currentConfig.severity}
      data-threshold={currentConfig.threshold}
    >
      <div className="flex items-start gap-3">
        <div className={`flex-shrink-0 ${styles.iconColor}`}>
          {currentConfig.severity === 'danger' ? (
            <AlertTriangle className="h-5 w-5" />
          ) : (
            <TrendingDown className="h-5 w-5" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <AlertTitle className="text-sm font-semibold mb-1">
            {currentConfig.title}
            <span className={`ml-2 ${styles.iconColor} font-normal`}>
              ({balance.toLocaleString()} credits)
            </span>
          </AlertTitle>
          <AlertDescription className="text-sm text-muted-foreground">
            {description}
          </AlertDescription>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <Button
            size="sm"
            variant={currentConfig.severity === 'danger' ? 'default' : 'outline'}
            onClick={handleBuyCredits}
            data-testid="banner-buy-credits"
          >
            <Coins className="h-4 w-4 mr-1" />
            Buy Credits
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleDismiss}
            className="h-8 w-8 p-0"
            data-testid="banner-dismiss"
            aria-label="Dismiss alert"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Alert>
  );
}

