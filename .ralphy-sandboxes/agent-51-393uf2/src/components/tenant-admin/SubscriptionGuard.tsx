/**
 * Subscription Guard Component
 * Global guard that enforces valid subscription status across the admin panel
 */

import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SubscriptionGuardProps {
  children: React.ReactNode;
}

export function SubscriptionGuard({ children }: SubscriptionGuardProps) {
  const { 
    subscriptionValid, 
    isTrialExpired, 
    isSuspended, 
    isCancelled,
    isPastDue,
    tenant 
  } = useFeatureAccess();
  const navigate = useNavigate();
  const location = useLocation();
  
  const isBillingPage = location.pathname.includes('/billing');
  const isSettingsPage = location.pathname.includes('/settings');
  
  useEffect(() => {
    // If subscription is invalid and not on billing/settings, redirect to billing
    if (!subscriptionValid && !isBillingPage && !isSettingsPage) {
      navigate(`/${tenant?.slug}/admin/billing`, { replace: true });
    }
  }, [subscriptionValid, isBillingPage, isSettingsPage, navigate, tenant?.slug]);
  
  // Show alert banner on billing/settings pages when subscription is invalid
  if (!subscriptionValid && (isBillingPage || isSettingsPage)) {
    let alertMessage = 'Your subscription requires attention.';
    
    if (isTrialExpired) {
      alertMessage = 'Your trial has expired. Subscribe to continue using all features.';
    } else if (isSuspended) {
      alertMessage = 'Your account is suspended. Please update your payment method or contact support.';
    } else if (isCancelled) {
      alertMessage = 'Your subscription is cancelled. Reactivate to continue using the platform.';
    } else if (isPastDue) {
      alertMessage = 'Your payment is past due. Update your payment method to avoid service interruption.';
    }
    
    return (
      <>
        <Alert variant="destructive" className="mb-4 sticky top-0 z-50">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>{alertMessage}</span>
            {!isBillingPage && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => navigate(`/${tenant?.slug}/admin/billing`)}
                className="ml-4"
              >
                Go to Billing
              </Button>
            )}
          </AlertDescription>
        </Alert>
        {children}
      </>
    );
  }
  
  return <>{children}</>;
}
