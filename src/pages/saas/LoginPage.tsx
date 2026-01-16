/**
 * SAAS Login Page
 * Login for existing tenants
 */

import { logger } from '@/lib/logger';
import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { clientEncryption } from '@/lib/encryption/clientEncryption';
import { STORAGE_KEYS } from '@/constants/storageKeys';
import { safeStorage } from '@/utils/safeStorage';
import { resilientFetch, ErrorCategory, getErrorMessage, onConnectionStatusChange, type ConnectionStatus, isOffline } from '@/lib/utils/networkResilience';
import { authFlowLogger, AuthFlowStep, AuthAction } from '@/lib/utils/authFlowLogger';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ArrowRight, CheckCircle2, Sparkles, Lock, Mail, WifiOff, AlertCircle, Eye, EyeOff, ArrowLeft, Wand2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import ThemeToggle from '@/components/ThemeToggle';
import { ForceLightMode } from '@/components/marketing/ForceLightMode';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSendingMagicLink, setIsSendingMagicLink] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('unknown');
  const [retryCount, setRetryCount] = useState(0);
  const [searchParams] = useSearchParams();
  const signupSuccess = searchParams.get('signup') === 'success';

  // Monitor connection status
  useEffect(() => {
    const unsubscribe = onConnectionStatusChange((status) => {
      setConnectionStatus(status);
      if (status === 'offline') {
        toast({
          title: 'No Internet Connection',
          description: 'Please check your connection and try again.',
          variant: 'destructive',
        });
      }
    });
    return unsubscribe;
  }, [toast]);

  useEffect(() => {
    if (signupSuccess) {
      toast({
        title: 'Account created successfully!',
        description: 'Please sign in with your new credentials.',
      });
    }
  }, [signupSuccess, toast]);

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    // Check if offline
    if (isOffline()) {
      toast({
        title: 'No Internet Connection',
        description: 'Please check your connection and try again.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    setRetryCount(0);

    // Normalize email to case-insensitive
    data.email = data.email.toLowerCase().trim();

    const flowId = authFlowLogger.startFlow(AuthAction.LOGIN, { email: data.email });

    // Clear any stale tenant data before login
    safeStorage.removeItem('lastTenantSlug');
    safeStorage.removeItem(STORAGE_KEYS.TENANT_ADMIN_USER);
    safeStorage.removeItem(STORAGE_KEYS.TENANT_DATA);

    try {
      authFlowLogger.logStep(flowId, AuthFlowStep.VALIDATE_INPUT);

      // Sign in with Supabase Auth first to validate credentials
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });

      if (authError) {
        authFlowLogger.failFlow(flowId, authError, ErrorCategory.AUTH);
        throw authError;
      }
      if (!authData.user) {
        const error = new Error('Failed to login');
        authFlowLogger.failFlow(flowId, error, ErrorCategory.AUTH);
        throw error;
      }

      // Get tenant for this user
      authFlowLogger.logStep(flowId, AuthFlowStep.NETWORK_REQUEST);
      const { data: tenantUser, error: tenantUserError } = await supabase
        .from('tenant_users')
        .select('tenant_id')
        .eq('user_id', authData.user.id)
        .eq('status', 'active')
        .maybeSingle();

      if (tenantUserError || !tenantUser) {
        const error = new Error('No tenant found for this account');
        authFlowLogger.failFlow(flowId, error, ErrorCategory.AUTH);
        throw error;
      }

      // Get tenant slug
      const { data: tenant, error: tenantError } = await supabase
        .from('tenants')
        .select('slug')
        .eq('id', tenantUser.tenant_id)
        .maybeSingle();

      if (tenantError || !tenant) {
        const error = new Error('Invalid tenant configuration');
        authFlowLogger.failFlow(flowId, error, ErrorCategory.AUTH);
        throw error;
      }

      // Call tenant-admin-auth to set up complete authentication
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://aejugtmhwwknrowfyzie.supabase.co';
      const url = `${supabaseUrl}/functions/v1/tenant-admin-auth?action=login`;

      authFlowLogger.logFetchAttempt(flowId, url, 1);
      const fetchStartTime = performance.now();

      const { response, category } = await resilientFetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: data.email,
          password: data.password,
          tenantSlug: tenant.slug.toLowerCase(),
        }),
        timeout: 30000,
        retryConfig: {
          maxRetries: 3,
          initialDelay: 1000,
        },
        onRetry: (attempt, error) => {
          setRetryCount(attempt);
          const delay = 1000 * Math.pow(2, attempt - 1);
          authFlowLogger.logFetchRetry(flowId, url, attempt, error, Math.min(delay, 10000));
          toast({
            title: 'Retrying...',
            description: `Attempt ${attempt} of 3`,
            duration: 2000,
          });
        },
        onError: (errorCategory) => {
          authFlowLogger.logFetchFailure(flowId, url, new Error(getErrorMessage(errorCategory)), errorCategory, 0);
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Login failed' }));

        // Enhance error message with details if available
        let errorMessage = errorData.error || 'Login failed';
        if (errorData.details) {
          errorMessage += `: ${JSON.stringify(errorData.details)}`;
        }

        const error = new Error(errorMessage);
        authFlowLogger.failFlow(flowId, error, category);
        throw error;
      }

      authFlowLogger.logFetchSuccess(flowId, url, response.status, performance.now() - fetchStartTime);
      authFlowLogger.logStep(flowId, AuthFlowStep.PARSE_RESPONSE);

      const authResponse = await response.json();

      // Store authentication data
      safeStorage.setItem(STORAGE_KEYS.TENANT_ADMIN_ACCESS_TOKEN, authResponse.access_token);
      safeStorage.setItem(STORAGE_KEYS.TENANT_ADMIN_REFRESH_TOKEN, authResponse.refresh_token);
      safeStorage.setItem(STORAGE_KEYS.TENANT_ADMIN_USER, JSON.stringify(authResponse.admin));
      safeStorage.setItem(STORAGE_KEYS.TENANT_DATA, JSON.stringify(authResponse.tenant));
      safeStorage.setItem('lastTenantSlug', tenant.slug);

      // Store user ID for encryption
      if (authData.user?.id) {
        sessionStorage.setItem('floraiq_user_id', authData.user.id);
        safeStorage.setItem('floraiq_user_id', authData.user.id);
      }

      // Initialize encryption with user's password
      try {
        await clientEncryption.initialize(data.password, authData.user.id);
        logger.debug('Encryption initialized successfully', { component: 'LoginPage' });
      } catch (encryptionError) {
        // Log but don't block login - encryption is optional for now
        logger.warn('Encryption initialization failed', encryptionError instanceof Error ? encryptionError : new Error(String(encryptionError)), { component: 'LoginPage' });
      }

      // Clear password from memory (best effort)
      data.password = '';

      toast({
        title: 'Welcome back!',
        description: `Redirecting to ${authResponse.tenant.business_name}...`,
      });

      // Small delay to ensure localStorage is written
      await new Promise(resolve => setTimeout(resolve, 200));

      authFlowLogger.logStep(flowId, AuthFlowStep.REDIRECT);
      authFlowLogger.completeFlow(flowId, { tenantId: authResponse.tenant?.id });

      // Redirect to tenant admin dashboard using React Router (SPA navigation)
      navigate(`/${tenant.slug}/admin/dashboard`, { replace: true });
    } catch (error: unknown) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      const category = errorObj.message?.includes('Network') || errorObj.message?.includes('fetch')
        ? ErrorCategory.NETWORK
        : ErrorCategory.AUTH;

      logger.error('Login error', errorObj, { component: 'LoginPage' });
      toast({
        title: 'Login Failed',
        description: getErrorMessage(category, errorObj) || errorObj.message || 'Invalid email or password',
        variant: 'destructive',
      });

      // Clear password field to prevent autofill issues
      form.setValue('password', '');
    } finally {
      setIsSubmitting(false);
      setRetryCount(0);
    }
  };

  return (
    <ForceLightMode>
      <div className="min-h-screen bg-slate-50 dark:bg-zinc-950/50 relative overflow-hidden flex items-center justify-center p-4 sm:p-6">
        {/* Back to Home Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/')}
          className="absolute top-4 left-4 z-50 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Home
        </Button>

        {/* Theme Toggle */}
        <div className="absolute top-4 right-4 z-50">
          <ThemeToggle />
        </div>

        <Card className="w-full max-w-md p-8 sm:p-10 relative z-10 bg-white dark:bg-zinc-900 shadow-xl border-slate-200 dark:border-slate-800 animate-fade-in">
          {/* Connection Status Indicator */}
          {connectionStatus === 'offline' && (
            <Alert className="mb-4 border-destructive/50 bg-destructive/10">
              <WifiOff className="h-4 w-4" />
              <AlertDescription>
                No internet connection. Please check your network and try again.
              </AlertDescription>
            </Alert>
          )}
          {retryCount > 0 && connectionStatus === 'online' && (
            <Alert className="mb-4 border-yellow-500/50 bg-yellow-500/10">
              <AlertCircle className="h-4 w-4 text-yellow-600" />
              <AlertDescription className="text-yellow-800 dark:text-yellow-200">
                Retrying connection... (Attempt {retryCount} of 3)
              </AlertDescription>
            </Alert>
          )}
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center p-3 bg-primary/10 rounded-2xl mb-6">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold mb-3 text-slate-900 dark:text-white">
              Welcome Back
            </h1>
            <p className="text-muted-foreground">Sign in to your business dashboard</p>
          </div>

          {signupSuccess && (
            <Alert className="mb-6 border-emerald-500/50 bg-emerald-500/10">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <AlertDescription className="text-emerald-700 dark:text-emerald-300">
                Your account has been created successfully! Please sign in to continue.
              </AlertDescription>
            </Alert>
          )}

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      Email
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="you@business.com"
                        className="h-11 bg-white dark:bg-zinc-950 border-slate-200 dark:border-slate-800 focus:border-primary transition-colors"
                        autoComplete="email"
                        inputMode="email"
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck={false}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <PasswordInput form={form} />

              <Button
                type="submit"
                className="w-full h-12 text-base font-semibold bg-primary hover:bg-primary/90 shadow-sm transition-all mt-8"
                disabled={isSubmitting}
                onClick={() => {
                  // Normalize email to lowercase before submission handled by RHF if possible, 
                  // but since we are inside RHF submission we might need to rely on the submit handler transformation.
                  // However, RHF validates on change, so better to handle normalization in onSubmit.
                }}
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Signing in...
                  </span>
                ) : (
                  <>
                    Sign In <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </form>
          </Form>

          {/* Magic Link Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-slate-200 dark:border-slate-800" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white dark:bg-zinc-900 px-2 text-muted-foreground">
                Or continue with
              </span>
            </div>
          </div>

          {/* Magic Link Button */}
          <Button
            type="button"
            variant="outline"
            className="w-full h-11 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-zinc-800"
            disabled={isSendingMagicLink || !form.watch('email')}
            onClick={async () => {
              const email = form.watch('email');
              if (!email) {
                toast({ title: 'Enter your email first', variant: 'destructive' });
                return;
              }
              setIsSendingMagicLink(true);
              try {
                const { error } = await supabase.auth.signInWithOtp({
                  email,
                  options: { emailRedirectTo: window.location.origin + '/login-callback' }
                });
                if (error) throw error;
                setMagicLinkSent(true);
                toast({
                  title: 'Check your email!',
                  description: 'We sent you a login link. Click it to sign in instantly.',
                });
              } catch (error) {
                toast({ title: 'Failed to send magic link', variant: 'destructive' });
              } finally {
                setIsSendingMagicLink(false);
              }
            }}
          >
            {isSendingMagicLink ? (
              <span className="flex items-center gap-2">
                <div className="h-4 w-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                Sending...
              </span>
            ) : magicLinkSent ? (
              <span className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                Check your email
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Wand2 className="h-4 w-4" />
                Send Magic Link (no password)
              </span>
            )}
          </Button>

          <div className="mt-8 text-center text-sm space-y-3">
            <p className="text-muted-foreground">
              Don't have an account?{' '}
              <a href="/signup" className="text-primary font-semibold hover:underline transition-all story-link">
                Start free trial
              </a>
            </p>
            <p className="text-xs text-muted-foreground/70 flex items-center justify-center gap-2">
              <Lock className="h-3 w-3" />
              Secure authentication powered by FloraIQ
            </p>
          </div>
        </Card>
      </div>
    </ForceLightMode>
  );
}

