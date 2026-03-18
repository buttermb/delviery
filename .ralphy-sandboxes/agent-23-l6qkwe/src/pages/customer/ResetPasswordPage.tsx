import { logger } from '@/lib/logger';
/**
 * Customer Password Reset Page
 * Allows customers to reset their password using a reset token
 */

import { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, Lock, ArrowLeft, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/utils/apiClient';
import { PasswordStrengthIndicator } from '@/components/auth/PasswordStrengthIndicator';
import { useCsrfToken } from '@/hooks/useCsrfToken';
import { PasswordBreachWarning } from '@/components/auth/PasswordBreachWarning';
import { usePasswordBreachCheck } from '@/hooks/usePasswordBreachCheck';
import { AuthErrorAlert, getAuthErrorMessage } from '@/components/auth/AuthErrorAlert';

export default function CustomerResetPasswordPage() {
  const navigate = useNavigate();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const [searchParams] = useSearchParams();
  const tokenFromUrl = searchParams.get('token');
  const emailFromUrl = searchParams.get('email');

  const [token, _setToken] = useState(tokenFromUrl ?? '');
  const [email, setEmail] = useState(emailFromUrl ?? '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [reset, setReset] = useState(false);
  const [tenantLoading, setTenantLoading] = useState(true);
  const [resetError, setResetError] = useState<string | null>(null);
  const { validateToken } = useCsrfToken();

  // Password breach checking
  const { checking: breachChecking, result: breachResult, suggestPassword } = usePasswordBreachCheck(newPassword);

  useEffect(() => {
    const fetchTenant = async () => {
      if (tenantSlug) {
        const { data: _data, error } = await supabase
          .from('tenants')
          .select('id, slug')
          .eq('slug', tenantSlug)
          .maybeSingle();

        if (error) {
          logger.error('Failed to fetch tenant', error, { component: 'ResetPasswordPage', tenantSlug });
        }
        setTenantLoading(false);
      } else {
        setTenantLoading(false);
      }
    };

    fetchTenant();
  }, [tenantSlug]);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError(null);

    if (!validateToken()) {
      setResetError('Invalid security token. Please refresh the page and try again.');
      return;
    }

    if (!token) {
      setResetError('Password reset link is invalid or missing. Please request a new one.');
      return;
    }

    if (!email) {
      setResetError('Please enter your email address.');
      return;
    }

    if (newPassword.length < 8) {
      setResetError('Password must be at least 8 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setResetError('Passwords do not match. Please make sure both passwords are identical.');
      return;
    }

    if (breachResult?.blocked) {
      setResetError('This password has been found in data breaches. Please choose a different, more secure password.');
      return;
    }

    setLoading(true);

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await apiFetch(`${supabaseUrl}/functions/v1/reset-password`, {
        method: 'POST',
        body: JSON.stringify({
          token,
          email,
          new_password: newPassword,
          tenant_slug: tenantSlug,
        }),
        skipAuth: true,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Password reset failed');
      }

      setReset(true);
      toast.success('Password Reset Successful!', {
        description: 'Your password has been reset. Please log in with your new password.',
      });

      // Redirect to login after 3 seconds
      setTimeout(() => {
        navigate(`/${tenantSlug}/customer/login?reset=success`);
      }, 3000);
    } catch (error: unknown) {
      logger.error('Password reset error', error, { component: 'CustomerResetPasswordPage' });
      const errorMessage = getAuthErrorMessage(error, 'Invalid or expired reset link. Please request a new one.');
      setResetError(errorMessage);
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

  if (reset) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-[hsl(var(--customer-bg))] p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle2 className="h-10 w-10 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold">Password Reset!</h2>
              <p className="text-muted-foreground">
                Your password has been reset successfully. Redirecting to login...
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
              <Lock className="h-8 w-8 text-[hsl(var(--customer-primary))]" />
            </div>
          </div>
          <CardTitle className="text-2xl text-center">Reset Your Password</CardTitle>
          <CardDescription className="text-center">
            Enter your new password below. Make sure it's at least 8 characters long.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleReset} className="space-y-4">
            <AuthErrorAlert
              message={resetError ?? ''}
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
                disabled={!!emailFromUrl}
                autoComplete="email"
                className="min-h-[44px]"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  className="min-h-[44px] pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {newPassword && (
                <PasswordStrengthIndicator password={newPassword} />
              )}
              {newPassword.length >= 8 && (
                <PasswordBreachWarning
                  checking={breachChecking}
                  result={breachResult}
                  suggestPassword={suggestPassword}
                  onGeneratePassword={(pw) => {
                    setNewPassword(pw);
                    setConfirmPassword(pw);
                  }}
                />
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type={showPassword ? 'text' : 'password'}
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                className="min-h-[44px]"
              />
            </div>

            <Button
              type="submit"
              className="w-full min-h-[44px]"
              disabled={loading || newPassword.length < 8 || newPassword !== confirmPassword}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Resetting Password...
                </>
              ) : (
                'Reset Password'
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

