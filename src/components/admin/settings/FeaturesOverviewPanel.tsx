/**
 * FeaturesOverviewPanel — unified features dashboard for the Settings > Features tab.
 *
 * Shows:
 *   1. Summary stats (total / enabled / disabled / locked)
 *   2. Filter bar (All / Disabled / Locked)
 *   3. Category-grouped feature list with collapsible sections
 *   4. "Enable All Disabled" bulk action
 *   5. Subscription-invalid banner when trial expired / suspended
 */

import { useState, useMemo } from 'react';

import { AlertTriangle, Zap } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { FeatureSummaryStats } from '@/components/admin/settings/FeatureSummaryStats';
import { FeatureCategoryGroup } from '@/components/admin/settings/FeatureCategoryGroup';
import { SubscriptionTierBadge } from '@/components/admin/settings/SubscriptionTierBadge';
import { useUnifiedFeatures, type UnifiedFeatureStatus } from '@/hooks/useUnifiedFeatures';
import { useTenantNavigation } from '@/lib/navigation/tenantNavigation';

type FilterMode = 'all' | 'disabled' | 'locked';

const FILTER_OPTIONS: { value: FilterMode; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'disabled', label: 'Disabled' },
  { value: 'locked', label: 'Locked' },
];

const STATUS_FOR_FILTER: Record<FilterMode, UnifiedFeatureStatus[] | null> = {
  all: null,
  disabled: ['toggle_disabled'],
  locked: ['tier_locked'],
};

export function FeaturesOverviewPanel() {
  const {
    byCategory,
    stats,
    currentTier,
    subscriptionValid,
    isTrialExpired,
    isSuspended,
    isCancelled,
    toggleFeature,
    enableAllToggles,
    isLoading,
  } = useUnifiedFeatures();

  const { navigateToAdmin } = useTenantNavigation();
  const [filter, setFilter] = useState<FilterMode>('all');
  const [bulkEnabling, setBulkEnabling] = useState(false);

  // Filter categories based on selected filter
  const filteredCategories = useMemo(() => {
    const allowedStatuses = STATUS_FOR_FILTER[filter];

    if (!allowedStatuses) return byCategory;

    return byCategory
      .map((group) => ({
        ...group,
        features: group.features.filter((f) => allowedStatuses.includes(f.status)),
      }))
      .filter((group) => group.features.length > 0);
  }, [byCategory, filter]);

  const handleUpgrade = () => {
    navigateToAdmin('billing');
  };

  const handleBulkEnable = async () => {
    setBulkEnabling(true);
    try {
      await enableAllToggles();
    } finally {
      setBulkEnabling(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
        <Skeleton className="h-8 w-64" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Subscription invalid banner */}
      {!subscriptionValid && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-800">
              {isTrialExpired && 'Your trial has expired.'}
              {isSuspended && 'Your account is suspended.'}
              {isCancelled && 'Your subscription has been cancelled.'}
              {!isTrialExpired && !isSuspended && !isCancelled && 'Your subscription needs attention.'}
            </p>
            <p className="text-xs text-amber-700 mt-1">
              Feature toggles are unavailable until your subscription is active.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-2 text-amber-800 border-amber-300 hover:bg-amber-100"
              onClick={handleUpgrade}
            >
              Go to Billing
            </Button>
          </div>
        </div>
      )}

      {/* Header row: tier badge + stats */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Current plan:</span>
          <SubscriptionTierBadge tier={currentTier} />
        </div>
      </div>

      <FeatureSummaryStats stats={stats} />

      <Separator />

      {/* Filter bar + bulk action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex gap-1">
          {FILTER_OPTIONS.map((opt) => (
            <Button
              key={opt.value}
              variant={filter === opt.value ? 'default' : 'ghost'}
              size="sm"
              className="h-8 text-xs"
              onClick={() => setFilter(opt.value)}
            >
              {opt.label}
              {opt.value === 'disabled' && stats.disabled > 0 && (
                <span className="ml-1 text-[10px] opacity-70">({stats.disabled})</span>
              )}
              {opt.value === 'locked' && stats.locked > 0 && (
                <span className="ml-1 text-[10px] opacity-70">({stats.locked})</span>
              )}
            </Button>
          ))}
        </div>

        {stats.disabled > 0 && subscriptionValid && (
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1.5"
            disabled={bulkEnabling}
            onClick={handleBulkEnable}
          >
            <Zap className="h-3.5 w-3.5" />
            Enable All Disabled ({stats.disabled})
          </Button>
        )}
      </div>

      {/* Category groups */}
      <div className="space-y-1">
        {filteredCategories.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No features match the selected filter.
          </div>
        ) : (
          filteredCategories.map((group) => (
            <FeatureCategoryGroup
              key={group.category}
              group={group}
              onToggle={toggleFeature}
              onUpgrade={handleUpgrade}
            />
          ))
        )}
      </div>
    </div>
  );
}
