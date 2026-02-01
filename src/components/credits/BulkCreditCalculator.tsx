/**
 * BulkCreditCalculator Component
 * 
 * Shows total credit cost before performing bulk operations.
 * Used when selecting multiple items for actions like bulk SMS, bulk exports, etc.
 */

import { useState, useMemo } from 'react';
import { Calculator, AlertTriangle, ChevronDown, ChevronUp, Coins } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { useCredits } from '@/hooks/useCredits';
import {
  getCreditCost,
  getCreditCostInfo,
  CREDIT_PACKAGES,
  FREE_TIER_MONTHLY_CREDITS,
  MIN_BALANCE_REQUIREMENTS,
  type CreditCost,
} from '@/lib/credits';

export interface BulkCreditCalculatorProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when dialog open state changes */
  onOpenChange: (open: boolean) => void;
  /** The action being performed (e.g., 'send_sms', 'export_csv') */
  actionKey: string;
  /** Number of items selected for the bulk operation */
  itemCount: number;
  /** Custom description of what the action will do */
  actionDescription?: string;
  /** Callback when user confirms the action */
  onConfirm: () => void;
  /** Callback when user cancels */
  onCancel?: () => void;
  /** Optional breakdown of items by type */
  itemBreakdown?: Array<{
    label: string;
    count: number;
    actionKey?: string;
  }>;
  /** Whether the action is currently loading */
  isLoading?: boolean;
}

