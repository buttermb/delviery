/**
 * Limit Guard Component
 * Shows warning/error when limit is reached
 * Enhanced with UpgradePrompt dialog and progress bars
 */

import { ReactNode, useState, useEffect } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import AlertTriangle from "lucide-react/dist/esm/icons/alert-triangle";
import { useTenantLimits } from '@/hooks/useTenantLimits';
import { UpgradePrompt } from '@/components/shared/UpgradePrompt';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';

interface LimitGuardProps {
  resource: 'customers' | 'menus' | 'products' | 'locations' | 'users';
  children: ReactNode;
  showWarning?: boolean; // Show warning before limit is reached
  warningThreshold?: number; // Percentage threshold for warning (default 80%)
  blockOnLimit?: boolean; // Block children from rendering when limit reached
  showProgress?: boolean; // Show progress bar
}

export function LimitGuard({
  resource,
  children,
  showWarning = true,
  warningThreshold = 80,
  blockOnLimit = false,
  showProgress = false,
}: LimitGuardProps) {
  const { tenant } = useTenantAdminAuth();
  const { canCreate, getRemaining, getCurrent, getLimit, loading } = useTenantLimits();
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);
  const [dialogType, setDialogType] = useState<'limit' | 'trial'>('limit');

  const current = getCurrent(resource);
  const limit = getLimit(resource);
  const remaining = getRemaining(resource);

  // Use checkLimit logic: Infinity means unlimited, 0 means no limit set (should be treated as unlimited for top-tier plans)
  // But we check limit > 0 to avoid division by zero and (0/0) display issues
  const unlimited = limit === Infinity || limit <= 0;

  // Calculate percentage safely (limit should always be > 0 here)
  const percentage = limit > 0 ? (current / limit) * 100 : 0;

  const showLimitWarning = showWarning && percentage >= warningThreshold && canCreate(resource);
  const showLimitError = !canCreate(resource);

  // Show upgrade dialog when limit is reached, close when limit is no longer reached
  // Fixed race condition: only check when data is fully loaded
  useEffect(() => {
    // Never show dialog while loading or for unlimited accounts
    if (loading || !tenant || unlimited) {
      setShowUpgradeDialog(false);
      return;
    }

    // Only check limit error after loading is complete
    if (!loading && showLimitError) {
      setShowUpgradeDialog(true);
      setDialogType('limit');
    } else {
      setShowUpgradeDialog(false);
    }
  }, [showLimitError, loading, tenant, unlimited]);

  // Don't show limits UI while loading tenant data
  if (loading || !tenant) {
    return <>{children}</>;
  }

  // If unlimited, don't show limits UI
  if (unlimited) {
    return <>{children}</>;
  }

  const getResourceLabel = () => {
    const labels: Record<string, string> = {
      customers: 'customers',
      menus: 'menus',
      products: 'products',
      locations: 'locations',
      users: 'users',
    };
    return labels[resource] || resource;
  };

  return (
    <>
      <UpgradePrompt
        open={showUpgradeDialog}
        onOpenChange={setShowUpgradeDialog}
        type={dialogType}
        resource={getResourceLabel()}
        limit={limit}
        currentUsage={current}
        tenantSlug={tenant?.slug}
        title={showLimitError ? 'Limit Reached' : 'Approaching Limit'}
        description={
          showLimitError
            ? `You've reached your ${getResourceLabel()} limit (${current}/${limit}). Upgrade to Professional for unlimited ${getResourceLabel()}.`
            : `You're at ${Math.round(percentage)}% of your ${getResourceLabel()} capacity. Consider upgrading to avoid hitting your limit.`
        }
      />

      {showLimitError && !blockOnLimit && (
        <Alert variant="destructive" className="mb-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Limit Reached</AlertTitle>
          <AlertDescription>
            <p className="mb-2">
              You've reached your {getResourceLabel()} limit ({current}/{limit}).
            </p>
          </AlertDescription>
        </Alert>
      )}

      {showLimitWarning && (
        <Alert className="mb-4 border-yellow-500 bg-yellow-50">
          <AlertTriangle className="h-4 w-4 text-yellow-600" />
          <AlertTitle>Approaching Limit</AlertTitle>
          <AlertDescription>
            <p className="mb-2">
              You're using {current} of {limit} {getResourceLabel()} ({Math.round(percentage)}%).
              {remaining} remaining.
            </p>
            {showProgress && (
              <Progress value={percentage} className="mt-2 h-2" />
            )}
          </AlertDescription>
        </Alert>
      )}

      {showProgress && !showLimitWarning && !showLimitError && (
        <div className="mb-4">
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-600">{getResourceLabel().charAt(0).toUpperCase() + getResourceLabel().slice(1)}</span>
            <span className="text-gray-600">{current} / {limit}</span>
          </div>
          <Progress value={percentage} className="h-2" />
        </div>
      )}

      {(!blockOnLimit || canCreate(resource)) && children}
    </>
  );
}

