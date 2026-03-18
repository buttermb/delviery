/**
 * Getting Started Checklist for new tenants
 * Shows 7-step storefront setup progress with links to each step.
 * Dismissable once all items are complete. Persisted via localStorage.
 */

import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import Check from 'lucide-react/dist/esm/icons/check';
import Circle from 'lucide-react/dist/esm/icons/circle';
import ChevronRight from 'lucide-react/dist/esm/icons/chevron-right';
import Rocket from 'lucide-react/dist/esm/icons/rocket';
import X from 'lucide-react/dist/esm/icons/x';
import Store from 'lucide-react/dist/esm/icons/store';
import Package from 'lucide-react/dist/esm/icons/package';
import Palette from 'lucide-react/dist/esm/icons/palette';
import Truck from 'lucide-react/dist/esm/icons/truck';
import CreditCard from 'lucide-react/dist/esm/icons/credit-card';
import Globe from 'lucide-react/dist/esm/icons/globe';
import Share2 from 'lucide-react/dist/esm/icons/share-2';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useStorefrontChecklist } from '@/hooks/useStorefrontChecklist';
import { useLocalStorageState } from '@/hooks/useLocalStorageState';
import { useTenantContext } from '@/hooks/useTenantContext';
import { STORAGE_KEYS } from '@/constants/storageKeys';
import { logger } from '@/lib/logger';
import { cn } from '@/lib/utils';

import type { StorefrontChecklistItem } from '@/hooks/useStorefrontChecklist';

const STEP_ICONS: Record<string, React.ElementType> = {
  'create-store': Store,
  'add-products': Package,
  customize: Palette,
  delivery: Truck,
  payments: CreditCard,
  publish: Globe,
  share: Share2,
};

interface OnboardingProgressChecklistProps {
  storeId: string | null | undefined;
  className?: string;
}

export function OnboardingProgressChecklist({
  storeId,
  className,
}: OnboardingProgressChecklistProps) {
  const { tenantId } = useTenantContext();
  const { data: checklist, isLoading, isError } = useStorefrontChecklist(storeId);
  const [, setSearchParams] = useSearchParams();

  const [dismissed, setDismissed] = useLocalStorageState<boolean>(
    `${STORAGE_KEYS.STOREFRONT_CHECKLIST_DISMISSED_PREFIX}${tenantId ?? 'unknown'}`,
    false,
  );

  const [collapsed, setCollapsed] = useState(false);

  if (dismissed) return null;
  if (isError) return null;

  if (isLoading || !checklist) {
    return <ChecklistSkeleton />;
  }

  const { items, completedCount, totalCount, percentage, allComplete } = checklist;

  const handleDismiss = () => {
    logger.info('[StorefrontChecklist] Dismissed', { tenantId, percentage });
    setDismissed(true);
  };

  const handleStepClick = (item: StorefrontChecklistItem) => {
    // Navigate to the appropriate tab within the storefront hub
    setSearchParams({ tab: item.tabOrHref });
  };

  return (
    <Card className={cn('border-primary/20 bg-gradient-to-br from-primary/5 to-background', className)}>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
        <div className="flex items-center gap-2">
          <Rocket className="h-5 w-5 text-primary" />
          <CardTitle className="text-base font-semibold">
            Getting Started
          </CardTitle>
        </div>
        <div className="flex items-center gap-1">
          {allComplete && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={handleDismiss}
            >
              Dismiss
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground"
            onClick={() => setCollapsed((prev) => !prev)}
            aria-label={collapsed ? 'Expand checklist' : 'Collapse checklist'}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Progress bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {completedCount} of {totalCount} complete
            </span>
            <span className="font-medium">{percentage}%</span>
          </div>
          <Progress value={percentage} className="h-2" />
        </div>

        {/* Checklist items */}
        {!collapsed && (
          <ul className="space-y-1">
            {items.map((item) => {
              const Icon = STEP_ICONS[item.id] ?? Circle;

              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => handleStepClick(item)}
                    className="flex items-center gap-3 rounded-md px-2 py-2 text-sm transition-colors hover:bg-muted/50 group w-full text-left"
                  >
                    {item.completed ? (
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-500 text-white">
                        <Check className="h-3.5 w-3.5" />
                      </span>
                    ) : (
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                    )}
                    <span className="flex-1 min-w-0">
                      <span
                        className={cn(
                          'block',
                          item.completed
                            ? 'line-through text-muted-foreground'
                            : 'text-foreground font-medium',
                        )}
                      >
                        {item.label}
                      </span>
                      {!item.completed && (
                        <span className="block text-xs text-muted-foreground">
                          {item.description}
                        </span>
                      )}
                    </span>
                    {!item.completed && (
                      <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {allComplete && !collapsed && (
          <p className="text-sm text-green-600 font-medium text-center pt-1">
            You're all set! Your store is ready to go.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function ChecklistSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <Skeleton className="h-5 w-36" />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <div className="flex justify-between">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-8" />
          </div>
          <Skeleton className="h-2 w-full rounded-full" />
        </div>
        <div className="space-y-2">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-2 py-2">
              <Skeleton className="h-6 w-6 rounded-full" />
              <Skeleton className="h-4 flex-1" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
