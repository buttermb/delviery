/**
 * FeatureRow — single row inside a category group.
 *
 * Shows: name, description, tier badge, and an action control:
 *   - Switch for toggle-able features
 *   - "Upgrade" link for tier-locked features
 *   - Nothing for core/tier-accessible features (always on)
 */

import { useState } from 'react';

import { Lock, ArrowUpRight, CheckCircle2, Loader2 } from 'lucide-react';

import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { SubscriptionTierBadge } from '@/components/admin/settings/SubscriptionTierBadge';
import type { UnifiedFeature } from '@/hooks/useUnifiedFeatures';
import type { FeatureId } from '@/lib/featureConfig';

interface FeatureRowProps {
  feature: UnifiedFeature;
  onToggle: (featureId: FeatureId, enabled: boolean) => Promise<void>;
  onUpgrade: () => void;
}

export function FeatureRow({ feature, onToggle, onUpgrade }: FeatureRowProps) {
  const [toggling, setToggling] = useState(false);

  const handleToggle = async (checked: boolean) => {
    setToggling(true);
    try {
      await onToggle(feature.id, checked);
    } finally {
      setToggling(false);
    }
  };

  const isLocked = feature.status === 'tier_locked';
  const isToggleable = feature.status === 'toggle_enabled' || feature.status === 'toggle_disabled';

  return (
    <div
      className={`flex items-center justify-between gap-4 py-3 px-4 rounded-md transition-colors ${
        isLocked ? 'opacity-60' : ''
      }`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {isLocked && <Lock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
          <span className="text-sm font-medium truncate">{feature.name}</span>
          <SubscriptionTierBadge tier={feature.tier} />
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 truncate">
          {feature.description}
        </p>
      </div>

      <div className="shrink-0 flex items-center gap-2">
        {isToggleable && (
          <>
            {toggling && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
            <Switch
              checked={feature.status === 'toggle_enabled'}
              disabled={toggling}
              onCheckedChange={handleToggle}
            />
          </>
        )}

        {isLocked && (
          <Button
            variant="ghost"
            size="sm"
            className="text-xs h-7 gap-1 text-blue-600 hover:text-blue-700"
            onClick={onUpgrade}
          >
            Upgrade
            <ArrowUpRight className="h-3 w-3" />
          </Button>
        )}

        {(feature.status === 'core_enabled' || feature.status === 'tier_accessible') && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            <span>Active</span>
          </div>
        )}
      </div>
    </div>
  );
}
