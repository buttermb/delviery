/**
 * FeatureLocked Component
 * 
 * Shows a locked state for features not available in current tier
 */

import { Lock, ArrowUpRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useTenantNavigation } from '@/lib/navigation/tenantNavigation';
import { useBusinessTier } from '@/hooks/useBusinessTier';
import { getTierPreset, getNextTier, type BusinessTier } from '@/lib/presets/businessTiers';
import { TierBadge } from './TierBadge';
import { cn } from '@/lib/utils';

interface FeatureLockedProps {
  featureId?: string;
  featureName?: string;
  requiredTier?: BusinessTier;
  className?: string;
}

export function FeatureLocked({
  featureId,
  featureName,
  requiredTier,
  className
}: FeatureLockedProps) {
  const navigate = useNavigate();
  const { navigateToAdmin } = useTenantNavigation();
  const { tier } = useBusinessTier();

  // Find which tier unlocks this feature if not specified
  const unlockTier = requiredTier || findUnlockTier(featureId || '');
  const unlockPreset = unlockTier ? getTierPreset(unlockTier) : null;

  return (
    <div className={cn(
      'flex flex-col items-center justify-center p-8 rounded-lg',
      'bg-muted/30 border border-dashed border-muted-foreground/20',
      'text-center',
      className
    )}>
      <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
        <Lock className="h-8 w-8 text-muted-foreground" />
      </div>

      <h3 className="text-lg font-semibold mb-2">
        {featureName || 'Feature'} is Locked
      </h3>

      <p className="text-muted-foreground mb-4 max-w-md">
        {unlockPreset ? (
          <>
            This feature is available in the <strong>{unlockPreset.displayName}</strong> tier and above.
          </>
        ) : (
          <>
            This feature is not available in your current plan.
          </>
        )}
      </p>

      {unlockTier && (
        <div className="flex items-center gap-2 mb-4">
          <span className="text-sm text-muted-foreground">Requires:</span>
          <TierBadge tier={unlockTier} />
        </div>
      )}

      <Button
        onClick={() => navigateToAdmin('settings')}
        className="gap-2"
      >
        Upgrade Plan
        <ArrowUpRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

/**
 * Inline badge for sidebar items
 */
export function LockedBadge({ className }: { className?: string }) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded',
      'bg-muted text-muted-foreground',
      className
    )}>
      <Lock className="h-3 w-3" />
    </span>
  );
}

/**
 * Find which tier unlocks a feature
 */
function findUnlockTier(featureId: string): BusinessTier | null {
  const tiers: BusinessTier[] = ['street', 'trap', 'block', 'hood', 'empire'];

  for (const tier of tiers) {
    const preset = getTierPreset(tier);
    if (
      preset.enabledFeatures.includes('all') ||
      preset.enabledFeatures.includes(featureId)
    ) {
      return tier;
    }
  }

  return null;
}

