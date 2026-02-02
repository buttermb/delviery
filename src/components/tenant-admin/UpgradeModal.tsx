/**
 * Upgrade Modal Component
 * Shows upgrade options when accessing locked features
 */

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useNavigate, useParams } from 'react-router-dom';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import {
  FEATURES,
  TIER_NAMES,
  TIER_PRICES,
  type FeatureId,
  type SubscriptionTier,
} from '@/lib/featureConfig';
import CheckCircle2 from "lucide-react/dist/esm/icons/check-circle-2";
import Lock from "lucide-react/dist/esm/icons/lock";
import Star from "lucide-react/dist/esm/icons/star";
import Diamond from "lucide-react/dist/esm/icons/diamond";
import Zap from "lucide-react/dist/esm/icons/zap";
import { useState } from 'react';
import { TierComparisonModal } from './TierComparisonModal';
import { subscriptionTierToBusinessTier } from '@/lib/tierMapping';
import { type BusinessTier } from '@/lib/presets/businessTiers';

interface UpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  featureId: FeatureId;
}

// Subscription tier display info
const TIER_INFO: Record<SubscriptionTier, { icon: React.ReactNode; color: string; bgColor: string }> = {
  starter: {
    icon: <Zap className="h-5 w-5" />,
    color: 'text-green-600',
    bgColor: 'bg-green-50 dark:bg-green-900/20',
  },
  professional: {
    icon: <Star className="h-5 w-5" />,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50 dark:bg-blue-900/20',
  },
  enterprise: {
    icon: <Diamond className="h-5 w-5" />,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50 dark:bg-purple-900/20',
  },
};

export function UpgradeModal({ open, onOpenChange, featureId }: UpgradeModalProps) {
  const navigate = useNavigate();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { currentTier, currentTierName, checkUpgrade, subscriptionValid } = useFeatureAccess();
  const [showComparison, setShowComparison] = useState(false);

  const feature = FEATURES[featureId];
  const upgradeInfo = checkUpgrade(featureId);

  // Guard: Don't show if no feature, no upgrade needed, or subscription invalid
  if (!feature || !upgradeInfo.required || !subscriptionValid || !upgradeInfo.targetTier) return null;

  const targetTier = upgradeInfo.targetTier as SubscriptionTier;
  const currentTierInfo = TIER_INFO[currentTier];
  const targetTierInfo = TIER_INFO[targetTier];

  const handleUpgrade = () => {
    onOpenChange(false);
    navigate(`/${tenantSlug}/admin/billing`);
  };

  // Feature highlights for each tier
  const tierHighlights: Record<SubscriptionTier, string[]> = {
    starter: [
      'Basic orders & menus',
      'Product catalog',
      'Customer list',
      'Basic reports',
    ],
    professional: [
      'Everything in Starter',
      'Live orders dashboard',
      'Advanced CRM',
      'Team management',
      'Marketing automation',
      'Analytics & forecasting',
    ],
    enterprise: [
      'Everything in Professional',
      'Fleet management',
      'POS system',
      'Multi-location',
      'API access',
      '24/7 priority support',
    ],
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-2">
            <Lock className="h-6 w-6 text-muted-foreground" />
            <DialogTitle className="text-2xl">Upgrade Required</DialogTitle>
          </div>
          <DialogDescription className="text-base">
            Access <strong>{feature.name}</strong> by upgrading your plan
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Feature Info */}
          <div className={`p-4 rounded-lg ${targetTierInfo.bgColor}`}>
            <div className="flex items-center gap-2 mb-2">
              <span className={targetTierInfo.color}>{targetTierInfo.icon}</span>
              <h3 className="font-semibold text-lg">{feature.name}</h3>
              <Badge variant="outline" className="ml-auto">
                {TIER_NAMES[targetTier]} Required
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">{feature.description}</p>
          </div>

          {/* Tier Comparison */}
          <div className="grid grid-cols-2 gap-4">
            {/* Current Plan */}
            <div className="p-4 border rounded-lg">
              <div className="text-center mb-3">
                <h4 className="font-semibold mb-1">Your Current Plan</h4>
                <Badge variant="outline" className={currentTierInfo.color}>
                  {currentTierInfo.icon}
                  <span className="ml-1">{currentTierName}</span>
                </Badge>
              </div>
              <div className="text-center mb-3">
                <span className="text-2xl font-bold">${TIER_PRICES[currentTier]}</span>
                <span className="text-sm text-muted-foreground">/month</span>
              </div>
              <div className="space-y-2">
                {tierHighlights[currentTier].slice(0, 3).map((highlight, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span>{highlight}</span>
                  </div>
                ))}
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Lock className="h-4 w-4" />
                  <span>{feature.name} not included</span>
                </div>
              </div>
            </div>

            {/* Target Plan */}
            <div className="p-4 border-2 border-primary rounded-lg bg-primary/5">
              <div className="text-center mb-3">
                <h4 className="font-semibold mb-1">Upgrade To</h4>
                <Badge className={`${targetTierInfo.bgColor} ${targetTierInfo.color}`}>
                  {targetTierInfo.icon}
                  <span className="ml-1">{TIER_NAMES[targetTier]}</span>
                </Badge>
              </div>
              <div className="text-center mb-3">
                <span className="text-2xl font-bold">${TIER_PRICES[targetTier]}</span>
                <span className="text-sm text-muted-foreground">/month</span>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <CheckCircle2 className="h-4 w-4" />
                  <span className="font-medium">Unlock {feature.name}</span>
                </div>
                {tierHighlights[targetTier].slice(0, 4).map((highlight, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-green-600">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>{highlight}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Price Difference */}
          {upgradeInfo.priceDifference > 0 && (
            <div className="text-center p-3 bg-muted rounded-lg">
              <span className="text-sm text-muted-foreground">
                Upgrade for just <strong className="text-foreground">${upgradeInfo.priceDifference}/month</strong> more
              </span>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => setShowComparison(true)}
              className="flex-1"
            >
              Compare All Plans
            </Button>
            <Button
              onClick={handleUpgrade}
              className="flex-1"
            >
              View Upgrade Options
            </Button>
          </div>

          {/* Footer Note */}
          <p className="text-xs text-center text-muted-foreground">
            Upgrades take effect immediately. You can cancel anytime.
          </p>
        </div>
      </DialogContent>

      <TierComparisonModal
        open={showComparison}
        onOpenChange={setShowComparison}
        currentTier={subscriptionTierToBusinessTier(currentTier) as BusinessTier}
      />
    </Dialog>
  );
}
