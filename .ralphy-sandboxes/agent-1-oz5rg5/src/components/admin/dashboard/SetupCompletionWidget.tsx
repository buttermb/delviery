/**
 * Setup Completion Widget
 * Shows a checklist of setup steps with progress bar on the admin dashboard.
 * Each item links to the relevant admin page.
 * Dismissable once all items are complete.
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import Check from 'lucide-react/dist/esm/icons/check';
import Circle from 'lucide-react/dist/esm/icons/circle';
import X from 'lucide-react/dist/esm/icons/x';
import ChevronRight from 'lucide-react/dist/esm/icons/chevron-right';
import Rocket from 'lucide-react/dist/esm/icons/rocket';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useSetupChecklist } from '@/hooks/useSetupChecklist';
import { useLocalStorageState } from '@/hooks/useLocalStorageState';
import { useTenantContext } from '@/hooks/useTenantContext';
import { logger } from '@/lib/logger';

export function SetupCompletionWidget() {
  const { tenantId } = useTenantContext();
  const { data: checklist, isLoading, isError } = useSetupChecklist();

  // Persist dismissal per tenant in localStorage
  const [dismissed, setDismissed] = useLocalStorageState<boolean>(
    `setup-widget-dismissed-${tenantId ?? 'unknown'}`,
    false,
  );

  // Allow re-expanding after collapse within session
  const [collapsed, setCollapsed] = useState(false);

  if (dismissed) return null;
  if (isError) return null;

  if (isLoading || !checklist) {
    return <SetupCompletionSkeleton />;
  }

  const { items, completedCount, totalCount, percentage, allComplete } = checklist;

  const handleDismiss = () => {
    logger.info('[SetupCompletionWidget] Dismissed', { tenantId, percentage });
    setDismissed(true);
  };

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-background">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
        <div className="flex items-center gap-2">
          <Rocket className="h-5 w-5 text-primary" />
          <CardTitle className="text-base font-semibold">
            Get started with FloraIQ
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
            {items.map((item) => (
              <li key={item.id}>
                <Link
                  to={item.href}
                  className="flex items-center gap-3 rounded-md px-2 py-2 text-sm transition-colors hover:bg-muted/50 group"
                >
                  {item.completed ? (
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Check className="h-3 w-3" />
                    </span>
                  ) : (
                    <Circle className="h-5 w-5 shrink-0 text-muted-foreground/50" />
                  )}
                  <span className="flex-1">
                    <span
                      className={
                        item.completed
                          ? 'line-through text-muted-foreground'
                          : 'text-foreground'
                      }
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
                    <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  )}
                </Link>
              </li>
            ))}
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

function SetupCompletionSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <Skeleton className="h-5 w-48" />
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
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-2 py-2">
              <Skeleton className="h-5 w-5 rounded-full" />
              <Skeleton className="h-4 flex-1" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
