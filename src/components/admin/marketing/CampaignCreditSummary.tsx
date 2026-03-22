/**
 * CampaignCreditSummary Component
 *
 * Displays estimated credit cost for a marketing campaign before sending.
 * Shows: recipient count, per-recipient cost, total cost, and balance impact.
 * Only visible for free-tier users.
 */

import { useMemo } from 'react';
import { Coins, AlertTriangle, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCredits } from '@/hooks/useCredits';
import { getCreditCost } from '@/lib/credits';

export interface CampaignCreditSummaryProps {
  /** Campaign channel type */
  campaignType: 'email' | 'sms';
  /** Number of recipients that will receive the campaign */
  recipientCount: number;
  /** Whether recipient count is still loading */
  isLoadingRecipients?: boolean;
}

export function CampaignCreditSummary({
  campaignType,
  recipientCount,
  isLoadingRecipients = false,
}: CampaignCreditSummaryProps) {
  const { balance, isFreeTier } = useCredits();

  const actionKey = campaignType === 'email' ? 'send_bulk_email' : 'send_bulk_sms';
  const perRecipientCost = getCreditCost(actionKey);

  const { totalCost, balanceAfter, canAfford } = useMemo(() => {
    const total = perRecipientCost * recipientCount;
    const after = balance - total;
    return {
      totalCost: total,
      balanceAfter: after,
      canAfford: balance >= total,
    };
  }, [perRecipientCost, recipientCount, balance]);

  // Only show for free tier users
  if (!isFreeTier) return null;

  // Don't show if no recipients
  if (recipientCount === 0 && !isLoadingRecipients) return null;

  return (
    <div
      className={cn(
        'rounded-lg border p-3 space-y-2',
        !canAfford
          ? 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30'
          : 'border-border bg-muted/50'
      )}
      data-testid="campaign-credit-summary"
    >
      {/* Cost Estimate */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          <Coins className="h-4 w-4 text-primary" />
          <span className="font-medium">Estimated Credit Cost</span>
        </div>
        {isLoadingRecipients ? (
          <span className="text-sm text-muted-foreground">Calculating...</span>
        ) : (
          <span className="text-sm font-bold">
            {totalCost.toLocaleString()} credits
          </span>
        )}
      </div>

      {/* Breakdown */}
      {!isLoadingRecipients && recipientCount > 0 && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Users className="h-3 w-3" />
          <span>
            Sending to {recipientCount.toLocaleString()} recipient{recipientCount !== 1 ? 's' : ''} via{' '}
            {campaignType} ({perRecipientCost}cr each) ={' '}
            {totalCost.toLocaleString()} total credits
          </span>
        </div>
      )}

      {/* Balance Impact */}
      {!isLoadingRecipients && recipientCount > 0 && (
        <div className="flex items-center justify-between text-xs pt-1 border-t border-border/50">
          <span className="text-muted-foreground">
            Balance: {balance.toLocaleString()} → {canAfford ? balanceAfter.toLocaleString() : 'Insufficient'}
          </span>
          {!canAfford && (
            <span className="flex items-center gap-1 text-red-600 dark:text-red-400 font-medium">
              <AlertTriangle className="h-3 w-3" />
              Need {(totalCost - balance).toLocaleString()} more
            </span>
          )}
        </div>
      )}
    </div>
  );
}
