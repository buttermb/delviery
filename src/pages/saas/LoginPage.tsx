import { logger } from '@/lib/logger';

/**
 * SAAS Login Page
 * Professional Layout
 * Split-screen layout (40% form / 60% branding)
 */

import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { clientEncryption } from '@/lib/encryption/clientEncryption';
import { STORAGE_KEYS } from '@/constants/storageKeys';
import { safeStorage } from '@/utils/safeStorage';
import { resilientFetch, ErrorCategory, onConnectionStatusChange, type ConnectionStatus, isOffline } from '@/lib/utils/networkResilience';
import { authFlowLogger, AuthFlowStep, AuthAction } from '@/lib/utils/authFlowLogger';
import { intendedDestinationUtils } from '@/hooks/useIntendedDestination';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ArrowRight, CheckCircle2, WifiOff, Eye, EyeOff, Wand2, Leaf, Star, ShieldCheck } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RateLimitWarning } from '@/components/auth/RateLimitWarning';
import { AuthErrorAlert, getAuthErrorType, getAuthErrorMessage } from '@/components/auth/AuthErrorAlert';
import { useAuthRateLimit } from '@/hooks/useAuthRateLimit';
import { ThemeToggle } from '@/components/ThemeToggle';
import { ForceLightMode } from '@/components/marketing/ForceLightMode';
import { motion, AnimatePresence } from 'framer-motion';
import FloraIQLogo from '@/components/FloraIQLogo';
import { useCsrfToken } from '@/hooks/useCsrfToken';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  rememberMe: z.boolean().default(false),
});

type LoginFormData = z.infer<typeof loginSchema>;

