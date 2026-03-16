/**
 * useUnifiedFeatures
 *
 * Merges the two independent feature systems into a single view:
 *   1. Feature Toggles — per-tenant on/off flags (useTenantFeatureToggles)
 *   2. Subscription Tiers — plan-locked features (useFeatureAccess + featureConfig)
 *
 * Returns every feature with a unified status, grouped by category,
 * plus aggregate stats and bulk-action helpers.
 */

import { useMemo, useCallback } from 'react';

import { toast } from 'sonner';

import {
  FEATURES,
  CATEGORY_ORDER,
  ESSENTIAL_FEATURES,
  type FeatureId,
  type FeatureCategory,
  type SubscriptionTier,
} from '@/lib/featureConfig';
import { type FeatureToggleKey } from '@/lib/featureFlags';
import { FEATURE_TO_TOGGLE_MAP } from '@/lib/featureMapping';
import { useTenantFeatureToggles } from '@/hooks/useTenantFeatureToggles';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { humanizeError } from '@/lib/humanizeError';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type UnifiedFeatureStatus =
  | 'core_enabled'       // Essential feature, always on
  | 'toggle_enabled'     // Has a toggle and it's ON
  | 'toggle_disabled'    // Has a toggle and it's OFF (tenant can enable)
  | 'tier_accessible'    // Tier grants access, no toggle needed
  | 'tier_locked';       // Locked behind a higher subscription tier

export interface UnifiedFeature {
  id: FeatureId;
  name: string;
  description: string;
  category: FeatureCategory;
  tier: SubscriptionTier;
  status: UnifiedFeatureStatus;
  toggleKey: FeatureToggleKey | null;
  requiredTier: SubscriptionTier | null;
}

export interface CategoryGroup {
  category: FeatureCategory;
  features: UnifiedFeature[];
  enabledCount: number;
  totalCount: number;
}

export interface FeatureStats {
  total: number;
  enabled: number;
  disabled: number;  // toggle_disabled — tenant can flip on
  locked: number;    // tier_locked — needs upgrade
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useUnifiedFeatures() {
  const { isEnabled, toggleFeature, isLoading: togglesLoading } = useTenantFeatureToggles();
  const {
    currentTier,
    canAccess,
    subscriptionValid,
    isTrialExpired,
    isSuspended,
    isCancelled,
  } = useFeatureAccess();

  // Build unified feature list
  const features = useMemo<UnifiedFeature[]>(() => {
    const allFeatureIds = Object.keys(FEATURES) as FeatureId[];

    return allFeatureIds.map((id) => {
      const feature = FEATURES[id];
      const toggleKey = (FEATURE_TO_TOGGLE_MAP[id] as FeatureToggleKey) ?? null;
      const isEssential = ESSENTIAL_FEATURES.includes(id);
      const tierAccessible = canAccess(id);

      let status: UnifiedFeatureStatus;

      if (isEssential) {
        status = 'core_enabled';
      } else if (!tierAccessible) {
        status = 'tier_locked';
      } else if (toggleKey) {
        // Feature is tier-accessible AND has a toggle
        const toggledOn = isEnabled(toggleKey);
        status = toggledOn ? 'toggle_enabled' : 'toggle_disabled';
      } else {
        // Tier-accessible, no toggle — just available
        status = 'tier_accessible';
      }

      return {
        id,
        name: feature.name,
        description: feature.description,
        category: feature.category,
        tier: feature.tier,
        status,
        toggleKey,
        requiredTier: feature.tier,
      };
    });
  }, [canAccess, isEnabled]);

  // Group by category in sidebar order
  const byCategory = useMemo<CategoryGroup[]>(() => {
    const grouped = new Map<FeatureCategory, UnifiedFeature[]>();

    for (const f of features) {
      const list = grouped.get(f.category) ?? [];
      list.push(f);
      grouped.set(f.category, list);
    }

    return CATEGORY_ORDER
      .filter((cat) => grouped.has(cat))
      .map((cat) => {
        const catFeatures = grouped.get(cat)!;
        const enabledCount = catFeatures.filter(
          (f) => f.status === 'core_enabled' || f.status === 'toggle_enabled' || f.status === 'tier_accessible',
        ).length;

        return {
          category: cat,
          features: catFeatures,
          enabledCount,
          totalCount: catFeatures.length,
        };
      });
  }, [features]);

  // Aggregate stats
  const stats = useMemo<FeatureStats>(() => {
    let enabled = 0;
    let disabled = 0;
    let locked = 0;

    for (const f of features) {
      switch (f.status) {
        case 'core_enabled':
        case 'toggle_enabled':
        case 'tier_accessible':
          enabled++;
          break;
        case 'toggle_disabled':
          disabled++;
          break;
        case 'tier_locked':
          locked++;
          break;
      }
    }

    return { total: features.length, enabled, disabled, locked };
  }, [features]);

  // Toggle a single feature
  const handleToggle = useCallback(
    async (featureId: FeatureId, enabled: boolean) => {
      const toggleKey = FEATURE_TO_TOGGLE_MAP[featureId] as FeatureToggleKey | undefined;
      if (!toggleKey) return;

      try {
        await toggleFeature(toggleKey, enabled);
        toast.success(`${enabled ? 'Enabled' : 'Disabled'} feature`);
      } catch (err) {
        logger.error('[useUnifiedFeatures] Toggle failed', err instanceof Error ? err : new Error(String(err)));
        toast.error('Failed to update feature', { description: humanizeError(err) });
      }
    },
    [toggleFeature],
  );

  // Enable all currently-disabled toggles in one batch
  const enableAllToggles = useCallback(async () => {
    const disabledToggles = features
      .filter((f) => f.status === 'toggle_disabled' && f.toggleKey)
      .map((f) => f.toggleKey!);

    if (disabledToggles.length === 0) return;

    let succeeded = 0;
    let failed = 0;

    for (const key of disabledToggles) {
      try {
        await toggleFeature(key, true);
        succeeded++;
      } catch (err) {
        failed++;
        logger.error('[useUnifiedFeatures] Failed to enable toggle', { key, err: err instanceof Error ? err : new Error(String(err)) });
      }
    }

    if (failed === 0) {
      toast.success(`Enabled ${succeeded} features`);
    } else if (succeeded > 0) {
      toast.warning(`Enabled ${succeeded} of ${disabledToggles.length} features`, {
        description: `${failed} failed to enable. Try again.`,
      });
    } else {
      toast.error('Failed to enable features');
    }
  }, [features, toggleFeature]);

  return {
    features,
    byCategory,
    stats,
    currentTier,
    subscriptionValid,
    isTrialExpired,
    isSuspended,
    isCancelled,
    toggleFeature: handleToggle,
    enableAllToggles,
    isLoading: togglesLoading,
  };
}
