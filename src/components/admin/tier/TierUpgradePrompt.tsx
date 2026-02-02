/**
 * TierUpgradePrompt Component
 * 
 * Shows a prompt when user qualifies for a higher tier
 */

import { useState } from 'react';
import X from "lucide-react/dist/esm/icons/x";
import TrendingUp from "lucide-react/dist/esm/icons/trending-up";
import ArrowRight from "lucide-react/dist/esm/icons/arrow-right";
import Sparkles from "lucide-react/dist/esm/icons/sparkles";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useBusinessTier } from '@/hooks/useBusinessTier';
import { getTierPreset, type BusinessTier } from '@/lib/presets/businessTiers';
import { TierBadge } from './TierBadge';
import { cn } from '@/lib/utils';

interface TierUpgradePromptProps {
  onUpgrade?: () => void;
  onDismiss?: () => void;
  className?: string;
}

export function TierUpgradePrompt({ 
  onUpgrade, 
  onDismiss,
  className 
}: TierUpgradePromptProps) {
  const { 
    tier, 
    nextTier, 
    nextTierRequirements, 
    qualifiesForUpgrade,
    setTier,
    isSettingTier,
  } = useBusinessTier();
  
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || !qualifiesForUpgrade || !nextTier) {
    return null;
  }

  const currentPreset = getTierPreset(tier);
  const nextPreset = getTierPreset(nextTier);

  // Count new features in next tier
  const newFeaturesCount = nextPreset.enabledFeatures.length - currentPreset.enabledFeatures.length;
  
  const handleUpgrade = async () => {
    setTier({ tier: nextTier, override: false });
    onUpgrade?.();
  };

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  return (
    <Card className={cn(
      'border-2 border-dashed border-success bg-success/5 dark:bg-success/10',
      className
    )}>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-lg flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-success" />
          You've Leveled Up!
        </CardTitle>
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-8 w-8"
          onClick={handleDismiss}
        >
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <div className="flex flex-col items-center">
            <TierBadge tier={tier} size="lg" />
            <span className="text-xs text-muted-foreground mt-1">Current</span>
          </div>
          <ArrowRight className="h-5 w-5 text-success" />
          <div className="flex flex-col items-center">
            <TierBadge tier={nextTier} size="lg" />
            <span className="text-xs text-muted-foreground mt-1">Available</span>
          </div>
        </div>

        <div className="text-sm text-muted-foreground">
          <p>Your business metrics qualify you for the <strong>{nextPreset.displayName}</strong> tier!</p>
          {newFeaturesCount > 0 && (
            <p className="mt-1">
              <TrendingUp className="inline h-4 w-4 mr-1 text-success" />
              Unlock <strong>{newFeaturesCount}+</strong> new features
            </p>
          )}
        </div>

        <div className="flex gap-2">
          <Button 
            onClick={handleUpgrade}
            disabled={isSettingTier}
            className="bg-success hover:bg-success/90 text-success-foreground"
          >
            {isSettingTier ? 'Upgrading...' : `Upgrade to ${nextPreset.displayName}`}
          </Button>
          <Button 
            variant="outline" 
            onClick={handleDismiss}
          >
            Maybe Later
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

