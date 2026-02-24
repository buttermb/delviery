import { ReactNode } from 'react';
import { type FeatureId, hasFeatureAccess } from '@/lib/featureConfig';

interface FeatureGateProps {
  featureId: FeatureId;
  children: ReactNode;
  fallback?: ReactNode;
}

export function FeatureGate({ featureId, children, fallback }: FeatureGateProps) {
  // Simple pass-through - actual tier checking handled elsewhere
  return <>{children}</>;
}
