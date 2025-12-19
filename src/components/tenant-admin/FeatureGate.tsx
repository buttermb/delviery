/**
 * Feature Gate Component
 * Wraps features to check subscription tier access
 */

import { ReactNode, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { UpgradeModal } from './UpgradeModal';
import { Button } from '@/components/ui/button';
import { type FeatureId } from '@/lib/featureConfig';

interface FeatureGateProps {
  featureId: FeatureId;
  children: ReactNode;
  fallback?: ReactNode;
}

export function FeatureGate({ featureId, children, fallback }: FeatureGateProps) {
  const { 
    canAccess, 
    subscriptionValid,
    isTrialExpired,
    isSuspended,
    isCancelled,
    isPastDue,
    tenant 
  } = useFeatureAccess();
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const navigate = useNavigate();
  
  const hasAccess = canAccess(featureId);
  
  if (hasAccess) {
    return <>{children}</>;
  }
  
  if (fallback) {
    return <>{fallback}</>;
  }
  
  // Determine blocking reason and UI state
  let icon = '🔒';
  let title = 'Feature Locked';
  let message = 'This feature is not included in your current plan.';
  let actionText = 'Upgrade to Unlock';
  let actionHandler = () => setShowUpgradeModal(true);
  let showUpgradeOption = true; // Can show upgrade modal
  
  if (isTrialExpired) {
    icon = '⏰';
    title = 'Trial Expired';
    message = 'Your trial has ended. Subscribe to continue using this feature.';
    actionText = 'Subscribe Now';
    actionHandler = () => navigate(`/${tenant?.slug}/admin/billing`);
    showUpgradeOption = false; // Don't show upgrade modal for expired trial
  } else if (isSuspended) {
    icon = '⚠️';
    title = 'Account Suspended';
    message = 'Your account has been suspended. Please contact support or update your payment method.';
    actionText = 'Reactivate Account';
    actionHandler = () => navigate(`/${tenant?.slug}/admin/billing`);
    showUpgradeOption = false; // Don't show upgrade modal for suspended
  } else if (isCancelled) {
    icon = '❌';
    title = 'Subscription Cancelled';
    message = 'Your subscription has been cancelled. Reactivate to access this feature.';
    actionText = 'Reactivate Subscription';
    actionHandler = () => navigate(`/${tenant?.slug}/admin/billing`);
    showUpgradeOption = false; // Don't show upgrade modal for cancelled
  } else if (isPastDue) {
    icon = '💳';
    title = 'Payment Failed';
    message = 'Your payment is past due. Update your payment method to continue.';
    actionText = 'Update Payment';
    actionHandler = () => navigate(`/${tenant?.slug}/admin/billing`);
    showUpgradeOption = false; // Don't show upgrade modal for past due
  }
  
  return (
    <>
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="max-w-md w-full text-center space-y-4">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
            <span className="text-3xl">{icon}</span>
          </div>
          <h2 className="text-2xl font-bold text-foreground">{title}</h2>
          <p className="text-muted-foreground">{message}</p>
          <Button onClick={actionHandler}>
            {actionText}
          </Button>
        </div>
      </div>
      
      {showUpgradeOption && (
        <UpgradeModal
          open={showUpgradeModal}
          onOpenChange={setShowUpgradeModal}
          featureId={featureId}
        />
      )}
    </>
  );
}
