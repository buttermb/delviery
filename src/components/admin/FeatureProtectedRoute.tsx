import { type ReactNode } from 'react';
import { Link } from 'react-router-dom';

import { Lock, Settings } from 'lucide-react';

import { type FeatureToggleKey } from '@/lib/featureFlags';
import { useTenantFeatureToggles } from '@/hooks/useTenantFeatureToggles';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface FeatureProtectedRouteProps {
  featureId: FeatureToggleKey;
  children: ReactNode;
}

/**
 * Route-level guard that checks tenant feature toggles.
 * If the feature is disabled, shows a card with lock icon directing
 * the user to enable it in Settings > Features.
 * Does not redirect — lets the user see where they are.
 */
export function FeatureProtectedRoute({ featureId, children }: FeatureProtectedRouteProps) {
  const { isEnabled, isLoading } = useTenantFeatureToggles();
  const { tenantSlug } = useTenantAdminAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!isEnabled(featureId)) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] p-6">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-4">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-2">
              <Lock className="h-8 w-8 text-muted-foreground" />
            </div>
            <h2 className="text-2xl font-bold text-foreground">This feature is not enabled</h2>
            <p className="text-muted-foreground">
              Enable it in Settings &rarr; Features to start using it.
            </p>
            <Button asChild>
              <Link to={`/${tenantSlug}/admin/settings?tab=features`}>
                <Settings className="mr-2 h-4 w-4" />
                Go to Settings
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
