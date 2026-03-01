import { logger } from '@/lib/logger';
/**
 * Customer Email Verification Page
 * Allows customers to verify their email with a 6-digit code
 */

import { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, Mail, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/utils/apiClient';

export default function CustomerVerifyEmailPage() {
  const navigate = useNavigate();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const [searchParams] = useSearchParams();
  const codeFromUrl = searchParams.get('code');
  const emailFromUrl = searchParams.get('email');

  const [code, setCode] = useState(codeFromUrl ?? '');
  const [email, setEmail] = useState(emailFromUrl ?? '');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [verified, setVerified] = useState(false);
  const [tenant, setTenant] = useState<{ id: string; business_name: string; slug: string } | null>(null);
  const [tenantLoading, setTenantLoading] = useState(true);

  useEffect(() => {
    const fetchTenant = async () => {
      if (tenantSlug) {
        const { data, error } = await supabase
          .from('tenants')
          .select('id, slug, business_name')
          .eq('slug', tenantSlug)
          .maybeSingle();

        if (error) {
          logger.error('Failed to fetch tenant', error, { component: 'CustomerVerifyEmailPage', tenantSlug });
        } else if (data) {
          setTenant(data);
        }
        setTenantLoading(false);
      } else {
        setTenantLoading(false);
      }
    };

    fetchTenant();
  }, [tenantSlug]);

  const handleVerify = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!code || code.length !== 6) {
      toast.error('Invalid Code', {
        description: 'Please enter the 6-digit verification code',
      });
      return;
    }

    if (!email) {
      toast.error('Email Required', {
        description: 'Please enter your email address',
      });
      return;
    }

    setLoading(true);

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await apiFetch(`${supabaseUrl}/functions/v1/verify-email-code`, {
        method: 'POST',
        body: JSON.stringify({
          code,
          email,
          tenant_slug: tenantSlug,
        }),
        skipAuth: true,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Verification failed');
      }

      const result = await response.json();

      if (result.already_verified) {
        toast.success('Already Verified', {
          description: 'Your email is already verified. You can log in now.',
        });
        navigate(`/${tenantSlug}/customer/login`);
        return;
      }

      setVerified(true);
      toast.success('Email Verified!', {
        description: 'Your email has been verified successfully. Logging you in...',
      });

      // Auto-login after verification
      try {
        // Get customer user to find tenant
        const { data: customerUser } = await supabase
          .from('customer_users')
          .select('tenant_id')
          .eq('email', email.toLowerCase())
          .maybeSingle();

        if (customerUser && tenantSlug) {
          // Get tenant slug for navigation
          const { data: tenantData } = await supabase
            .from('tenants')
            .select('slug')
            .eq('id', customerUser.tenant_id)
            .maybeSingle();

          if (tenantData) {
            // Redirect to login page with auto-login hint
            // The login page can check for verified=true and prompt for password
            navigate(`/${tenantSlug}/customer/login?verified=true&email=${encodeURIComponent(email)}`);
            return;
          }
        }

        // Fallback: redirect to login
        setTimeout(() => {
          navigate(`/${tenantSlug}/customer/login?verified=true`);
        }, 2000);
      } catch (error) {
        logger.error('Auto-login after verification error', error, { component: 'CustomerVerifyEmailPage' });
        // Fallback: redirect to login
        setTimeout(() => {
          navigate(`/${tenantSlug}/customer/login?verified=true`);
        }, 2000);
      }
    } catch (error: unknown) {
      logger.error('Email verification error', error, { component: 'CustomerVerifyEmailPage' });
      toast.error('Verification Failed', {
        description: error instanceof Error ? error.message : 'Invalid verification code. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!email) {
      toast.error('Email Required', {
        description: 'Please enter your email address to resend the code',
      });
      return;
    }

    setResending(true);

    try {
      // Get customer user ID
      const { data: customerUser } = await supabase
        .from('customer_users')
        .select('id, tenant_id')
        .eq('email', email.toLowerCase())
        .maybeSingle();

      if (!customerUser) {
        toast.error('Account Not Found', {
          description: 'No account found with this email address.',
        });
        return;
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await apiFetch(`${supabaseUrl}/functions/v1/send-verification-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customer_user_id: customerUser.id,
          tenant_id: customerUser.tenant_id,
          email: email.toLowerCase(),
          tenant_name: tenant?.business_name,
        }),
        skipAuth: true,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to resend code');
      }

      toast.success('Code Resent', {
        description: 'A new verification code has been sent to your email.',
      });
    } catch (error: unknown) {
      logger.error('Resend verification code error', error, { component: 'CustomerVerifyEmailPage' });
      toast.error('Failed to Resend', {
        description: error instanceof Error ? error.message : 'Please try again later.',
      });
    } finally {
      setResending(false);
    }
  };

  if (tenantLoading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-[hsl(var(--customer-bg))]">
        <Loader2 className="h-8 w-8 animate-spin text-[hsl(var(--customer-primary))]" />
      </div>
    );
  }

  if (verified) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-[hsl(var(--customer-bg))] p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle2 className="h-10 w-10 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold">Email Verified!</h2>
              <p className="text-muted-foreground">
                Your email has been verified successfully. Redirecting to login...
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-dvh flex items-center justify-center bg-[hsl(var(--customer-bg))] p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center mb-4">
            <div className="w-16 h-16 bg-[hsl(var(--customer-primary))]/10 rounded-full flex items-center justify-center">
              <Mail className="h-8 w-8 text-[hsl(var(--customer-primary))]" />
            </div>
          </div>
          <CardTitle className="text-2xl text-center">Verify Your Email</CardTitle>
          <CardDescription className="text-center">
            We sent a 6-digit verification code to your email address. Please enter it below.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleVerify} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={!!emailFromUrl}
                className="min-h-[44px]"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="code">Verification Code</Label>
              <Input
                id="code"
                type="text"
                placeholder="000000"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                maxLength={6}
                required
                className="text-center text-2xl tracking-widest font-mono min-h-[44px]"
                autoFocus
              />
              <p className="text-xs text-muted-foreground text-center">
                Enter the 6-digit code sent to your email
              </p>

            </div>

            <Button
              type="submit"
              className="w-full min-h-[44px]"
              disabled={loading || code.length !== 6 || !email}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                'Verify Email'
              )}
            </Button>

            <div className="text-center space-y-2">
              <button
                type="button"
                onClick={handleResend}
                disabled={resending || !email}
                className="text-sm text-[hsl(var(--customer-primary))] hover:underline disabled:opacity-50"
              >
                {resending ? 'Sending...' : "Didn't receive a code? Resend"}
              </button>
            </div>

            <div className="pt-4 border-t">
              <Link
                to={`/${tenantSlug}/customer/login`}
                className="flex items-center justify-center text-sm text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Login
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

