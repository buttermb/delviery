/**
 * Feature Protected Route Component
 * Wraps routes to enforce subscription tier access and/or tenant feature toggles.
 *
 * - featureId: checks subscription-tier gating (old system)
 * - feature:   checks tenant self-service feature toggles (new system)
 * When both are provided, both gates must pass.
 */

import { ReactNode } from 'react';
import { Link } from 'react-router-dom';

import { ShieldOff, Settings } from 'lucide-react';

import { type FeatureId } from '@/lib/featureConfig';
import { type FeatureToggleKey } from '@/lib/featureFlags';
import { FeatureGate } from '@/components/tenant-admin/FeatureGate';
import { useTenantFeatureToggles } from '@/hooks/useTenantFeatureToggles';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { Button } from '@/components/ui/button';

interface FeatureProtectedRouteProps {
  featureId?: FeatureId;
  feature?: FeatureToggleKey;
  children: ReactNode;
}

function TenantToggleGate({ feature, children }: { feature: FeatureToggleKey; children: ReactNode }) {
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
            <Link to={`/${tenantSlug}/admin/settings-hub?tab=features`}>
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

export function FeatureProtectedRoute({ featureId, feature, children }: FeatureProtectedRouteProps) {
  // Wrap with tenant toggle gate if feature prop is provided
  let content: ReactNode = children;
  if (feature) {
    content = <TenantToggleGate feature={feature}>{content}</TenantToggleGate>;
  }

  // Wrap with subscription tier gate if featureId prop is provided
  if (featureId) {
    return <FeatureGate featureId={featureId}>{content}</FeatureGate>;
  }

  return <>{content}</>;
}
