/**
 * InsufficientCreditsModal Component
 *
 * Modal shown when an action requires more credits than currently available.
 * Displays the required amount, current balance, and shortfall.
 * Suggests the smallest credit packages that cover the shortfall.
 * Includes buy credits button, cancel button, and "don't show again" preference.
 */

import { useState, useMemo } from 'react';
import { AlertCircle, Coins, ShoppingCart, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { CREDIT_PACKAGES, type CreditPackage } from '@/lib/credits';
import { STORAGE_KEYS, safeStorage } from '@/constants/storageKeys';

export interface InsufficientCreditsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requiredCredits: number;
  currentBalance: number;
  actionName?: string;
  onBuyCredits?: (packageSlug: string) => void;
  onCancel?: () => void;
}

/**
 * Returns the smallest packages from CREDIT_PACKAGES that cover the shortfall,
 * sorted ascending by credits. Returns up to 3 options.
 */
function getQuickPurchaseOptions(shortfall: number): CreditPackage[] {
  const sorted = [...CREDIT_PACKAGES].sort((a, b) => a.credits - b.credits);
  const covering = sorted.filter((pkg) => pkg.credits >= shortfall);

  if (covering.length > 0) {
    return covering.slice(0, 3);
  }

  // If no single package covers it, return the largest packages
  return sorted.slice(-3).reverse();
}

export function InsufficientCreditsModal({
  open,
  onOpenChange,
  requiredCredits,
  currentBalance,
  actionName,
  onBuyCredits,
  onCancel,
}: InsufficientCreditsModalProps) {
  const [dontShowAgain, setDontShowAgain] = useState(false);

  const shortfall = Math.max(0, requiredCredits - currentBalance);

  const quickOptions = useMemo(
    () => getQuickPurchaseOptions(shortfall),
    [shortfall]
  );

  const handleCancel = () => {
    if (dontShowAgain) {
      safeStorage.setItem(STORAGE_KEYS.INSUFFICIENT_CREDITS_DISMISSED, 'true');
    }
    onOpenChange(false);
    onCancel?.();
  };

  const handleBuyCredits = (packageSlug: string) => {
    if (dontShowAgain) {
      safeStorage.setItem(STORAGE_KEYS.INSUFFICIENT_CREDITS_DISMISSED, 'true');
    }
    onOpenChange(false);
    onBuyCredits?.(packageSlug);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader className="text-center pb-2">
          <div className="mx-auto mb-3 p-3 rounded-full bg-amber-500/10 w-fit">
            <AlertCircle className="h-7 w-7 text-amber-500" />
          </div>
          <DialogTitle className="text-xl">Insufficient Credits</DialogTitle>
          <DialogDescription className="text-sm">
            {actionName
              ? `"${actionName}" requires more credits than you currently have.`
              : 'This action requires more credits than you currently have.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-3">
          {/* Balance Breakdown */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-3 rounded-lg bg-muted/50">
              <div className="text-xs text-muted-foreground mb-1">Required</div>
              <div className="text-base font-bold text-foreground">
                {requiredCredits.toLocaleString()}
              </div>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <div className="text-xs text-muted-foreground mb-1">Balance</div>
              <div className="text-base font-bold text-blue-600">
                {currentBalance.toLocaleString()}
              </div>
            </div>
            <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/20">
              <div className="text-xs text-muted-foreground mb-1">Shortfall</div>
              <div className="text-base font-bold text-red-500">
                {shortfall.toLocaleString()}
              </div>
            </div>
          </div>

          {/* Quick Purchase Options */}
          {quickOptions.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <ShoppingCart className="h-4 w-4 text-primary" />
                Quick Purchase
              </div>
              <div className="space-y-2">
                {quickOptions.map((pkg) => {
                  const covers = pkg.credits >= shortfall;
                  return (
                    <button
                      key={pkg.id}
                      className="w-full flex items-center justify-between p-3 rounded-lg border hover:border-primary/50 hover:bg-primary/5 transition-colors text-left"
                      onClick={() => handleBuyCredits(pkg.slug)}
                      data-testid={`quick-option-${pkg.slug}`}
                    >
                      <div className="flex items-center gap-3">
                        <Coins className="h-4 w-4 text-amber-500 flex-shrink-0" />
                        <div>
                          <div className="text-sm font-medium">{pkg.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {pkg.credits.toLocaleString()} credits
                            {covers && (
                              <span className="ml-1 text-emerald-600">
                                (covers shortfall)
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-sm font-bold">
                        ${(pkg.priceCents / 100).toFixed(2)}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Don't show again */}
          <div className="flex items-center gap-2 pt-1">
            <Checkbox
              id="dont-show-again"
              checked={dontShowAgain}
              onCheckedChange={(checked) => setDontShowAgain(checked === true)}
              data-testid="dont-show-again-checkbox"
            />
            <Label
              htmlFor="dont-show-again"
              className="text-xs text-muted-foreground cursor-pointer"
            >
              Don't show this again
            </Label>
          </div>
        </div>

        <DialogFooter className="flex-row gap-2 sm:justify-between">
          <Button
            variant="ghost"
            className="text-muted-foreground"
            onClick={handleCancel}
            data-testid="insufficient-credits-cancel"
          >
            <X className="h-4 w-4 mr-1" />
            Cancel
          </Button>
          <Button
            onClick={() => handleBuyCredits(quickOptions[0]?.slug ?? 'starter-pack')}
            data-testid="insufficient-credits-buy"
          >
            <Coins className="h-4 w-4 mr-1" />
            Buy Credits
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Check if the user has dismissed the insufficient credits modal.
 * Callers should check this before showing the modal.
 */
export function isInsufficientCreditsModalDismissed(): boolean {
  return safeStorage.getItem(STORAGE_KEYS.INSUFFICIENT_CREDITS_DISMISSED) === 'true';
}

/**
 * Reset the "don't show again" preference (e.g., from settings).
 */
export function resetInsufficientCreditsModalDismissal(): void {
  safeStorage.removeItem(STORAGE_KEYS.INSUFFICIENT_CREDITS_DISMISSED);
}