// Extracted Password Input to avoid nested hooks
function PasswordInput({ form }: { form: any }) {
  const [capsLockOn, setCapsLockOn] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.getModifierState("CapsLock")) {
      setCapsLockOn(true);
    } else {
      setCapsLockOn(false);
    }
  };

  const handleKeyUp = (e: React.KeyboardEvent) => {
    if (e.getModifierState("CapsLock")) {
      setCapsLockOn(true);
    } else {
      setCapsLockOn(false);
    }
  };

  return (
    <FormField
      control={form.control}
      name="password"
      render={({ field }) => (
        <FormItem>
          <FormLabel className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-muted-foreground" />
            Password
          </FormLabel>
          <FormControl>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                className="h-11 bg-white dark:bg-zinc-950 border-slate-200 dark:border-slate-800 focus:border-primary transition-colors pr-10"
                autoComplete="current-password"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                {...field}
                onKeyDown={handleKeyDown}
                onKeyUp={handleKeyUp}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3.5 text-muted-foreground hover:text-foreground focus:outline-none"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
              {capsLockOn && (
                <div className="absolute right-10 top-3 text-amber-600 flex items-center gap-1 text-xs font-medium animate-pulse">
                  <AlertCircle className="h-3 w-3" />
                  CAPS LOCK ON
                </div>
              )}
            </div>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
