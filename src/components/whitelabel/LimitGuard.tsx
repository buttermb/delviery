/**
 * Limit Guard Component
 * Shows warning/error when limit is reached
 */

import { ReactNode } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertTriangle, TrendingUp } from 'lucide-react';
import { useTenantLimits } from '@/hooks/useTenantLimits';
import { Link } from 'react-router-dom';

interface LimitGuardProps {
  resource: 'customers' | 'menus' | 'products' | 'locations' | 'users';
  children: ReactNode;
  showWarning?: boolean; // Show warning before limit is reached
  warningThreshold?: number; // Percentage threshold for warning (default 80%)
}

export function LimitGuard({
  resource,
  children,
  showWarning = true,
  warningThreshold = 80,
}: LimitGuardProps) {
  const { canCreate, getRemaining, getCurrent, getLimit } = useTenantLimits();

  const current = getCurrent(resource);
  const limit = getLimit(resource);
  const remaining = getRemaining(resource);
  const unlimited = limit === Infinity;

  if (unlimited) {
    return <>{children}</>;
  }

  const percentage = (current / limit) * 100;
  const showLimitWarning = showWarning && percentage >= warningThreshold && canCreate(resource);
  const showLimitError = !canCreate(resource);

  return (
    <>
      {showLimitError && (
        <Alert variant="destructive" className="mb-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Limit Reached</AlertTitle>
          <AlertDescription>
            <p className="mb-2">
              You've reached your {resource} limit ({current}/{limit}).
            </p>
            <Button asChild size="sm">
              <Link to="/saas/billing">
                <TrendingUp className="h-4 w-4 mr-2" />
                Upgrade Plan
              </Link>
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {showLimitWarning && (
        <Alert className="mb-4 border-yellow-500 bg-yellow-50 dark:bg-yellow-950">
          <AlertTriangle className="h-4 w-4 text-yellow-600" />
          <AlertTitle>Approaching Limit</AlertTitle>
          <AlertDescription>
            <p className="mb-2">
              You're using {current} of {limit} {resource} ({Math.round(percentage)}%).
              {remaining} remaining.
            </p>
            <Button asChild variant="outline" size="sm">
              <Link to="/saas/billing">Upgrade Plan</Link>
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {children}
    </>
  );
}

