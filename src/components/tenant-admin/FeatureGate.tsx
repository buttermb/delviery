/**
 * Feature Gate Component
 * Wraps features to check subscription tier access
 */

import { ReactNode } from 'react';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { UpgradeModal } from './UpgradeModal';
import { type FeatureId } from '@/lib/featureConfig';
import { useState } from 'react';

interface FeatureGateProps {
  featureId: FeatureId;
  children: ReactNode;
  fallback?: ReactNode;
}

export function FeatureGate({ featureId, children, fallback }: FeatureGateProps) {
  const { canAccess, currentTier, tenant } = useFeatureAccess();
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  
  const hasAccess = canAccess(featureId);
  
  // Debug logging
  console.log('FeatureGate:', {
    featureId,
    hasAccess,
    currentTier,
    subscriptionPlan: tenant?.subscription_plan,
  });
  
  if (hasAccess) {
    return <>{children}</>;
  }
  
  if (fallback) {
    return <>{fallback}</>;
  }
  
  return (
    <>
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="max-w-md w-full text-center space-y-4">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
            <span className="text-3xl">🔒</span>
          </div>
          <h2 className="text-2xl font-bold">Feature Locked</h2>
          <p className="text-muted-foreground">
            This feature is not included in your current plan.
          </p>
          <button
            onClick={() => setShowUpgradeModal(true)}
            className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
          >
            Upgrade to Unlock
          </button>
        </div>
      </div>
      
      <UpgradeModal
        open={showUpgradeModal}
        onOpenChange={setShowUpgradeModal}
        featureId={featureId}
      />
    </>
  );
}
