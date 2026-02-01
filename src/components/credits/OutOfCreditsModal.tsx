/**
 * OutOfCreditsModal Component
 *
 * Blocking modal when user tries to perform an action without credits.
 * Shows conversion-focused messaging to push toward subscription.
 * Enhanced with urgency messaging and clear value comparison.
 *
 * Features:
 * - Progress bar showing required vs available credits
 * - Quick purchase buttons for 5K and 15K credit packages
 * - Auto top-up setup suggestion
 * - Link to all packages
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
  X,
  CheckCircle,
  Zap,
  Settings,
  ExternalLink,
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
import { Progress } from '@/components/ui/progress';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useCredits } from '@/hooks/useCredits';
import {
  getCreditCostInfo,
  calculateCreditVsSubscription,
  CREDIT_PACKAGES,
} from '@/lib/credits';

// Quick purchase packages: 5K and 15K
const QUICK_PACKAGES = [
  { id: 'starter-pack', credits: 5000, price: 9.99, label: '5K Credits' },
  { id: 'growth-pack', credits: 15000, price: 24.99, label: '15K Credits' },
];

export interface OutOfCreditsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actionAttempted?: string;
  onBuyCredits?: () => void;
  onQuickPurchase?: (packageId: string) => void;
  onSetupAutoTopUp?: () => void;
}

export function OutOfCreditsModal({
  open,
  onOpenChange,
  actionAttempted,
  onBuyCredits,
  onQuickPurchase,
  onSetupAutoTopUp,
}: OutOfCreditsModalProps) {
  const navigate = useNavigate();
  const { tenant, tenantSlug } = useTenantAdminAuth();
  const { lifetimeSpent, balance } = useCredits();

  // Get action info if provided
  const actionInfo = actionAttempted ? getCreditCostInfo(actionAttempted) : null;

  // Calculate progress for the progress bar (how much of required credits we have)
  const requiredCredits = actionInfo?.credits ?? 100;
  const progressPercent = Math.min(100, Math.max(0, (balance / requiredCredits) * 100));
  const creditsNeeded = Math.max(0, requiredCredits - balance);

  // Calculate how much they would save with subscription
  const comparison = calculateCreditVsSubscription(
    Math.max(lifetimeSpent, 500) // Minimum for realistic calculation
  );

  // Calculate cost to complete blocked action via credit pack
  const cheapestPack = CREDIT_PACKAGES[0];
  const costPerCredit = cheapestPack.priceCents / cheapestPack.credits / 100;

  const handleUpgrade = () => {
    onOpenChange(false);
    navigate(`/${tenantSlug}/admin/select-plan`);
  };

  const handleBuyCredits = () => {
    onOpenChange(false);
    onBuyCredits?.();
  };

  const handleQuickPurchase = (packageId: string) => {
    onOpenChange(false);
    onQuickPurchase?.(packageId);
  };

  const handleSetupAutoTopUp = () => {
    onOpenChange(false);
    if (onSetupAutoTopUp) {
      onSetupAutoTopUp();
    } else {
      navigate(`/${tenantSlug}/admin/billing?tab=auto-top-up`);
    }
  };

  const handleViewAllPackages = () => {
    onOpenChange(false);
    navigate(`/${tenantSlug}/admin/billing?tab=credits`);
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
              ? `Cannot ${actionInfo.actionName.toLowerCase()} — not enough credits.`
              : "Your business actions are paused until you get more credits."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Credit Progress Visualization */}
          <div className="p-4 rounded-lg bg-muted/30 border">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium">Credits Required</span>
              <span className="text-sm text-muted-foreground">
                {balance.toLocaleString()} / {requiredCredits.toLocaleString()}
              </span>
            </div>
            <Progress
              value={progressPercent}
              className="h-3"
              data-testid="credits-progress"
            />
            <div className="flex justify-between items-center mt-2">
              <span className="text-xs text-red-500 font-medium">
                Need {creditsNeeded.toLocaleString()} more credits
              </span>
              <span className="text-xs text-muted-foreground">
                {progressPercent.toFixed(0)}% available
              </span>
            </div>
          </div>

          {/* Blocked Action + Balance Cards */}
          <div className="grid grid-cols-2 gap-3">
            {actionInfo && (
              <div className="p-3 rounded-lg bg-muted/50 text-center">
                <div className="text-xs text-muted-foreground mb-1">Action Cost</div>
                <div className="text-lg font-bold text-amber-600">
                  {actionInfo.credits.toLocaleString()} credits
                </div>
              </div>
            )}
            <div className={`p-3 rounded-lg bg-red-500/5 border border-red-500/20 text-center ${!actionInfo ? 'col-span-2' : ''}`}>
              <div className="text-xs text-muted-foreground mb-1">Your Balance</div>
              <div className="text-lg font-bold text-red-500">
                {balance.toLocaleString()} credits
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

          {/* Quick Purchase Buttons */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Zap className="h-4 w-4 text-primary" />
              Quick Top-Up
            </div>
            <div className="grid grid-cols-2 gap-3">
              {QUICK_PACKAGES.map((pkg) => (
                <Button
                  key={pkg.id}
                  variant="outline"
                  className="h-auto py-3 flex-col gap-1"
                  onClick={() => handleQuickPurchase(pkg.id)}
                  data-testid={`quick-purchase-${pkg.id}`}
                >
                  <span className="font-bold text-primary">{pkg.label}</span>
                  <span className="text-xs text-muted-foreground">${pkg.price}</span>
                </Button>
              ))}
            </div>
            <Button
              variant="link"
              size="sm"
              className="w-full text-muted-foreground"
              onClick={handleViewAllPackages}
              data-testid="view-all-packages"
            >
              View all packages
              <ExternalLink className="h-3 w-3 ml-1" />
            </Button>
          </div>

          {/* Auto Top-Up Suggestion */}
          <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/20">
            <div className="flex items-start gap-3">
              <Settings className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium">Never run out again</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Set up auto top-up to automatically purchase credits when your balance is low.
                </p>
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto p-0 mt-2 text-blue-500"
                  onClick={handleSetupAutoTopUp}
                  data-testid="setup-auto-top-up"
                >
                  Set up auto top-up
                  <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              </div>
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







