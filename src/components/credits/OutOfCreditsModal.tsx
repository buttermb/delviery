// @ts-nocheck
/**
 * OutOfCreditsModal Component
 * 
 * Blocking modal when user tries to perform an action without credits.
 * Shows conversion-focused messaging to push toward subscription.
 * Enhanced with urgency messaging and clear value comparison.
 */

import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Coins,
  Crown,
  ArrowRight,
  Calculator,
  Sparkles,
  Clock,
  TrendingUp,
  X,
  CheckCircle,
} from 'lucide-react';
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
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useCredits } from '@/hooks/useCredits';
import { 
  getCreditCostInfo,
  calculateCreditVsSubscription,
  CREDIT_PACKAGES,
} from '@/lib/credits';

export interface OutOfCreditsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actionAttempted?: string;
  onBuyCredits?: () => void;
}

export function OutOfCreditsModal({
  open,
  onOpenChange,
  actionAttempted,
  onBuyCredits,
}: OutOfCreditsModalProps) {
  const navigate = useNavigate();
  const { tenant } = useTenantAdminAuth();
  const { lifetimeSpent, balance } = useCredits();

  // Get action info if provided
  const actionInfo = actionAttempted ? getCreditCostInfo(actionAttempted) : null;

  // Calculate how much they would save with subscription
  const comparison = calculateCreditVsSubscription(
    Math.max(lifetimeSpent, 500) // Minimum for realistic calculation
  );

  // Calculate cost to complete blocked action via credit pack
  const cheapestPack = CREDIT_PACKAGES[0];
  const costPerCredit = cheapestPack.priceCents / cheapestPack.credits / 100;

  const handleUpgrade = () => {
    onOpenChange(false);
    navigate(`/${tenant?.slug}/admin/select-plan`);
  };

  const handleBuyCredits = () => {
    onOpenChange(false);
    onBuyCredits?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader className="text-center pb-2">
          <div className="mx-auto mb-4 p-3 rounded-full bg-red-500/10 w-fit">
            <AlertTriangle className="h-8 w-8 text-red-500 animate-pulse" />
          </div>
          <DialogTitle className="text-2xl">You're Out of Credits</DialogTitle>
          <DialogDescription className="text-base">
            {actionInfo
              ? `Cannot ${actionInfo.name.toLowerCase()} — not enough credits.`
              : "Your business actions are paused until you get more credits."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Blocked Action + Balance */}
          <div className="grid grid-cols-2 gap-3">
            {actionInfo && (
              <div className="p-3 rounded-lg bg-muted/50 text-center">
                <div className="text-xs text-muted-foreground mb-1">Action Cost</div>
                <div className="text-lg font-bold text-amber-600">
                  {actionInfo.cost} credits
                </div>
              </div>
            )}
            <div className={`p-3 rounded-lg bg-red-500/5 border border-red-500/20 text-center ${!actionInfo ? 'col-span-2' : ''}`}>
              <div className="text-xs text-muted-foreground mb-1">Your Balance</div>
              <div className="text-lg font-bold text-red-500">
                {balance} credits
              </div>
            </div>
          </div>

          {/* Urgency Message */}
          <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
            <Clock className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm">
              <span className="font-medium text-amber-700 dark:text-amber-400">
                Don't lose momentum!
              </span>
              <span className="text-muted-foreground">
                {' '}Your customers are waiting. Get back to business instantly.
              </span>
            </div>
          </div>

          {/* Value Comparison - Subscription vs Credit Packs */}
          <div className="rounded-xl overflow-hidden border-2 border-primary/30">
            {/* Subscription Option - Highlighted */}
            <div className="p-4 bg-primary/5 relative">
              <Badge className="absolute top-2 right-2 bg-emerald-500">
                SAVE 90%+
              </Badge>
              <div className="flex items-center gap-2 mb-3">
                <Crown className="h-5 w-5 text-primary" />
                <span className="font-bold text-lg">Upgrade to Unlimited</span>
              </div>
              
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="text-center p-2 rounded bg-white/50 dark:bg-black/20">
                  <div className="text-2xl font-bold text-primary">$79</div>
                  <div className="text-xs text-muted-foreground">/month</div>
                </div>
                <div className="p-2 text-sm">
                  <div className="flex items-center gap-1 text-emerald-600">
                    <CheckCircle className="h-3 w-3" />
                    <span>Unlimited actions</span>
                  </div>
                  <div className="flex items-center gap-1 text-emerald-600">
                    <CheckCircle className="h-3 w-3" />
                    <span>No credit limits</span>
                  </div>
                  <div className="flex items-center gap-1 text-emerald-600">
                    <CheckCircle className="h-3 w-3" />
                    <span>All features unlocked</span>
                  </div>
                </div>
              </div>

              <Button className="w-full gap-2 h-12 text-base font-semibold" onClick={handleUpgrade}>
                <Sparkles className="h-5 w-5" />
                Upgrade Now — Best Value
                <ArrowRight className="h-5 w-5" />
              </Button>
            </div>

            {/* Credit Pack Option - De-emphasized */}
            <div className="p-4 bg-muted/30">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Coins className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium text-muted-foreground">Or Buy Credit Pack</span>
                </div>
                <Badge variant="outline" className="text-amber-600 border-amber-500/50">
                  Higher Cost
                </Badge>
              </div>
              
              <p className="text-xs text-muted-foreground mb-3">
                Cheapest pack: {cheapestPack.credits} credits for ${(cheapestPack.priceCents / 100).toFixed(2)} 
                ({(costPerCredit * 100).toFixed(1)}¢/credit)
              </p>

              <Button
                variant="outline"
                className="w-full"
                onClick={handleBuyCredits}
              >
                <Coins className="h-4 w-4 mr-2" />
                Buy Credits (Not Recommended)
              </Button>
            </div>
          </div>

          {/* Math breakdown */}
          {comparison.savings > 0 && lifetimeSpent > 100 && (
            <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/20">
              <div className="flex items-center gap-2 mb-1">
                <Calculator className="h-4 w-4 text-blue-500" />
                <span className="text-sm font-medium">Why Subscription Wins</span>
              </div>
              <p className="text-xs text-muted-foreground">
                You've used <strong>{lifetimeSpent.toLocaleString()}</strong> credits.
                At credit pack rates, that's <strong className="text-red-500">${comparison.creditPackCost}+</strong>.
                Subscription = <strong className="text-emerald-500">$79 flat</strong>.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            className="text-muted-foreground"
            onClick={() => onOpenChange(false)}
          >
            <X className="h-4 w-4 mr-1" />
            Stay Limited
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}







