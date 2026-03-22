/**
 * LowCreditNudge Component
 *
 * Shows upgrade prompts at key moments when free tier users
 * attempt premium actions with low credits.
 *
 * Two variants:
 * - "compact" (default): Small header/nav badge showing balance + buy CTA
 * - "inline": Contextual card shown near the action that triggered it,
 *   with upgrade-to-plan messaging and the attempted action context
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Zap, ChevronRight, X, Crown, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useCredits } from '@/hooks/useCredits';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { getCreditCostInfo } from '@/lib/credits';
import { PLAN_CONFIG } from '@/config/planPricing';
import { CreditPurchaseModal } from './CreditPurchaseModal';

export interface LowCreditNudgeProps {
  className?: string;
  /** Display variant: compact badge or inline contextual card */
  variant?: 'compact' | 'inline';
  /** Threshold below which to show the nudge (default: 500 for inline, 100 for compact) */
  threshold?: number;
  /** Action key that triggered the nudge (used in inline variant for context) */
  actionKey?: string;
  /** Allow dismissing for this session */
  dismissible?: boolean;
  /** Callback when dismissed */
  onDismiss?: () => void;
}

export function LowCreditNudge({
  className,
  variant = 'compact',
  threshold,
  actionKey,
  dismissible = true,
  onDismiss,
}: LowCreditNudgeProps) {
  const [dismissed, setDismissed] = useState(false);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const navigate = useNavigate();
  const { tenantSlug } = useTenantAdminAuth();

  const {
    balance,
    isFreeTier,
    isLoading,
    isOutOfCredits,
    isCriticalCredits,
  } = useCredits();

  // Resolve effective threshold based on variant
  const effectiveThreshold = threshold ?? (variant === 'inline' ? 500 : 100);

  // Don't show for paid tier users or while loading
  if (!isFreeTier || isLoading) {
    return null;
  }

  // Don't show if balance is above threshold
  if (balance > effectiveThreshold && !isOutOfCredits && !isCriticalCredits) {
    return null;
  }

  // Don't show if dismissed
  if (dismissed) {
    return null;
  }

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDismissed(true);
    onDismiss?.();
  };

  const handleUpgrade = () => {
    navigate(`/${tenantSlug}/admin/select-plan`);
  };

  // Determine urgency level
  const isUrgent = isOutOfCredits || balance <= 25;
  const isWarning = isCriticalCredits || balance <= 50;

  if (variant === 'inline') {
    return (
      <InlineNudge
        balance={balance}
        isOutOfCredits={isOutOfCredits}
        actionKey={actionKey}
        dismissible={dismissible}
        className={className}
        onDismiss={handleDismiss}
        onUpgrade={handleUpgrade}
        onBuyCredits={() => setShowPurchaseModal(true)}
        showPurchaseModal={showPurchaseModal}
        onPurchaseModalChange={setShowPurchaseModal}
      />
    );
  }

  return (
    <>
      <div
        data-testid="low-credit-nudge"
        className={cn(
          'flex items-center gap-2 px-3 py-1.5 rounded-full text-sm cursor-pointer transition-all',
          isUrgent
            ? 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 animate-pulse'
            : isWarning
              ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20'
              : 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border border-yellow-500/20',
          className
        )}
        onClick={() => setShowPurchaseModal(true)}
      >
        {isUrgent ? (
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
        ) : (
          <Zap className="h-4 w-4 flex-shrink-0" />
        )}

        <span className="font-medium">
          {isOutOfCredits
            ? 'Out of credits!'
            : `${balance} credits left`}
        </span>

        <Badge
          variant="secondary"
          className={cn(
            'text-xs px-1.5 py-0',
            isUrgent
              ? 'bg-red-500 text-white hover:bg-red-600'
              : isWarning
                ? 'bg-orange-500 text-white hover:bg-orange-600'
                : 'bg-yellow-500 text-white hover:bg-yellow-600'
          )}
        >
          Buy Now
          <ChevronRight className="h-3 w-3 ml-0.5" />
        </Badge>

        {dismissible && (
          <button
            onClick={handleDismiss}
            className="ml-1 p-0.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10"
            aria-label="Dismiss notification"
            title="Dismiss"
            data-testid="nudge-dismiss"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      <CreditPurchaseModal
        open={showPurchaseModal}
        onOpenChange={setShowPurchaseModal}
      />
    </>
  );
}

// ============================================================================
// Inline Variant — Contextual upgrade prompt shown near premium actions
// ============================================================================

interface InlineNudgeProps {
  balance: number;
  isOutOfCredits: boolean;
  actionKey?: string;
  dismissible: boolean;
  className?: string;
  onDismiss: (e: React.MouseEvent) => void;
  onUpgrade: () => void;
  onBuyCredits: () => void;
  showPurchaseModal: boolean;
  onPurchaseModalChange: (open: boolean) => void;
}

function InlineNudge({
  balance,
  isOutOfCredits,
  actionKey,
  dismissible,
  className,
  onDismiss,
  onUpgrade,
  onBuyCredits,
  showPurchaseModal,
  onPurchaseModalChange,
}: InlineNudgeProps) {
  const actionInfo = actionKey ? getCreditCostInfo(actionKey) : null;
  const actionCost = actionInfo?.credits ?? 0;
  const canAfford = balance >= actionCost && actionCost > 0;

  // Build contextual message
  const balanceText = isOutOfCredits
    ? 'You have no credits remaining.'
    : `You have ${balance.toLocaleString()} credits left.`;

  const actionText = actionInfo && !canAfford
    ? ` This action requires ${actionCost.toLocaleString()} credits.`
    : '';

  return (
    <>
      <div
        data-testid="low-credit-nudge-inline"
        className={cn(
          'rounded-lg border p-4',
          isOutOfCredits
            ? 'bg-red-500/5 border-red-500/20'
            : 'bg-amber-500/5 border-amber-500/20',
          className
        )}
      >
        <div className="flex items-start gap-3">
          <div className={cn(
            'mt-0.5 flex-shrink-0 rounded-full p-1.5',
            isOutOfCredits ? 'bg-red-500/10' : 'bg-amber-500/10'
          )}>
            <Zap className={cn(
              'h-4 w-4',
              isOutOfCredits ? 'text-red-500' : 'text-amber-500'
            )} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium">
                {balanceText}{actionText}
              </p>
              {dismissible && (
                <button
                  onClick={onDismiss}
                  className="flex-shrink-0 p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10"
                  aria-label="Dismiss"
                  data-testid="nudge-inline-dismiss"
                >
                  <X className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              )}
            </div>

            <p className="text-sm text-muted-foreground mt-1">
              Upgrade to a plan for unlimited actions and premium features.
            </p>

            <div className="flex flex-wrap items-center gap-2 mt-3">
              <Button
                size="sm"
                className="gap-1.5"
                onClick={onUpgrade}
                data-testid="nudge-upgrade-btn"
              >
                <Crown className="h-3.5 w-3.5" />
                Upgrade — ${PLAN_CONFIG.starter.priceMonthly}/mo
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={onBuyCredits}
                data-testid="nudge-buy-credits-btn"
              >
                Buy Credits
              </Button>
            </div>
          </div>
        </div>
      </div>

      <CreditPurchaseModal
        open={showPurchaseModal}
        onOpenChange={onPurchaseModalChange}
      />
    </>
  );
}

export default LowCreditNudge;
