/**
 * FeatureCategoryGroup — collapsible section of features within a single category.
 *
 * Categories that contain disabled or locked features start expanded so the
 * user immediately sees what they're missing.
 */

import { useState } from 'react';

import { ChevronDown, ChevronRight } from 'lucide-react';

import { Separator } from '@/components/ui/separator';
import { FeatureRow } from '@/components/admin/settings/FeatureRow';
import type { CategoryGroup } from '@/hooks/useUnifiedFeatures';
import type { FeatureId } from '@/lib/featureConfig';

interface FeatureCategoryGroupProps {
  group: CategoryGroup;
  onToggle: (featureId: FeatureId, enabled: boolean) => Promise<void>;
  onUpgrade: () => void;
  defaultOpen?: boolean;
}

export function FeatureCategoryGroup({
  group,
  onToggle,
  onUpgrade,
  defaultOpen,
}: FeatureCategoryGroupProps) {
  const hasActionable = group.features.some(
    (f) => f.status === 'toggle_disabled' || f.status === 'tier_locked',
  );
  const [open, setOpen] = useState(defaultOpen ?? hasActionable);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center gap-2 w-full text-left py-2 group"
      >
        {open ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
        <span className="text-sm font-semibold">{group.category}</span>
        <span className="text-xs text-muted-foreground ml-1">
          {group.enabledCount}/{group.totalCount}
        </span>
      </button>

      {open && (
        <div className="ml-1 space-y-0.5">
          {group.features.map((feature) => (
            <FeatureRow
              key={feature.id}
              feature={feature}
              onToggle={onToggle}
              onUpgrade={onUpgrade}
            />
          ))}
        </div>
      )}

      <Separator className="mt-2" />
    </div>
  );
}
