/**
 * Determines the CTA button text for each plan card on the SelectPlanPage.
 * Extracted for testability and clarity across all subscription states.
 */

interface GetButtonTextParams {
  planTier: string;
  price: number;
  period: string;
  currentTier: string;
  isFreeTier: boolean;
  isTrial: boolean;
  isActive: boolean;
  isCancelled: boolean;
  isPastDue: boolean;
  isSuspended: boolean;
  skipTrial: boolean;
}

const TIER_ORDER: Record<string, number> = {
  starter: 1,
  professional: 2,
  enterprise: 3,
};

export function getButtonText(params: GetButtonTextParams): string {
  const {
    planTier,
    price,
    period,
    currentTier,
    isFreeTier,
    isTrial,
    isActive,
    isCancelled,
    isPastDue,
    isSuspended,
    skipTrial,
  } = params;

  const priceLabel = `$${price}${period}`;

  // Current plan check (non-free-tier users viewing their own tier)
  if (!isFreeTier && planTier === currentTier && !isCancelled && !isSuspended) {
    return 'Current Plan';
  }

  // Free tier upgrading to any paid plan
  if (isFreeTier) {
    return skipTrial ? `Subscribe Now - ${priceLabel}` : 'Start 14-Day Free Trial';
  }

  // Cancelled users can resubscribe to any plan
  if (isCancelled) {
    return `Resubscribe - ${priceLabel}`;
  }

  // Suspended users need to reactivate
  if (isSuspended) {
    return `Reactivate - ${priceLabel}`;
  }

  // Past-due users need to update payment
  if (isPastDue) {
    return `Update Payment - ${priceLabel}`;
  }

  // Trial users viewing a different plan than their current
  if (isTrial) {
    const currentOrder = TIER_ORDER[currentTier] ?? 0;
    const planOrder = TIER_ORDER[planTier] ?? 0;

    if (planOrder > currentOrder) {
      return skipTrial ? `Upgrade - ${priceLabel}` : `Upgrade Trial to ${planTier.charAt(0).toUpperCase() + planTier.slice(1)}`;
    }
    if (planOrder < currentOrder) {
      return skipTrial ? `Downgrade - ${priceLabel}` : `Downgrade Trial to ${planTier.charAt(0).toUpperCase() + planTier.slice(1)}`;
    }
    // Same tier (caught above by "Current Plan" unless edge case)
    return skipTrial ? `Subscribe Now - ${priceLabel}` : 'Start 14-Day Free Trial';
  }

  // Active subscribers upgrading or downgrading
  if (isActive) {
    const currentOrder = TIER_ORDER[currentTier] ?? 0;
    const planOrder = TIER_ORDER[planTier] ?? 0;

    if (planOrder > currentOrder) {
      return `Upgrade to ${priceLabel}`;
    }
    if (planOrder < currentOrder) {
      return `Downgrade to ${priceLabel}`;
    }
  }

  // Fallback for any unhandled state
  return skipTrial ? `Subscribe - ${priceLabel}` : 'Start Free Trial';
}
