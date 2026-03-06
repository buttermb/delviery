import { logger } from '@/lib/logger';
/**
 * Email Verification Banner Component
 * Shows dismissible banner when email is not verified (7-day grace period)
 */

import { useState, useEffect } from 'react';
import { X, Mail, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { STORAGE_KEYS } from '@/constants/storageKeys';
import { queryKeys } from '@/lib/queryKeys';

export function EmailVerificationBanner() {
  const { admin, tenant } = useTenantAdminAuth();
  const [dismissed, setDismissed] = useState(false);

  // Check if banner was dismissed
  useEffect(() => {
    try {
      const dismissedKey = `${STORAGE_KEYS.EMAIL_VERIFICATION_BANNER_DISMISSED}_${admin?.id ?? ''}`;
      const isDismissed = localStorage.getItem(dismissedKey) === 'true';
      setDismissed(isDismissed);
    } catch (error) {
      logger.warn('Failed to check email verification banner dismissal', error);
    }
  }, [admin?.id]);

  // Fetch email verification status and expiry
  const { data: verificationData, isLoading } = useQuery({
    queryKey: queryKeys.emailVerification.byAdmin(admin?.id),
    queryFn: async () => {
      if (!admin?.id) return { verified: true, expiresAt: null }; // Assume verified if no admin

      try {
        const { data, error } = await supabase
          .from('tenant_users')
          .select('email_verified, email_verification_token_expires_at')
          .eq('id', admin.id)
          .maybeSingle();

        if (error) {
          logger.error('Failed to fetch email verification status', error);
          return { verified: true, expiresAt: null }; // Assume verified on error to avoid blocking user
        }

        return {
          verified: data?.email_verified ?? false,
          expiresAt: data?.email_verification_token_expires_at ?? null,
        };
      } catch (error) {
        logger.error('Error checking email verification', error);
        return { verified: true, expiresAt: null }; // Assume verified on error
      }
    },
    enabled: !!admin?.id && !dismissed,
    refetchInterval: 60000, // Check every minute
  });

  const emailVerified = verificationData?.verified ?? true;

  const handleDismiss = () => {
    try {
      const dismissedKey = `${STORAGE_KEYS.EMAIL_VERIFICATION_BANNER_DISMISSED}_${admin?.id ?? ''}`;
      localStorage.setItem(dismissedKey, 'true');
      setDismissed(true);
    } catch (error) {
      logger.warn('Failed to dismiss email verification banner', error);
    }
  };

  // Don't show if:
  // - Loading
  // - Email is verified
  // - Banner was dismissed
  // - No admin/tenant
  if (isLoading || emailVerified || dismissed || !admin || !tenant) {
    return null;
  }

  // Calculate days remaining from expiry date
  const daysRemaining = verificationData?.expiresAt
    ? Math.max(0, Math.ceil((new Date(verificationData.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  return (
    <Card className="bg-warning/10 border-warning/30 mb-6 animate-in slide-in-from-top-2">
      <div className="flex items-start gap-4 p-4">
        <div className="flex-shrink-0 mt-0.5">
          <Mail className="h-5 w-5 text-warning" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-1 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-warning" />
                Verify Your Email Address
              </h3>
              <p className="text-sm text-muted-foreground mb-2">
                Please verify your email address to ensure you receive important account updates.{' '}
                {daysRemaining !== null
                  ? `You have ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} to verify your email.`
                  : 'Please verify your email as soon as possible.'}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                  className="border-warning/30 text-warning hover:bg-warning/20"
                >
                  <Link to={`/${tenant.slug}/admin/verify-email`}>
                    Verify Email
                  </Link>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDismiss}
                  className="text-muted-foreground hover:text-foreground"
                >
                  Dismiss
                </Button>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleDismiss}
              className="h-6 w-6 text-muted-foreground hover:text-foreground flex-shrink-0"
              aria-label="Dismiss banner"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

