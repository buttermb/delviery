/**
 * SubscriptionTierBadge — colored badge for Starter / Professional / Enterprise.
 */

import { Badge } from '@/components/ui/badge';
import type { SubscriptionTier } from '@/lib/featureConfig';

const TIER_STYLES: Record<SubscriptionTier, string> = {
  starter: 'bg-zinc-100 text-zinc-700 border-zinc-200',
  professional: 'bg-blue-50 text-blue-700 border-blue-200',
  enterprise: 'bg-purple-50 text-purple-700 border-purple-200',
};

const TIER_LABELS: Record<SubscriptionTier, string> = {
  starter: 'Starter',
  professional: 'Professional',
  enterprise: 'Enterprise',
};

interface SubscriptionTierBadgeProps {
  tier: SubscriptionTier;
  className?: string;
}

export function SubscriptionTierBadge({ tier, className }: SubscriptionTierBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={`text-[10px] font-medium uppercase tracking-wide px-1.5 py-0 ${TIER_STYLES[tier]} ${className ?? ''}`}
    >
      {TIER_LABELS[tier]}
    </Badge>
  );
}
