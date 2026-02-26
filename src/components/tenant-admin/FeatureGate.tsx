import { ReactNode } from 'react';
import { type FeatureId } from '@/lib/featureConfig';

interface FeatureGateProps {
  featureId: FeatureId;
  children: ReactNode;
  fallback?: ReactNode;
}

export function FeatureGate({ featureId: _featureId, children, fallback: _fallback }: FeatureGateProps) {
  // Simple pass-through - actual tier checking handled elsewhere
  return <>{children}</>;
}