export function BulkCreditCalculator({
  open,
  onOpenChange,
  actionKey,
  itemCount,
  actionDescription,
  onConfirm,
  onCancel,
  itemBreakdown,
  isLoading = false,
}: BulkCreditCalculatorProps) {
  const [showBreakdown, setShowBreakdown] = useState(false);
  const { balance, isFreeTier } = useCredits();

  // Get action info
  const actionInfo = getCreditCostInfo(actionKey);
  const perItemCost = getCreditCost(actionKey);

  // Calculate totals
  const calculation = useMemo(() => {
    if (itemBreakdown && itemBreakdown.length > 0) {
      // Calculate with breakdown
      const items = itemBreakdown.map((item) => {
        const cost = getCreditCost(item.actionKey || actionKey);
        return {
          ...item,
          costPerItem: cost,
          totalCost: cost * item.count,
        };
      });

      const totalCost = items.reduce((sum, item) => sum + item.totalCost, 0);
      const totalItems = items.reduce((sum, item) => sum + item.count, 0);

      return {
        items,
        totalCost,
        totalItems,
        averageCost: totalItems > 0 ? totalCost / totalItems : 0,
      };
    }

    // Simple calculation
    const totalCost = perItemCost * itemCount;
    return {
      items: [
        {
          label: actionInfo?.actionName || actionKey,
          count: itemCount,
          costPerItem: perItemCost,
          totalCost,
        },
      ],
      totalCost,
      totalItems: itemCount,
      averageCost: perItemCost,
    };
  }, [actionKey, itemCount, itemBreakdown, perItemCost, actionInfo]);

  // Check if this action requires minimum balance (full coverage)
  const requiresFullBalance = MIN_BALANCE_REQUIREMENTS.require_full_balance.includes(
    actionKey as any
  );

  // Calculate required balance (with buffer for high-cost actions)
  const bufferAmount = requiresFullBalance
    ? Math.max(
        MIN_BALANCE_REQUIREMENTS.min_buffer,
        Math.ceil(calculation.totalCost * (MIN_BALANCE_REQUIREMENTS.buffer_percentage / 100))
      )
    : 0;
  const requiredBalance = calculation.totalCost + bufferAmount;

  // Check if user can afford the action
  const canAfford = balance >= requiredBalance;
  const balanceAfter = balance - calculation.totalCost;
  const balancePercentAfter = Math.max(0, (balanceAfter / FREE_TIER_MONTHLY_CREDITS) * 100);

  // Find cheapest package to cover deficit (including buffer)
  const deficit = requiredBalance - balance;
  const recommendedPackage = deficit > 0
    ? CREDIT_PACKAGES.find((pkg) => pkg.credits >= deficit)
    : null;

  // Handle confirm
  const handleConfirm = () => {
    if (canAfford) {
      onConfirm();
    }
  };

  // Handle cancel
  const handleCancel = () => {
    onOpenChange(false);
    onCancel?.();
  };

  // If not on free tier, don't show the calculator
  if (!isFreeTier) {
    // Just confirm without showing credits
    if (open) {
      onConfirm();
      onOpenChange(false);
    }
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-primary" />
            Bulk Action Cost
          </DialogTitle>
          <DialogDescription>
            {actionDescription ||
              `This will ${actionInfo?.actionName?.toLowerCase() || 'perform action'} on ${itemCount} items`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Total Cost Display */}
          <div className="bg-muted rounded-lg p-4 text-center">
            <div className="flex items-center justify-center gap-2 text-3xl font-bold">
              <Coins className="h-8 w-8 text-primary" />
              <span>{calculation.totalCost.toLocaleString()}</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {calculation.totalItems.toLocaleString()} items × {calculation.averageCost.toLocaleString()} credits each
            </p>
          </div>

          {/* Breakdown (collapsible) */}
          {calculation.items.length > 1 && (
            <Collapsible open={showBreakdown} onOpenChange={setShowBreakdown}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="w-full justify-between">
                  <span>View breakdown</span>
                  {showBreakdown ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-2 pt-2">
                {calculation.items.map((item, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between text-sm py-1 border-b last:border-0"
                  >
                    <span className="text-muted-foreground">
                      {item.label} ({item.count})
                    </span>
                    <span className="font-medium">
                      {item.totalCost.toLocaleString()} credits
                    </span>
                  </div>
                ))}
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Balance After */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Current balance</span>
              <span className="font-medium">{balance.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">After this action</span>
              <span
                className={cn(
                  'font-medium',
                  !canAfford
                    ? 'text-red-500'
                    : balanceAfter < 500
                    ? 'text-orange-500'
                    : 'text-emerald-500'
                )}
              >
                {canAfford ? balanceAfter.toLocaleString() : 'Insufficient'}
              </span>
            </div>
            <Progress value={balancePercentAfter} className="h-2" />
          </div>

          {/* Buffer Requirement Notice */}
          {requiresFullBalance && canAfford && bufferAmount > 0 && (
            <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-3 text-sm">
              <p className="text-blue-700 dark:text-blue-300">
                ℹ️ This action requires a {bufferAmount} credit safety buffer to ensure completion.
              </p>
            </div>
          )}

          {/* Insufficient Credits Warning */}
          {!canAfford && (
            <div className="bg-red-50 dark:bg-red-950/30 rounded-lg p-4 space-y-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-red-700 dark:text-red-400">
                    Insufficient Credits
                  </p>
                  <p className="text-sm text-red-600 dark:text-red-300 mt-1">
                    {requiresFullBalance ? (
                      <>
                        You need {requiredBalance.toLocaleString()} credits 
                        ({calculation.totalCost.toLocaleString()} + {bufferAmount} buffer) to complete this action.
                        <br />
                        <span className="text-xs">Currently have: {balance.toLocaleString()}</span>
                      </>
                    ) : (
                      <>You need {deficit.toLocaleString()} more credits to complete this action.</>
                    )}
                  </p>
                </div>
              </div>

              {recommendedPackage && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full border-red-200 text-red-700 hover:bg-red-100 dark:border-red-800 dark:text-red-300"
                >
                  Buy {recommendedPackage.credits.toLocaleString()} credits for $
                  {(recommendedPackage.priceCents / 100).toFixed(0)}
                </Button>
              )}
            </div>
          )}

          {/* Volume Discount Notice */}
          {itemCount > 10 && canAfford && (
            <div className="bg-emerald-50 dark:bg-emerald-950/30 rounded-lg p-3 text-sm">
              <p className="text-emerald-700 dark:text-emerald-300">
                💡 <strong>Tip:</strong> Upgrade to a paid plan for unlimited bulk actions
                without credit costs.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={handleCancel} className="sm:flex-1">
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!canAfford || isLoading}
            className="sm:flex-1"
          >
            {isLoading ? (
              'Processing...'
            ) : canAfford ? (
              <>
                Confirm ({calculation.totalCost.toLocaleString()} credits)
              </>
            ) : (
              'Get More Credits'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Hook for using the BulkCreditCalculator
 */
export interface UseBulkCreditCalculatorOptions {
  actionKey: string;
  itemCount: number;
  actionDescription?: string;
  itemBreakdown?: BulkCreditCalculatorProps['itemBreakdown'];
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void;
}

export interface UseBulkCreditCalculatorReturn {
  /** Open the calculator dialog */
  open: () => void;
  /** Close the calculator dialog */
  close: () => void;
  /** Props to spread on the BulkCreditCalculator component */
  calculatorProps: BulkCreditCalculatorProps;
  /** Total cost for the bulk operation */
  totalCost: number;
  /** Whether user can afford the operation */
  canAfford: boolean;
}

export function useBulkCreditCalculator({
  actionKey,
  itemCount,
  actionDescription,
  itemBreakdown,
  onConfirm,
  onCancel,
}: UseBulkCreditCalculatorOptions): UseBulkCreditCalculatorReturn {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { balance, isFreeTier } = useCredits();

  // Calculate total cost
  const totalCost = useMemo(() => {
    if (itemBreakdown && itemBreakdown.length > 0) {
      return itemBreakdown.reduce((sum, item) => {
        const cost = getCreditCost(item.actionKey || actionKey);
        return sum + cost * item.count;
      }, 0);
    }
    return getCreditCost(actionKey) * itemCount;
  }, [actionKey, itemCount, itemBreakdown]);

  const canAfford = !isFreeTier || balance >= totalCost;

  const handleConfirm = async () => {
    setIsLoading(true);
    try {
      await onConfirm();
      setIsOpen(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setIsOpen(false);
    onCancel?.();
  };

  return {
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
    calculatorProps: {
      open: isOpen,
      onOpenChange: setIsOpen,
      actionKey,
      itemCount,
      actionDescription,
      itemBreakdown,
      onConfirm: handleConfirm,
      onCancel: handleCancel,
      isLoading,
    },
    totalCost,
    canAfford,
  };
}







