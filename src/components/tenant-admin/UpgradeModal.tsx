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
import { FEATURES, type FeatureId } from '@/lib/featureConfig';
import { getTierPreset, type BusinessTier } from '@/lib/presets/businessTiers';
import { CheckCircle2, Lock, Star, Diamond, Building, Store, Truck } from 'lucide-react';
import { useState } from 'react';
import { TierComparisonModal } from './TierComparisonModal';

interface UpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  featureId: FeatureId;
}

export function UpgradeModal({ open, onOpenChange, featureId }: UpgradeModalProps) {
  const navigate = useNavigate();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { currentTier, currentTierName, checkUpgrade, subscriptionValid } = useFeatureAccess();
  const [showComparison, setShowComparison] = useState(false);

  const feature = FEATURES[featureId];
  const upgradeInfo = checkUpgrade(featureId);

  // Guard: Don't show if no feature, no upgrade needed, or subscription invalid
  if (!feature || !upgradeInfo.required || !subscriptionValid || !upgradeInfo.targetTier) return null;

  const targetPreset = getTierPreset(upgradeInfo.targetTier as BusinessTier);
  const currentPreset = getTierPreset(currentTier as BusinessTier);

  const handleUpgrade = () => {
    onOpenChange(false);
    navigate(`/${tenantSlug}/admin/billing`);
  };

  const getTierIcon = (tier: string) => {
    switch (tier) {
      case 'street': return <Truck className="h-4 w-4" />;
      case 'trap': return <Store className="h-4 w-4" />;
      case 'block': return <Building className="h-4 w-4" />;
      case 'hood': return <Star className="h-4 w-4" />;
      case 'empire': return <Diamond className="h-4 w-4" />;
      default: return <Star className="h-4 w-4" />;
    }
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
              <span className="text-2xl">{getTierIcon(upgradeInfo.targetTier)}</span>
              <h3 className="font-semibold text-lg">{feature.name}</h3>
              <Badge variant="outline" className="ml-auto">
                {targetPreset.displayName} Tier
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">{feature.description}</p>
          </div>

          {/* Tier Comparison */}
          <div className="grid grid-cols-2 gap-4">
            {/* Current Plan */}
            <div className="p-4 border rounded-lg">
              <div className="text-center mb-3">
                <h4 className="font-semibold mb-1">Your Current Tier</h4>
                <Badge variant="outline">{currentPreset.emoji} {currentPreset.displayName}</Badge>
              </div>
              <div className="text-center mb-3">
                <span className="text-sm text-muted-foreground">{currentPreset.revenueRange}</span>
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
                <Badge>{targetPreset.emoji} {targetPreset.displayName}</Badge>
              </div>
              <div className="text-center mb-3">
                <span className="text-sm text-muted-foreground">{targetPreset.revenueRange}</span>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Unlock {feature.name}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>All {currentPreset.displayName} features</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>{targetPreset.typicalLocations} locations</span>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => setShowComparison(true)}
              className="flex-1"
            >
              Compare All Tiers
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
            Upgrade takes effect immediately.
          </p>
        </div>
      </DialogContent>

      <TierComparisonModal
        open={showComparison}
        onOpenChange={setShowComparison}
        currentTier={currentTier as BusinessTier}
      />
    </Dialog>
  );
}
