import { logger } from '@/lib/logger';
import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuthRedirect } from "@/hooks/useAuthRedirect";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Building2, Loader2, ArrowLeft, Eye, EyeOff } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import { Link } from "react-router-dom";
import { ForgotPasswordDialog } from "@/components/auth/ForgotPasswordDialog";
import { TwoFactorVerification } from "@/components/auth/TwoFactorVerification";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { AuthOfflineIndicator } from "@/components/auth/AuthOfflineIndicator";
import { useAuthOffline } from "@/hooks/useAuthOffline";
import { AccountLockedScreen } from "@/components/auth/AccountLockedScreen";
import { AuthErrorAlert, getAuthErrorType, getAuthErrorMessage } from "@/components/auth/AuthErrorAlert";
import { Database } from "@/integrations/supabase/types";
import { useCsrfToken } from "@/hooks/useCsrfToken";
import { intendedDestinationUtils } from "@/hooks/useIntendedDestination";


type Tenant = Database['public']['Tables']['tenants']['Row'];

export default function TenantAdminLoginPage() {
  const navigate = useNavigate();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { login, mfaRequired } = useTenantAdminAuth();
  useAuthRedirect(); // Redirect if already logged in
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [tenantLoading, setTenantLoading] = useState(true);
  const [accountLocked, setAccountLocked] = useState(false);
  const [lockDurationSeconds, setLockDurationSeconds] = useState(0);
  const [loginError, setLoginError] = useState<string | null>(null);
  const { validateToken } = useCsrfToken();

  const { isOnline, hasQueuedAttempt, queueLoginAttempt } = useAuthOffline(
    async (qEmail, qPassword, qSlug) => {
      await login(qEmail, qPassword, qSlug || '');
      toast({
        title: "Welcome back!",
        description: `Logged in to ${tenant?.business_name || tenantSlug}`,
      });
      // Check for intended destination (user tried to access a protected page before login)
      const intendedDestination = intendedDestinationUtils.consume();
      const defaultDashboard = `/${tenantSlug}/admin/dashboard`;
      const redirectTo = intendedDestination || defaultDashboard;
      logger.debug('[TenantAdminLogin] Redirecting after queued login', { intendedDestination, redirectTo });
      navigate(redirectTo, { replace: true });
    }
  );


  useEffect(() => {
    const fetchTenant = async (): Promise<void> => {
      if (tenantSlug) {
        const { data, error } = await supabase
          .from("tenants")
          .select("*")
          .eq("slug", tenantSlug)
          .maybeSingle();

        if (data && !error) {
          setTenant(data);
        }
        setTenantLoading(false);
      } else {
        setTenantLoading(false);
      }
    };

    fetchTenant();
  }, [tenantSlug]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoginError(null);

    if (!validateToken()) {
      setLoginError("Invalid security token. Please refresh the page and try again.");
      return;
    }

    if (!tenantSlug) {
      setLoginError("Business information is missing. Please check the URL and try again.");
      return;
    }

    if (!isOnline) {
      queueLoginAttempt(email, password, tenantSlug);
      return;
    }

    setLoading(true);

    try {
      await login(email, password, tenantSlug, rememberMe);

      toast({
        title: "Welcome back!",
        description: `Logged in to ${tenant?.business_name || tenantSlug}`,
      });

      // Check for intended destination (user tried to access a protected page before login)
      const intendedDestination = intendedDestinationUtils.consume();
      const defaultDashboard = `/${tenantSlug}/admin/dashboard`;
      const redirectTo = intendedDestination || defaultDashboard;
      logger.debug('[TenantAdminLogin] Redirecting after successful login', { intendedDestination, redirectTo });
      navigate(redirectTo, { replace: true });
    } catch (error: unknown) {
      logger.error("Tenant admin login error", error, { component: 'TenantAdminLoginPage' });

      // Check if account is locked (429 rate limit or explicit lock)
      const authError = error as { status?: number; retryAfter?: string; message?: string };
      if (authError.status === 429 || authError.retryAfter) {
        const retrySeconds = authError.retryAfter
          ? parseInt(authError.retryAfter, 10)
          : 900; // Default 15 minutes
        setLockDurationSeconds(retrySeconds);
        setAccountLocked(true);
        setLoading(false);
        return;
      }

      const errorMessage = getAuthErrorMessage(error, "Invalid credentials");

      // Check for locked account message from server
      if (
        errorMessage.toLowerCase().includes('locked') ||
        errorMessage.toLowerCase().includes('too many') ||
        errorMessage.toLowerCase().includes('temporarily blocked')
      ) {
        setLockDurationSeconds(900); // Default 15 minutes
        setAccountLocked(true);
        setLoading(false);
        return;
      }

      setLoginError(errorMessage);
      setLoading(false);
    }
  };

  if (tenantLoading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-[hsl(var(--tenant-bg))]">
        <Loader2 className="h-8 w-8 animate-spin text-[hsl(var(--tenant-primary))]" />
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-[hsl(var(--tenant-bg))] p-4">
        <div className="w-full max-w-md bg-white rounded-xl shadow-lg border border-[hsl(var(--tenant-surface))] p-8">
          <div className="text-center mb-6">
            <Building2 className="h-12 w-12 text-[hsl(var(--tenant-text-light))] mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-[hsl(var(--tenant-text))] mb-2">Business Not Found</h1>
            <p className="text-[hsl(var(--tenant-text-light))] mb-2">
              We couldn't find a business at <strong>"{tenantSlug}"</strong>.
            </p>
            <p className="text-sm text-[hsl(var(--tenant-text-light))]">
              This may mean the URL is incorrect, or the business account has been deactivated. Please check the link you were given and try again.
            </p>
          </div>
          <div className="space-y-3">
            <Button asChild variant="outline" className="w-full">
              <Link to="/">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Go to FloraIQ Home
              </Link>
            </Button>
            <Button asChild variant="ghost" className="w-full">
              <Link to="/signup">Don't have an account? Sign up</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (mfaRequired) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-[hsl(var(--tenant-bg))] p-4">
        <div className="w-full max-w-md bg-white rounded-xl shadow-lg border border-[hsl(var(--tenant-surface))] p-8">
          <TwoFactorVerification
            onVerified={() => {
              toast({
                title: "Authentication Successful",
                description: "You have been securely logged in.",
              });
              // Redirect to intended destination or dashboard after MFA verification
              const intendedDestination = intendedDestinationUtils.consume();
              const defaultDashboard = `/${tenantSlug}/admin/dashboard`;
              const redirectTo = intendedDestination || defaultDashboard;
              logger.debug('[TenantAdminLogin] Redirecting after MFA verification', { intendedDestination, redirectTo });
              navigate(redirectTo, { replace: true });
            }}
          />
        </div>
      </div>
    );
  }

  if (accountLocked) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-[hsl(var(--tenant-bg))] p-4">
        <div className="w-full max-w-md bg-white rounded-xl shadow-lg border border-[hsl(var(--tenant-surface))] p-6 sm:p-8">
          <AccountLockedScreen
            email={email}
            tenantSlug={tenantSlug || ''}
            lockDurationSeconds={lockDurationSeconds}
            businessName={tenant.business_name || tenantSlug || ''}
            onUnlocked={() => {
              setAccountLocked(false);
              setLockDurationSeconds(0);
              toast({
                title: "Account Unlocked",
                description: "You can now try logging in again.",
              });
            }}
            onBack={() => {
              setAccountLocked(false);
              setLockDurationSeconds(0);
            }}
          />
        </div>
      </div>
    );
  }

  const businessName = tenant.business_name || tenantSlug;
  const logo = null; // White label settings not implemented yet



  return (
    <div className="min-h-dvh flex items-center justify-center bg-[hsl(var(--tenant-bg))] p-4 relative overflow-hidden">
      {/* Back to Home Button */}
      <Link
        to="/"
        className="absolute top-4 left-4 z-20 flex items-center gap-2 px-3 py-2 rounded-lg bg-card/80 backdrop-blur-sm border border-border text-muted-foreground hover:text-foreground hover:bg-card transition-all"
      >
        <ArrowLeft className="h-4 w-4" />
        <span className="text-sm font-medium">Home</span>
      </Link>

      {/* Animated Background Gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--tenant-primary))]/5 via-[hsl(var(--tenant-surface))] to-[hsl(var(--tenant-secondary))]/5" />

      {/* Floating Orbs */}
      <div className="absolute top-20 left-10 w-72 h-72 bg-[hsl(var(--tenant-primary))]/10 rounded-full blur-3xl animate-pulse-slow" />
      <div className="absolute bottom-20 right-10 w-96 h-96 bg-[hsl(var(--tenant-secondary))]/10 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: "1s" }} />

      {/* Subtle Grid Pattern */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle at 2px 2px, hsl(var(--tenant-primary)) 1px, transparent 0)`,
          backgroundSize: "48px 48px",
        }} />
      </div>

      {/* Card Container with Glow Effect */}
      <div className="relative z-10 w-full max-w-md">
        <div className="absolute inset-0 bg-gradient-to-r from-[hsl(var(--tenant-primary))]/20 to-[hsl(var(--tenant-secondary))]/20 rounded-2xl blur-xl" />
        <div className="relative bg-white rounded-2xl shadow-2xl border border-gray-100 p-4 sm:p-6 md:p-8">
          {/* Header */}
          <div className="text-center mb-6 sm:mb-8">
            <div className="flex justify-center mb-3 sm:mb-4">
              {logo ? (
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--tenant-primary))]/30 to-[hsl(var(--tenant-secondary))]/30 rounded-2xl blur-xl" />
                  <img src={logo} alt={businessName} className="relative h-12 sm:h-16 object-contain" />
                </div>
              ) : (
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--tenant-primary))] to-[hsl(var(--tenant-secondary))] rounded-full blur-lg opacity-50" />
                  <div className="relative rounded-full bg-gradient-to-br from-[hsl(var(--tenant-primary))] to-[hsl(var(--tenant-secondary))] p-3 sm:p-4 shadow-2xl">
                    <Building2 className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
                  </div>
                </div>
              )}
            </div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground mb-1 sm:mb-2 break-words">
              {businessName}
            </h1>
            <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1 sm:py-1.5 rounded-full bg-[hsl(var(--tenant-primary))]/10 border border-[hsl(var(--tenant-primary))]/20">
              <span className="text-xs sm:text-sm font-medium text-[hsl(var(--tenant-primary))]">Admin Panel</span>
            </div>
          </div>

          {/* Offline Indicator */}
          <AuthOfflineIndicator isOnline={isOnline} hasQueuedAttempt={hasQueuedAttempt} className="mb-4" />

          {/* Error Alert */}
          <AuthErrorAlert
            message={loginError || ''}
            type={loginError ? getAuthErrorType(loginError) : 'error'}
            variant="light"
            className="mb-4"
          />

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm sm:text-base font-medium">
                Email Address
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@business.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                autoComplete="email"
                inputMode="email"
                enterKeyHint="next"
                className="min-h-[44px] sm:h-12 bg-white border-gray-200 transition-all text-sm sm:text-base touch-manipulation focus:border-[hsl(var(--tenant-primary))] focus:ring-[hsl(var(--tenant-primary))]"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm sm:text-base font-medium">
                Password
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  autoComplete="current-password"
                  enterKeyHint="done"
                  className="min-h-[44px] sm:h-12 bg-white border-gray-200 transition-all text-sm sm:text-base touch-manipulation focus:border-[hsl(var(--tenant-primary))] focus:ring-[hsl(var(--tenant-primary))] pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Remember Me */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="remember-me"
                checked={rememberMe}
                onCheckedChange={(checked) => setRememberMe(checked === true)}
                disabled={loading}
              />
              <Label
                htmlFor="remember-me"
                className="text-sm font-normal text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                title="Stay signed in for 30 days instead of 7 days"
              >
                Remember me
              </Label>
            </div>

            <Button
              type="submit"
              disabled={loading || !isOnline}
              className="w-full bg-gradient-to-r from-[hsl(var(--tenant-primary))] to-[hsl(var(--tenant-secondary))] hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 text-white min-h-[44px] sm:h-12 font-semibold shadow-md touch-manipulation text-sm sm:text-base"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 sm:h-5 sm:w-5 animate-spin" />
                  <span>Signing in...</span>
                </>
              ) : (
                <span>Sign In to Dashboard</span>
              )}
            </Button>

            {/* Divider */}
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
              </div>
            </div>

            {/* Google Sign In */}
            <GoogleSignInButton
              redirectTo={`${window.location.origin}/${tenantSlug}/admin/auth/callback`}
              disabled={loading || !isOnline}
              className="bg-background/50 backdrop-blur-sm border-border hover:bg-background/80"
            />


          </form>

          {/* Links */}
          <div className="mt-4 sm:mt-6 space-y-3 text-center text-xs sm:text-sm">
            <ForgotPasswordDialog userType="tenant_admin" tenantSlug={tenantSlug} />
            <div className="pt-3 sm:pt-4 border-t border-border">
              <p className="text-muted-foreground mb-2">Not an admin?</p>
              <Link
                to={`/${tenantSlug}/shop`}
                className="inline-flex items-center gap-1 text-[hsl(var(--tenant-primary))] hover:text-[hsl(var(--tenant-secondary))] font-medium transition-colors touch-manipulation min-h-[44px]"
              >
                <span className="text-xs sm:text-sm">Go to Customer Portal →</span>
              </Link>
            </div>
            <div className="pt-3 sm:pt-4 border-t border-border">
              <p className="text-muted-foreground">
                Don&apos;t have an account?{" "}
                <Link
                  to="/signup"
                  className="text-[hsl(var(--tenant-primary))] hover:text-[hsl(var(--tenant-secondary))] font-medium transition-colors"
                >
                  Sign up
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
