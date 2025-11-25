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
import { FEATURES, TIER_NAMES, TIER_PRICES, type FeatureId } from '@/lib/featureConfig';
import { CheckCircle2, Lock, Star, Diamond } from 'lucide-react';

interface UpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  featureId: FeatureId;
}

export function UpgradeModal({ open, onOpenChange, featureId }: UpgradeModalProps) {
  const navigate = useNavigate();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { currentTier, currentTierName, checkUpgrade, subscriptionValid } = useFeatureAccess();
  
  const feature = FEATURES[featureId];
  const upgradeInfo = checkUpgrade(featureId);
  
  // Guard: Don't show if no feature, no upgrade needed, or subscription invalid
  if (!feature || !upgradeInfo.required || !subscriptionValid) return null;
  
  const handleUpgrade = () => {
    onOpenChange(false);
    navigate(`/${tenantSlug}/admin/billing`);
  };
  
  const getTierIcon = (tier: string) => {
    if (tier === 'enterprise') return <Diamond className="h-4 w-4" />;
    if (tier === 'professional') return <Star className="h-4 w-4" />;
    return null;
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
          <div className="p-4 bg-muted rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">{getTierIcon(feature.tier)}</span>
              <h3 className="font-semibold text-lg">{feature.name}</h3>
              <Badge variant="outline" className="ml-auto">
                {TIER_NAMES[feature.tier]}
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
                <Badge variant="outline">{currentTierName}</Badge>
              </div>
              <div className="text-center mb-3">
                <span className="text-2xl font-bold">${TIER_PRICES[currentTier]}</span>
                <span className="text-sm text-muted-foreground">/month</span>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Lock className="h-4 w-4" />
                  <span>Limited features</span>
                </div>
              </div>
            </div>
            
            {/* Target Plan */}
            <div className="p-4 border-2 border-primary rounded-lg bg-primary/5">
              <div className="text-center mb-3">
                <h4 className="font-semibold mb-1">Upgrade To</h4>
                <Badge>{TIER_NAMES[upgradeInfo.targetTier!]}</Badge>
              </div>
              <div className="text-center mb-3">
                <span className="text-2xl font-bold">${TIER_PRICES[upgradeInfo.targetTier!]}</span>
                <span className="text-sm text-muted-foreground">/month</span>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Unlock {feature.name}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>All {currentTierName} features</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Priority support</span>
                </div>
              </div>
            </div>
          </div>
          
          {/* Price Difference */}
          <div className="p-4 bg-primary/10 border border-primary/20 rounded-lg text-center">
            <p className="text-sm text-muted-foreground mb-1">Additional cost</p>
            <p className="text-2xl font-bold text-primary">
              +${upgradeInfo.priceDifference}/month
            </p>
          </div>
          
          {/* Actions */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              Maybe Later
            </Button>
            <Button
              onClick={handleUpgrade}
              className="flex-1"
            >
              View Plans & Upgrade
            </Button>
          </div>
          
          {/* Footer Note */}
          <p className="text-xs text-center text-muted-foreground">
            Upgrade or downgrade anytime. Changes take effect immediately.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