export function LoginPage() {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [_isSendingMagicLink, setIsSendingMagicLink] = useState(false);
  const [_magicLinkSent, _setMagicLinkSent] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('unknown');
  const [_retryCount, setRetryCount] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [searchParams] = useSearchParams();
  const signupSuccess = searchParams.get('signup') === 'success';
  const { isLocked, remainingSeconds, recordAttempt, resetOnSuccess } = useAuthRateLimit({
    storageKey: 'floraiq_saas_login_rate_limit',
  });
  const { validateToken } = useCsrfToken();

  // Forgot password state
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');
  const [isSendingReset, setIsSendingReset] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Session-aware redirect: if already authenticated, redirect to admin dashboard
  useEffect(() => {
    const isExpired = searchParams.get('expired') === '1';
    if (isExpired) return; // Let them re-login if session expired

    // Check localStorage first for quick redirect
    const storedToken = safeStorage.getItem(STORAGE_KEYS.TENANT_ADMIN_ACCESS_TOKEN);
    const storedTenant = safeStorage.getItem(STORAGE_KEYS.TENANT_DATA);
    if (storedToken && storedTenant) {
      try {
        const tenantData = JSON.parse(storedTenant);
        if (tenantData?.slug) {
          logger.debug('[LoginPage] Found stored session, redirecting to admin dashboard');
          navigate(`/${tenantData.slug}/admin/dashboard`, { replace: true });
          return;
        }
      } catch {
        // Invalid stored data, continue to login
      }
    }

    // Check Supabase session
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) return;

        const { data: tenantUser } = await supabase
          .from('tenant_users')
          .select('tenant_id')
          .eq('user_id', session.user.id)
          .eq('status', 'active')
          .maybeSingle();

        if (!tenantUser) return;

        const { data: tenant } = await supabase
          .from('tenants')
          .select('slug')
          .eq('id', tenantUser.tenant_id)
          .maybeSingle();

        if (tenant?.slug) {
          logger.debug('[LoginPage] Active session found, redirecting to admin dashboard');
          navigate(`/${tenant.slug}/admin/dashboard`, { replace: true });
        }
      } catch (err) {
        logger.debug('[LoginPage] Session check failed', err);
      }
    };

    checkSession();
  }, [navigate, searchParams]);

  // Monitor connection status
  useEffect(() => {
    const unsubscribe = onConnectionStatusChange((status) => {
      setConnectionStatus(status);
      if (status === 'offline') {
        toast.error('Please check your connection and try again.');
      }
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (signupSuccess) {
      toast.success('Account created successfully! Please sign in with your new credentials.');
    }
  }, [signupSuccess]);

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
      rememberMe: false,
    },
  });

  const handleForgotPassword = async () => {
    if (!forgotPasswordEmail || !forgotPasswordEmail.includes('@')) {
      toast.error('Please enter a valid email address.');
      return;
    }

    setIsSendingReset(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(forgotPasswordEmail.toLowerCase().trim(), {
        redirectTo: `${window.location.origin}/saas/reset-password`,
      });

      if (error) throw error;

      setResetEmailSent(true);
      toast.success('Check your inbox for password reset instructions.');
    } catch (error: unknown) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      logger.error('Password reset error', errorObj);
      toast.error(errorObj.message || 'Failed to send reset email. Please try again.');
    } finally {
      setIsSendingReset(false);
    }
  };

  const onSubmit = async (data: LoginFormData) => {
    setLoginError(null);

    if (!validateToken()) {
      setLoginError('Invalid security token. Please refresh the page and try again.');
      return;
    }

    if (isLocked) {
      return;
    }

    if (isOffline()) {
      setLoginError('No internet connection. Please check your connection and try again.');
      return;
    }

    setIsSubmitting(true);
    setRetryCount(0);
    data.email = data.email.toLowerCase().trim();
    const flowId = authFlowLogger.startFlow(AuthAction.LOGIN, { email: data.email });

    // STEP 1: Clear ALL stale authentication state
    // This prevents conflicts between old and new sessions and fixes 401 errors

    // Clear localStorage tokens - both specific keys and pattern-based
    safeStorage.removeItem('lastTenantSlug');
    safeStorage.removeItem(STORAGE_KEYS.TENANT_ADMIN_USER);
    safeStorage.removeItem(STORAGE_KEYS.TENANT_DATA);
    safeStorage.removeItem(STORAGE_KEYS.TENANT_ADMIN_ACCESS_TOKEN);
    safeStorage.removeItem(STORAGE_KEYS.TENANT_ADMIN_REFRESH_TOKEN);

    // Clear any other auth-related keys (pattern-based cleanup) - REMOVED to prevent Supabase session loss
    // We only clear tenant-specific data above to ensure clean state for the new tenant


    // Clear sessionStorage auth data
    sessionStorage.removeItem('floraiq_user_id');

    // Clear stale cookies - REMOVED to prevent session loss
    // The previous aggressive cleanup was causing 401s on redirect


    // Small delay to ensure cleanup is complete before login attempt
    await new Promise(resolve => setTimeout(resolve, 50));

    try {
      authFlowLogger.logStep(flowId, AuthFlowStep.VALIDATE_INPUT);

      // 1. Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });

      if (authError || !authData.user) {
        throw new Error(authError?.message || 'Failed to login');
      }

      // 2. Get Tenant
      const { data: tenantUser, error: tenantUserError } = await supabase
        .from('tenant_users')
        .select('tenant_id')
        .eq('user_id', authData.user.id)
        .eq('status', 'active')
        .maybeSingle();

      if (tenantUserError || !tenantUser) throw new Error('No tenant found for this account');

      const { data: tenant, error: tenantError } = await supabase
        .from('tenants')
        .select('slug')
        .eq('id', tenantUser.tenant_id)
        .maybeSingle();

      if (tenantError || !tenant) throw new Error('Invalid tenant configuration');

      // 3. Tenant Auth Edge Function
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://aejugtmhwwknrowfyzie.supabase.co';
      const url = `${supabaseUrl}/functions/v1/tenant-admin-auth?action=login`;

      const { response } = await resilientFetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: data.email,
          password: data.password,
          tenantSlug: tenant.slug.toLowerCase(),
          rememberMe: data.rememberMe,
        }),
        timeout: 30000,
        retryConfig: { maxRetries: 3, initialDelay: 1000 },
        onRetry: (attempt) => {
          setRetryCount(attempt);
          toast.info(`Retrying... Attempt ${attempt} of 3`);
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Login failed');
      }

      const authResponse = await response.json();

      // 4. Store Data
      safeStorage.setItem(STORAGE_KEYS.TENANT_ADMIN_ACCESS_TOKEN, authResponse.access_token);
      safeStorage.setItem(STORAGE_KEYS.TENANT_ADMIN_REFRESH_TOKEN, authResponse.refresh_token);
      safeStorage.setItem(STORAGE_KEYS.TENANT_ADMIN_USER, JSON.stringify(authResponse.admin));
      safeStorage.setItem(STORAGE_KEYS.TENANT_DATA, JSON.stringify(authResponse.tenant));
      safeStorage.setItem('lastTenantSlug', tenant.slug);

      if (authData.user?.id) {
        sessionStorage.setItem('floraiq_user_id', authData.user.id);
        safeStorage.setItem('floraiq_user_id', authData.user.id);
        // Best effort encryption init
        clientEncryption.initialize(data.password, authData.user.id).catch(err => logger.error('Encryption init failed', err));
      }

      authFlowLogger.completeFlow(flowId, { tenantId: authResponse.tenant?.id });
      resetOnSuccess();

      toast.success(`Welcome back! Redirecting to ${authResponse.tenant.business_name}...`);

      // Check for intended destination (user tried to access a protected page before login)
      const intendedDestination = intendedDestinationUtils.consume();
      const defaultDashboard = `/${tenant.slug}/admin/dashboard`;
      const redirectTo = intendedDestination || defaultDashboard;
      logger.debug('[SaasLogin] Redirecting after successful login', { intendedDestination, redirectTo });

      // Smooth redirect delay
      setTimeout(() => {
        navigate(redirectTo, { replace: true });
      }, 500);

    } catch (error: unknown) {
      recordAttempt();
      logger.error('Login error', error);
      authFlowLogger.failFlow(flowId, error, ErrorCategory.AUTH);
      const errorMessage = getAuthErrorMessage(error, 'Invalid email or password. Please try again.');
      setLoginError(errorMessage);
      form.setValue('password', '');
    } finally {
      setIsSubmitting(false);
      setRetryCount(0);
    }
  };

  return (
    <ForceLightMode>
      <div className="min-h-dvh flex w-full bg-saas-bg">

        {/* LEFT SIDE - FORM */}
        <div className="w-full lg:w-[40%] flex flex-col relative z-10 bg-white/50 lg:bg-saas-bg backdrop-blur-sm lg:backdrop-blur-none transition-all duration-500">

          {/* Header */}
          <div className="p-6 md:p-8 flex items-center justify-between">
            <div
              className="cursor-pointer"
              onClick={() => navigate('/')}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate('/'); } }}
            >
              <FloraIQLogo size="md" />
            </div>
            <ThemeToggle className="hover:bg-saas-primary/10 text-saas-primary" />
          </div>

          {/* Form Content */}
          <div className="flex-1 flex flex-col justify-center px-6 md:px-12 lg:px-16 max-w-lg mx-auto w-full">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <h1 className="text-4xl md:text-5xl font-medium text-saas-primary mb-3">Welcome back</h1>
              <p className="text-saas-text/80 text-lg mb-8 font-light">
                Please enter your details to sign in.
              </p>

              {/* Status Alerts */}
              <AnimatePresence>
                {connectionStatus === 'offline' && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mb-4">
                    <Alert className="border-red-200 bg-red-50 text-red-900">
                      <WifiOff className="h-4 w-4" />
                      <AlertDescription>No internet connection.</AlertDescription>
                    </Alert>
                  </motion.div>
                )}
                {signupSuccess && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mb-6">
                    <Alert className="border-emerald-200 bg-emerald-50 text-emerald-900">
                      <CheckCircle2 className="h-4 w-4" />
                      <AlertDescription>Account created successfully!</AlertDescription>
                    </Alert>
                  </motion.div>
                )}
              </AnimatePresence>

              <RateLimitWarning remainingSeconds={remainingSeconds} variant="light" className="mb-4" />

              {/* Login Error Alert */}
              <AuthErrorAlert
                message={loginError ?? ''}
                type={loginError ? getAuthErrorType(loginError) : 'error'}
                variant="light"
                className="mb-4"
              />

              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem className="space-y-1">
                        <FormLabel className="text-saas-text font-medium text-sm ml-1">Email Address</FormLabel>
                        <FormControl>
                          <div className="relative group">
                            <Input
                              {...field}
                              type="email"
                              className="h-12 bg-white border-slate-200 focus-visible:border-saas-primary focus-visible:ring-1 focus-visible:ring-saas-primary/20 rounded-xl pl-4 transition-all duration-200 shadow-sm group-hover:shadow-md"
                              placeholder="you@company.com"
                              autoComplete="email"
                            />
                            <div className="absolute inset-0 rounded-xl ring-1 ring-inset ring-black/5 pointer-events-none" />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem className="space-y-1">
                        <FormLabel className="text-saas-text font-medium text-sm ml-1">Password</FormLabel>
                        <FormControl>
                          <div className="relative group">
                            <Input
                              {...field}
                              type={showPassword ? "text" : "password"}
                              className="h-12 bg-white border-slate-200 focus-visible:border-saas-primary focus-visible:ring-1 focus-visible:ring-saas-primary/20 rounded-xl pl-4 pr-10 transition-all duration-200 shadow-sm group-hover:shadow-md"
                              placeholder="••••••••"
                              autoComplete="current-password"
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute right-3 top-3.5 text-slate-400 hover:text-saas-primary transition-colors"
                            >
                              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                            </button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex items-center justify-between pt-1">
                    <FormField
                      control={form.control}
                      name="rememberMe"
                      render={({ field }) => (
                        <FormItem className="flex items-center space-x-2 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              disabled={isSubmitting}
                              id="remember-me"
                            />
                          </FormControl>
                          <FormLabel
                            htmlFor="remember-me"
                            className="text-sm font-normal text-foreground/80 hover:text-primary cursor-pointer transition-colors"
                            title="Stay signed in for 30 days instead of 7 days"
                          >
                            Remember me
                          </FormLabel>
                        </FormItem>
                      )}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setShowForgotPassword(true);
                        setResetEmailSent(false);
                        setForgotPasswordEmail(form.getValues('email') ?? '');
                      }}
                      className="text-sm font-medium text-primary hover:underline"
                    >
                      Forgot password?
                    </button>
                  </div>

                  <Button
                    type="submit"
                    className="w-full h-12 text-base font-medium bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200 mt-2"
                    disabled={isSubmitting || isLocked}
                  >
                    {isSubmitting ? (
                      <span className="flex items-center gap-2">
                        <div className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                        Signing in...
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">Sign In <ArrowRight className="h-4 w-4" /></span>
                    )}
                  </Button>
                </form>
              </Form>

              {/* Social Login / Magic Link separator */}
              <div className="relative my-8">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-slate-200" />
                </div>
                <div className="relative flex justify-center text-xs uppercase tracking-widest">
                  <span className="bg-background px-3 text-muted-foreground">Or continue with</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Button variant="outline" className="h-11 bg-card border-slate-200 text-foreground hover:bg-accent rounded-xl shadow-sm hover:shadow">
                  <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                  </svg>
                  Google
                </Button>
                <Button
                  variant="outline"
                  className="h-11 bg-card border-slate-200 text-foreground hover:bg-accent rounded-xl shadow-sm hover:shadow"
                  onClick={() => setIsSendingMagicLink(true)} // Example hook for now
                >
                  <Wand2 className="h-4 w-4 mr-2 text-primary" />
                  Magic Link
                </Button>
              </div>

              <p className="mt-8 text-center text-muted-foreground text-sm">
                Don't have an account?{' '}
                <a href="/signup" className="text-primary font-semibold hover:underline decoration-2 underline-offset-2">
                  Sign up for free
                </a>
              </p>
            </motion.div>
          </div>

          {/* Footer */}
          <div className="p-6 text-center text-xs text-slate-400">
            &copy; 2025 FloraIQ. Secure & Encrypted.
          </div>
        </div>

        {/* RIGHT SIDE - BRANDING (Using Site Colors) */}
        <div className="hidden lg:flex w-[60%] bg-primary relative overflow-hidden items-center justify-center p-12">
          {/* Background Image / Gradient */}
          <div className="absolute inset-0 z-0">
            {/* Abstract Floral Patterns (CSS) */}
            <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1628126235206-5260b9ea6441?q=80&w=2574&auto=format&fit=crop')] bg-cover bg-center opacity-40 mix-blend-overlay filter blur-[1px]"></div>
            <div className="absolute inset-0 bg-gradient-to-br from-primary/90 to-primary-dark/95"></div>

            {/* Animated Orbs */}
            <motion.div
              animate={{ y: [0, -20, 0], opacity: [0.3, 0.5, 0.3] }}
              transition={{ duration: 8, repeat: Infinity }}
              className="absolute top-1/4 left-1/4 w-96 h-96 bg-accent/20 rounded-full blur-[100px]"
            />
            <motion.div
              animate={{ y: [0, 30, 0], opacity: [0.2, 0.4, 0.2] }}
              transition={{ duration: 10, repeat: Infinity, delay: 1 }}
              className="absolute bottom-1/3 right-1/4 w-[500px] h-[500px] bg-secondary/10 rounded-full blur-[120px]"
            />
          </div>

          {/* Content Overlay */}
          <div className="relative z-10 max-w-xl">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2, duration: 0.6 }}
              className="glass-card bg-white/10 backdrop-blur-xl border border-white/10 rounded-3xl p-10 text-white shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-6 opacity-20">
                <Leaf className="w-24 h-24 rotate-12" />
              </div>

              <div className="flex gap-1 mb-6 text-accent">
                {[...Array(5)].map((_, i) => <Star key={i} className="w-5 h-5 fill-current" />)}
              </div>

              <blockquote className="text-2xl leading-relaxed mb-8 font-light">
                "FloraIQ transformed our wholesale operations. We've saved 20+ hours a week on inventory management alone."
              </blockquote>

              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-accent/50 to-accent flex items-center justify-center text-primary-foreground font-bold text-lg">
                  EM
                </div>
                <div>
                  <div className="font-bold text-lg">Elena Martinez</div>
                  <div className="text-white/80 text-sm">Operations Director, GreenLeaf Distro</div>
                </div>
              </div>

              {/* Trust Badge */}
              <div className="mt-8 pt-6 border-t border-white/10 flex items-center justify-between text-sm text-white/70">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-accent" />
                  <span>SOC2 Compliant Security</span>
                </div>
                <div>Trusted by 500+ Distributors</div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Forgot Password Dialog */}
      <Dialog open={showForgotPassword} onOpenChange={setShowForgotPassword}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">Reset Password</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {resetEmailSent
                ? "We've sent a password reset link to your email."
                : "Enter your email address and we'll send you a link to reset your password."
              }
            </DialogDescription>
          </DialogHeader>

          {resetEmailSent ? (
            <div className="flex flex-col items-center gap-4 py-4">
              <CheckCircle2 className="h-12 w-12 text-primary" />
              <p className="text-center text-sm text-muted-foreground">
                Check your inbox at <strong>{forgotPasswordEmail}</strong> for the reset link.
              </p>
              <Button
                onClick={() => setShowForgotPassword(false)}
                className="w-full"
              >
                Back to Login
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="space-y-2">
                <label htmlFor="reset-email" className="text-sm font-medium">
                  Email Address
                </label>
                <Input
                  id="reset-email"
                  type="email"
                  placeholder="you@company.com"
                  value={forgotPasswordEmail}
                  onChange={(e) => setForgotPasswordEmail(e.target.value)}
                  className="h-11"
                  autoComplete="email"
                />
              </div>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setShowForgotPassword(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleForgotPassword}
                  disabled={isSendingReset}
                  className="flex-1"
                >
                  {isSendingReset ? (
                    <span className="flex items-center gap-2">
                      <div className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                      Sending...
                    </span>
                  ) : (
                    'Send Reset Link'
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </ForceLightMode>
  );
}

