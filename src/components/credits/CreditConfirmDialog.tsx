/**
 * CreditConfirmDialog Component
 * 
 * Confirmation dialog shown before high-cost actions (>100 credits).
 * Shows current balance, cost, and remaining balance after action.
 */

import { useState } from 'react';
import { Coins, AlertTriangle } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { useCredits } from '@/hooks/useCredits';
import { getCreditCostInfo, HIGH_COST_THRESHOLD } from '@/lib/credits';
import { CreditPurchaseModal } from './CreditPurchaseModal';

export interface CreditConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actionKey: string;
  onConfirm: () => void;
  onCancel?: () => void;
  /** Custom action description */
  actionDescription?: string;
}

export function CreditConfirmDialog({
  open,
  onOpenChange,
  actionKey,
  onConfirm,
  onCancel,
  actionDescription,
}: CreditConfirmDialogProps) {
  const { balance, isFreeTier } = useCredits();
  const [dontAskAgain, setDontAskAgain] = useState(false);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);

  const costInfo = getCreditCostInfo(actionKey);
  const cost = costInfo?.credits ?? 0;
  const canAfford = balance >= cost;
  const balanceAfter = balance - cost;
  const wouldBeLow = balanceAfter < 1000;
  const wouldBeCritical = balanceAfter < 500;

  // Don't show for paid tier users
  if (!isFreeTier) {
    // Auto-confirm for paid users
    if (open) {
      onConfirm();
      onOpenChange(false);
    }
    return null;
  }

  // Don't show for low-cost actions
  if (cost < HIGH_COST_THRESHOLD) {
    if (open) {
      onConfirm();
      onOpenChange(false);
    }
    return null;
  }

  const handleConfirm = () => {
    if (dontAskAgain) {
      // Store preference in localStorage
      try {
        const key = `credit_confirm_skip_${actionKey}`;
        localStorage.setItem(key, 'true');
      } catch {
        // Ignore storage errors
      }
    }
    onConfirm();
    onOpenChange(false);
  };

  const handleCancel = () => {
    onCancel?.();
    onOpenChange(false);
  };

  const handleBuyCredits = () => {
    setShowPurchaseModal(true);
  };

  return (
    <>
      <AlertDialog open={open} onOpenChange={onOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Coins className="h-5 w-5 text-primary" />
              {canAfford ? 'Confirm Credit Usage' : 'Insufficient Credits'}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                <p>
                  {actionDescription || costInfo?.description || 'This action'} will
                  use <strong>{cost}</strong> credits.
                </p>

                {/* Balance Preview */}
                <div
                  className={cn(
                    'p-4 rounded-lg border',
                    !canAfford
                      ? 'bg-red-500/10 border-red-500/20'
                      : wouldBeCritical
                      ? 'bg-orange-500/10 border-orange-500/20'
                      : wouldBeLow
                      ? 'bg-yellow-500/10 border-yellow-500/20'
                      : 'bg-muted'
                  )}
                >
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-sm text-muted-foreground">Current</p>
                      <p className="text-lg font-semibold">
                        {balance.toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Cost</p>
                      <p className="text-lg font-semibold text-red-600">
                        -{cost}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">After</p>
                      <p
                        className={cn(
                          'text-lg font-semibold',
                          !canAfford
                            ? 'text-red-600'
                            : wouldBeCritical
                            ? 'text-orange-600'
                            : wouldBeLow
                            ? 'text-yellow-600'
                            : 'text-emerald-600'
                        )}
                      >
                        {canAfford ? balanceAfter.toLocaleString() : 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Warnings */}
                {!canAfford && (
                  <div className="flex items-start gap-2 text-sm text-red-600">
                    <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>
                      You need <strong>{(cost - balance).toLocaleString()}</strong>{' '}
                      more credits. Purchase credits or upgrade to continue.
                    </span>
                  </div>
                )}

                {canAfford && wouldBeLow && (
                  <div className="flex items-start gap-2 text-sm text-yellow-600">
                    <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>
                      This will leave you with a low balance. Consider upgrading
                      for unlimited usage.
                    </span>
                  </div>
                )}

                {/* Don't ask again checkbox */}
                {canAfford && (
                  <div className="flex items-center gap-2 pt-2">
                    <Checkbox
                      id="dontAskAgain"
                      checked={dontAskAgain}
                      onCheckedChange={(checked) =>
                        setDontAskAgain(checked === true)
                      }
                    />
                    <label
                      htmlFor="dontAskAgain"
                      className="text-sm text-muted-foreground cursor-pointer"
                    >
                      Don't ask again for this action
                    </label>
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            {!canAfford ? (
              <>
                <AlertDialogCancel onClick={handleCancel}>Cancel</AlertDialogCancel>
                <Button onClick={handleBuyCredits} className="gap-2">
                  <Coins className="h-4 w-4" />
                  Buy Credits
                </Button>
              </>
            ) : (
              <>
                <AlertDialogCancel onClick={handleCancel}>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleConfirm}>
                  Continue ({cost} credits)
                </AlertDialogAction>
              </>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <CreditPurchaseModal
        open={showPurchaseModal}
        onOpenChange={setShowPurchaseModal}
      />
    </>
  );
}

// ============================================================================
// Hook for Confirm Dialog
// ============================================================================

export interface UseCreditConfirmOptions {
  actionKey: string;
  actionDescription?: string;
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void;
  /** Skip confirmation even for high-cost actions */
  skipConfirmation?: boolean;
}

export interface UseCreditConfirmReturn {
  /** Trigger the action (shows dialog if needed) */
  trigger: () => void;
  /** Dialog props to spread on CreditConfirmDialog */
  dialogProps: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    actionKey: string;
    actionDescription?: string;
    onConfirm: () => void;
    onCancel?: () => void;
  };
  /** Whether the dialog is currently open */
  isOpen: boolean;
}

/**
 * Hook to manage credit confirmation dialog state
 * 
 * Usage:
 * const { trigger, dialogProps } = useCreditConfirm({
 *   actionKey: 'export_csv',
 *   onConfirm: () => handleExport(),
 * });
 * 
 * <Button onClick={trigger}>Export</Button>
 * <CreditConfirmDialog {...dialogProps} />
 */
export function useCreditConfirm({
  actionKey,
  actionDescription,
  onConfirm,
  onCancel,
  skipConfirmation = false,
}: UseCreditConfirmOptions): UseCreditConfirmReturn {
  const [isOpen, setIsOpen] = useState(false);
  const { isFreeTier } = useCredits();
  
  const costInfo = getCreditCostInfo(actionKey);
  const cost = costInfo?.credits ?? 0;

  const shouldShowDialog = () => {
    // No dialog for paid tier
    if (!isFreeTier) return false;
    
    // No dialog for low-cost actions
    if (cost < HIGH_COST_THRESHOLD) return false;
    
    // Check if user opted out
    try {
      const key = `credit_confirm_skip_${actionKey}`;
      if (localStorage.getItem(key) === 'true') return false;
    } catch {
      // Ignore storage errors
    }
    
    // Skip if explicitly disabled
    if (skipConfirmation) return false;
    
    return true;
  };

  const trigger = () => {
    if (shouldShowDialog()) {
      setIsOpen(true);
    } else {
      onConfirm();
    }
  };

  const handleConfirm = async () => {
    setIsOpen(false);
    await onConfirm();
  };

  return {
    trigger,
    dialogProps: {
      open: isOpen,
      onOpenChange: setIsOpen,
      actionKey,
      actionDescription,
      onConfirm: handleConfirm,
      onCancel,
    },
    isOpen,
  };
}







