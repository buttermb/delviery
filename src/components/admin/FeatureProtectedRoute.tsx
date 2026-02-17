import { type ReactNode } from 'react';
import { Link } from 'react-router-dom';

import { ShieldOff, Settings } from 'lucide-react';

import { type FeatureToggleKey } from '@/lib/featureFlags';
import { useTenantFeatureToggles } from '@/hooks/useTenantFeatureToggles';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { Button } from '@/components/ui/button';

interface FeatureProtectedRouteProps {
  feature: FeatureToggleKey;
  children: ReactNode;
}

/**
 * Route-level guard that checks tenant feature toggles.
 * If the feature is disabled, shows a message directing the user
 * to enable it in Settings > Features.
 */
export function FeatureProtectedRoute({ feature, children }: FeatureProtectedRouteProps) {
  const { isEnabled, isLoading } = useTenantFeatureToggles();
  const { tenantSlug } = useTenantAdminAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!isEnabled(feature)) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] bg-background p-6">
        <div className="max-w-md w-full text-center space-y-4">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-2">
            <ShieldOff className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="text-2xl font-bold text-foreground">Feature Disabled</h2>
          <p className="text-muted-foreground">
            This feature is currently disabled. Enable it in Settings &gt; Features to start using it.
          </p>
          <Button asChild>
            <Link to={`/${tenantSlug}/admin/settings?tab=features`}>
              <Settings className="mr-2 h-4 w-4" />
              Go to Settings
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
