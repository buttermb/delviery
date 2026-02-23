import { type ReactNode } from 'react';

import { type FeatureToggleKey } from '@/lib/featureFlags';
import { useTenantFeatureToggles } from '@/hooks/useTenantFeatureToggles';

interface FeatureGateProps {
  feature: FeatureToggleKey;
  children: ReactNode;
  fallback?: ReactNode;
}

export function FeatureGate({ feature, children, fallback = null }: FeatureGateProps) {
  const { isEnabled } = useTenantFeatureToggles();

  if (!isEnabled(feature)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
