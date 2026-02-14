/**
 * Feature Protected Route Component
 * Wraps routes to enforce subscription tier access
 */

import { ReactNode } from 'react';
import { FeatureGate } from './FeatureGate';
import { type FeatureId } from '@/lib/featureConfig';

interface FeatureProtectedRouteProps {
  featureId: FeatureId;
  children: ReactNode;
}

export function FeatureProtectedRoute({ featureId, children }: FeatureProtectedRouteProps) {
  return (
    <FeatureGate featureId={featureId}>
      {children}
    </FeatureGate>
  );
}
