/**
 * Tenant Admin Email Verification Page
 * Allows tenant admins to verify their email address
 */

import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CheckCircle2, Mail, RefreshCcw, ArrowLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';

export default function VerifyEmailPage() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const navigate = useNavigate();
  const { admin } = useTenantAdminAuth();
  const [resending, setResending] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  // Check current verification status
  const { data: verificationStatus, isLoading, refetch } = useQuery({
    queryKey: queryKeys.emailVerification.byAdmin(admin?.id),
    queryFn: async () => {
      if (!admin?.id) return null;
      
      const { data, error } = await supabase
        .from('tenant_users')
        .select('email_verified, email')
        .eq('id', admin.id)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!admin?.id,
    refetchInterval: 10000, // Check every 10 seconds
    retry: 2,
  });

  const handleResendVerification = async () => {
    if (!admin?.email || !tenantSlug) return;

    setResending(true);
    try {
      // Check if user is authenticated
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        throw new Error('Not authenticated. Please log in again.');
      }

      logger.info('[VERIFY_EMAIL] Invoking resend-admin-verification for:', admin.email);

      const { data, error } = await supabase.functions.invoke('resend-admin-verification', {
        body: { email: admin.email, tenant_slug: tenantSlug },
      });

      logger.info('[VERIFY_EMAIL] Response:', { data, error });

      if (error) {
        logger.error('[VERIFY_EMAIL] Edge function error:', error);
        throw new Error(`Failed to call edge function: ${error.message}`);
      }

      if (data?.error) {
        logger.error('[VERIFY_EMAIL] API error:', data.error);
        throw new Error(data.error);
      }

      toast.success('Verification email sent! Please check your inbox.');
      setLastError(null); // Clear any previous errors
    } catch (error) {
      logger.error('[VERIFY_EMAIL] Resend failed:', error);
      const message = error instanceof Error ? error.message : 'Failed to resend verification email. Please try again.';
      setLastError(message);
      toast.error(message);
    } finally {
      setResending(false);
    }
  };

  const handleContinue = () => {
    navigate(`/${tenantSlug}/admin/dashboard`);
  };

  if (verificationStatus?.email_verified) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-4">
              <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <CardTitle>Email Verified!</CardTitle>
            <CardDescription>
              Your email address has been successfully verified.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleContinue} className="w-full">
              Continue to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-dvh flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <Mail className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>Verify Your Email</CardTitle>
          <CardDescription>
            We've sent a verification link to <strong>{admin?.email}</strong>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {lastError ? (
            <Alert variant="destructive">
              <AlertTitle>Error Sending Email</AlertTitle>
              <AlertDescription className="space-y-2">
                <p className="text-sm">{lastError}</p>
                <p className="text-xs mt-2">
                  If this issue persists, please contact support or check the{' '}
                  <a
                    href="/floraiq/scripts/verify-email-troubleshooting.md"
                    target="_blank"
                    className="underline"
                  >
                    troubleshooting guide
                  </a>
                  .
                </p>
              </AlertDescription>
            </Alert>
          ) : (
            <Alert>
              <Mail className="h-4 w-4" />
              <AlertTitle>Check your inbox</AlertTitle>
              <AlertDescription>
                Click the verification link in the email we sent you. If you don't see it, check your spam folder.
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-3">
            <Button
              variant="outline"
              onClick={handleResendVerification}
              disabled={resending}
              className="w-full"
            >
              {resending ? (
                <>
                  <RefreshCcw className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <RefreshCcw className="mr-2 h-4 w-4" />
                  Resend Verification Email
                </>
              )}
            </Button>

            <Button
              variant="ghost"
              onClick={() => refetch()}
              disabled={isLoading}
              className="w-full"
            >
              {isLoading ? 'Checking...' : 'I\'ve verified my email'}
            </Button>

            <Button
              variant="link"
              onClick={() => navigate(`/${tenantSlug}/admin/dashboard`)}
              className="w-full"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Skip for now
            </Button>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            Email verification helps secure your account and enables important features.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
