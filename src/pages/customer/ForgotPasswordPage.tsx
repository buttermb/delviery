import { logger } from '@/lib/logger';
/**
 * Customer Forgot Password Page
 * Allows customers to request a password reset link
 * Implements client-side rate limiting to prevent abuse.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, Mail, ArrowLeft, Clock } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { apiFetch } from '@/lib/utils/apiClient';
import { useCsrfToken } from '@/hooks/useCsrfToken';
import { AuthErrorAlert, getAuthErrorMessage } from '@/components/auth/AuthErrorAlert';

const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 3;
const COOLDOWN_MS = 30_000; // 30 second cooldown after hitting limit

function ResendButton({ onResend }: { onResend: () => void }) {
  const [cooldown, setCooldown] = useState(60);

  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  return (
    <Button
      onClick={onResend}
      variant="outline"
      className="w-full min-h-[44px]"
      disabled={cooldown > 0}
    >
      {cooldown > 0 ? `Resend available in ${cooldown}s` : "Send Another Link"}
    </Button>
  );
}

export function CustomerForgotPasswordPage() {
  const navigate = useNavigate();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const [formError, setFormError] = useState<string | null>(null);

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [tenant, setTenant] = useState<{ id: string; slug: string; name: string } | null>(null);
  const [tenantLoading, setTenantLoading] = useState(true);
  const [rateLimited, setRateLimited] = useState(false);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const { validateToken } = useCsrfToken();

  const requestTimestamps = useRef<number[]>([]);
  const cooldownTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (cooldownTimer.current) {
        clearInterval(cooldownTimer.current);
      }
    };
  }, []);

  const startCooldown = useCallback(() => {
    setRateLimited(true);
    setCooldownRemaining(Math.ceil(COOLDOWN_MS / 1000));

    if (cooldownTimer.current) {
      clearInterval(cooldownTimer.current);
    }

    cooldownTimer.current = setInterval(() => {
      setCooldownRemaining((prev) => {
        if (prev <= 1) {
          setRateLimited(false);
          if (cooldownTimer.current) {
            clearInterval(cooldownTimer.current);
            cooldownTimer.current = null;
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const isRateLimited = useCallback((): boolean => {
    const now = Date.now();
    // Remove timestamps outside the window
    requestTimestamps.current = requestTimestamps.current.filter(
      (ts) => now - ts < RATE_LIMIT_WINDOW_MS
    );

    if (requestTimestamps.current.length >= MAX_REQUESTS_PER_WINDOW) {
      logger.debug("Password reset rate limit reached");
      startCooldown();
      return true;
    }

    return false;
  }, [startCooldown]);

  useEffect(() => {
    const fetchTenant = async () => {
      if (tenantSlug) {
        const { data, error } = await supabase
          .from('tenants')
          .select('*')
          .eq('slug', tenantSlug)
          .maybeSingle();

        if (data && !error) {
          // Cast to match expected tenant shape
          setTenant({ id: data.id, slug: data.slug, name: data.business_name || data.slug });
        }
        setTenantLoading(false);
      } else {
        setTenantLoading(false);
      }
    };

    fetchTenant();
  }, [tenantSlug]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!validateToken()) {
      setFormError('Invalid security token. Please refresh the page and try again.');
      return;
    }

    if (!email) {
      setFormError('Please enter your email address.');
      return;
    }

    if (isRateLimited()) {
      return;
    }

    // Track this request for rate limiting
    requestTimestamps.current.push(Date.now());

    setLoading(true);

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await apiFetch(`${supabaseUrl}/functions/v1/request-password-reset`, {
        method: 'POST',
        body: JSON.stringify({
          email,
          tenant_slug: tenantSlug,
        }),
        skipAuth: true,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to send reset link');
      }

      setSent(true);
      toast({
        title: 'Reset Link Sent',
        description: 'If an account exists with this email, a password reset link has been sent.',
      });
    } catch (error: unknown) {
      logger.error('Request password reset error', error, { component: 'CustomerForgotPasswordPage' });
      const errorMessage = getAuthErrorMessage(error, 'Failed to send reset link. Please try again later.');
      setFormError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (tenantLoading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-[hsl(var(--customer-bg))]">
        <Loader2 className="h-8 w-8 animate-spin text-[hsl(var(--customer-primary))]" />
      </div>
    );
  }

  if (sent) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-[hsl(var(--customer-bg))] p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <div className="mx-auto w-16 h-16 bg-[hsl(var(--customer-primary))]/10 rounded-full flex items-center justify-center">
                <Mail className="h-10 w-10 text-[hsl(var(--customer-primary))]" />
              </div>
              <h2 className="text-2xl font-bold">Check Your Email</h2>
              <p className="text-muted-foreground">
                If an account exists with <strong>{email}</strong>, we've sent a password reset link.
                Please check your inbox <strong>and spam folder</strong> and click the link to reset your password.
              </p>
              <p className="text-sm text-muted-foreground">
                The link will expire in 24 hours.
              </p>
              <div className="pt-4 space-y-2">
                <ResendButton onResend={() => setSent(false)} />
                <Link
                  to={`/${tenantSlug}/customer/login`}
                  className="block text-center text-sm text-muted-foreground hover:text-foreground"
                >
                  Back to Login
                </Link>
              </div>
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
          <CardTitle className="text-2xl text-center">Forgot Password?</CardTitle>
          <CardDescription className="text-center">
            Enter your email address and we'll send you a link to reset your password.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <AuthErrorAlert
              message={formError || ''}
              type="error"
              variant="light"
              className="mb-2"
            />

            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                disabled={loading || rateLimited}
                className="min-h-[44px]"
              />
            </div>

            {rateLimited && (
              <div className="flex items-center gap-2 text-sm text-destructive" role="alert">
                <Clock className="h-4 w-4" aria-hidden="true" />
                <span>Try again in {cooldownRemaining} seconds</span>
              </div>
            )}

            <Button
              type="submit"
              className="w-full min-h-[44px]"
              disabled={loading || !email || rateLimited}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : rateLimited ? (
                <>
                  <Clock className="mr-2 h-4 w-4" aria-hidden="true" />
                  Try again in {cooldownRemaining}s
                </>
              ) : (
                'Send Reset Link'
              )}
            </Button>

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

// Default export for lazy loading compatibility
export default CustomerForgotPasswordPage;

