import { logger } from '@/lib/logger';
/**
 * SAAS Login Page
 * Login for existing tenants
 */

import { useState, useEffect } from 'react';
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
import { ArrowRight, CheckCircle2, Sparkles, Lock, Mail, Wifi, WifiOff, AlertCircle, Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import ThemeToggle from '@/components/ThemeToggle';
import { useTheme } from '@/contexts/ThemeContext';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { theme } = useTheme();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('unknown');
  const [retryCount, setRetryCount] = useState(0);
  const [searchParams] = useSearchParams();
  const signupSuccess = searchParams.get('signup') === 'success';
  const tenantSlug = searchParams.get('tenant');

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

      const { response, attempts, category } = await resilientFetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: data.email,
          password: data.password,
          tenantSlug: tenant.slug,
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
        const error = new Error(errorData.error || 'Login failed');
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
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center p-4 sm:p-6">
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

      {/* Dynamic gradient background with animation */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-purple-50 to-[hsl(var(--marketing-accent))]/10 dark:from-blue-950/20 dark:via-purple-950/20 dark:to-[hsl(var(--marketing-accent))]/10 transition-colors duration-700" />

      {/* Large floating orbs with complex movement - theme aware */}
      <div
        className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full blur-3xl transition-all duration-700"
        style={{
          background: theme === 'dark'
            ? 'radial-gradient(circle, rgba(59, 130, 246, 0.25) 0%, rgba(59, 130, 246, 0) 70%)'
            : 'radial-gradient(circle, rgba(59, 130, 246, 0.4) 0%, rgba(59, 130, 246, 0) 70%)',
          opacity: theme === 'dark' ? 0.5 : 0.7,
          animation: 'float-complex 20s ease-in-out infinite'
        }}
      />
      <div
        className="absolute -bottom-40 -right-40 w-[700px] h-[700px] rounded-full blur-3xl transition-all duration-700"
        style={{
          background: theme === 'dark'
            ? 'radial-gradient(circle, rgba(168, 85, 247, 0.25) 0%, rgba(168, 85, 247, 0) 70%)'
            : 'radial-gradient(circle, rgba(168, 85, 247, 0.4) 0%, rgba(168, 85, 247, 0) 70%)',
          opacity: theme === 'dark' ? 0.5 : 0.7,
          animation: 'float-complex-reverse 25s ease-in-out infinite'
        }}
      />
      <div
        className="absolute top-1/3 left-1/2 w-[500px] h-[500px] rounded-full blur-3xl transition-all duration-700"
        style={{
          background: theme === 'dark'
            ? 'radial-gradient(circle, rgba(243, 167, 61, 0.2) 0%, rgba(243, 167, 61, 0) 70%)'
            : 'radial-gradient(circle, rgba(243, 167, 61, 0.35) 0%, rgba(243, 167, 61, 0) 70%)',
          opacity: theme === 'dark' ? 0.4 : 0.6,
          animation: 'float-diagonal-complex 30s ease-in-out infinite'
        }}
      />

      {/* Medium accent orbs - theme aware */}
      <div
        className="absolute top-20 right-1/4 w-64 h-64 rounded-full blur-3xl transition-all duration-700"
        style={{
          background: theme === 'dark'
            ? 'radial-gradient(circle, rgba(236, 72, 153, 0.25) 0%, rgba(236, 72, 153, 0) 70%)'
            : 'radial-gradient(circle, rgba(236, 72, 153, 0.4) 0%, rgba(236, 72, 153, 0) 70%)',
          opacity: theme === 'dark' ? 0.35 : 0.5,
          animation: 'float-small 12s ease-in-out infinite'
        }}
      />
      <div
        className="absolute bottom-32 left-1/4 w-56 h-56 rounded-full blur-3xl transition-all duration-700"
        style={{
          background: theme === 'dark'
            ? 'radial-gradient(circle, rgba(251, 191, 36, 0.25) 0%, rgba(251, 191, 36, 0) 70%)'
            : 'radial-gradient(circle, rgba(251, 191, 36, 0.4) 0%, rgba(251, 191, 36, 0) 70%)',
          opacity: theme === 'dark' ? 0.35 : 0.5,
          animation: 'float-small-reverse 14s ease-in-out infinite'
        }}
      />
      <div
        className="absolute top-1/2 right-1/3 w-72 h-72 rounded-full blur-3xl transition-all duration-700"
        style={{
          background: theme === 'dark'
            ? 'radial-gradient(circle, rgba(34, 211, 238, 0.2) 0%, rgba(34, 211, 238, 0) 70%)'
            : 'radial-gradient(circle, rgba(34, 211, 238, 0.35) 0%, rgba(34, 211, 238, 0) 70%)',
          opacity: theme === 'dark' ? 0.3 : 0.4,
          animation: 'float-medium 16s ease-in-out infinite'
        }}
      />

      {/* Animated gradient waves - theme aware */}
      <div className="absolute inset-0 transition-opacity duration-700" style={{ opacity: theme === 'dark' ? 0.3 : 0.5 }}>
        <div
          className="absolute inset-0 transition-all duration-700"
          style={{
            background: theme === 'dark'
              ? 'radial-gradient(ellipse at 30% 50%, rgba(59, 130, 246, 0.12) 0%, transparent 50%), radial-gradient(ellipse at 70% 50%, rgba(168, 85, 247, 0.12) 0%, transparent 50%)'
              : 'radial-gradient(ellipse at 30% 50%, rgba(59, 130, 246, 0.18) 0%, transparent 50%), radial-gradient(ellipse at 70% 50%, rgba(168, 85, 247, 0.18) 0%, transparent 50%)',
            animation: 'wave-movement 20s ease-in-out infinite'
          }}
        />
        <div
          className="absolute inset-0 transition-all duration-700"
          style={{
            background: theme === 'dark'
              ? 'radial-gradient(ellipse at 50% 30%, rgba(243, 167, 61, 0.1) 0%, transparent 50%), radial-gradient(ellipse at 50% 70%, rgba(236, 72, 153, 0.1) 0%, transparent 50%)'
              : 'radial-gradient(ellipse at 50% 30%, rgba(243, 167, 61, 0.15) 0%, transparent 50%), radial-gradient(ellipse at 50% 70%, rgba(236, 72, 153, 0.15) 0%, transparent 50%)',
            animation: 'wave-movement-reverse 25s ease-in-out infinite'
          }}
        />
      </div>

      {/* Floating sparkle particles - theme aware */}
      <div className="absolute inset-0 overflow-hidden">
        {[...Array(30)].map((_, i) => {
          const colors = theme === 'dark'
            ? ['rgba(59, 130, 246, 0.5)', 'rgba(168, 85, 247, 0.5)', 'rgba(243, 167, 61, 0.5)', 'rgba(236, 72, 153, 0.5)']
            : ['rgba(59, 130, 246, 0.7)', 'rgba(168, 85, 247, 0.7)', 'rgba(243, 167, 61, 0.7)', 'rgba(236, 72, 153, 0.7)'];

          return (
            <div
              key={`particle-${i}`}
              className="absolute rounded-full transition-all duration-700"
              style={{
                width: `${Math.random() * 6 + 2}px`,
                height: `${Math.random() * 6 + 2}px`,
                background: `radial-gradient(circle, ${colors[i % 4]} 0%, transparent 70%)`,
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animation: `sparkle-float ${Math.random() * 15 + 20}s ease-in-out infinite`,
                animationDelay: `${Math.random() * 10}s`,
                filter: 'blur(1px)'
              }}
            />
          );
        })}
      </div>

      {/* Subtle grid overlay with shimmer - theme aware */}
      <div
        className="absolute inset-0 transition-opacity duration-700"
        style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, hsl(var(--foreground)) 1px, transparent 0)',
          backgroundSize: '50px 50px',
          opacity: theme === 'dark' ? 0.04 : 0.015,
          animation: 'shimmer 10s ease-in-out infinite'
        }}
      />

      {/* 
        Safe usage: This style block contains only static CSS animations defined in the code.
        No user input is interpolated here.
      */}
      <style dangerouslySetInnerHTML={{
        __html: `
        @keyframes float-complex {
          0%, 100% { 
            transform: translate(0, 0) scale(1) rotate(0deg);
          }
          25% { 
            transform: translate(100px, -50px) scale(1.1) rotate(5deg);
          }
          50% { 
            transform: translate(50px, 100px) scale(0.9) rotate(-5deg);
          }
          75% { 
            transform: translate(-50px, 50px) scale(1.05) rotate(3deg);
          }
        }
        
        @keyframes float-complex-reverse {
          0%, 100% { 
            transform: translate(0, 0) scale(1) rotate(0deg);
          }
          25% { 
            transform: translate(-120px, 60px) scale(0.95) rotate(-5deg);
          }
          50% { 
            transform: translate(-60px, -80px) scale(1.1) rotate(5deg);
          }
          75% { 
            transform: translate(60px, -40px) scale(1.05) rotate(-3deg);
          }
        }
        
        @keyframes float-diagonal-complex {
          0%, 100% { 
            transform: translate(0, 0) scale(1) rotate(0deg);
            opacity: 0.5;
          }
          33% { 
            transform: translate(80px, -80px) scale(1.15) rotate(10deg);
            opacity: 0.7;
          }
          66% { 
            transform: translate(-70px, 70px) scale(0.85) rotate(-10deg);
            opacity: 0.4;
          }
        }
        
        @keyframes float-small {
          0%, 100% { 
            transform: translate(0, 0) rotate(0deg);
          }
          50% { 
            transform: translate(50px, -60px) rotate(180deg);
          }
        }
        
        @keyframes float-small-reverse {
          0%, 100% { 
            transform: translate(0, 0) rotate(0deg);
          }
          50% { 
            transform: translate(-60px, 50px) rotate(-180deg);
          }
        }
        
        @keyframes float-medium {
          0%, 100% { 
            transform: translate(0, 0) scale(1);
          }
          33% { 
            transform: translate(40px, 40px) scale(1.2);
          }
          66% { 
            transform: translate(-40px, -40px) scale(0.8);
          }
        }
        
        @keyframes wave-movement {
          0%, 100% {
            transform: translate(0, 0) scale(1);
          }
          50% {
            transform: translate(50px, -30px) scale(1.1);
          }
        }
        
        @keyframes wave-movement-reverse {
          0%, 100% {
            transform: translate(0, 0) scale(1);
          }
          50% {
            transform: translate(-40px, 40px) scale(1.15);
          }
        }
        
        @keyframes sparkle-float {
          0%, 100% { 
            transform: translate(0, 0) scale(0);
            opacity: 0;
          }
          10%, 90% {
            opacity: 1;
          }
          50% { 
            transform: translate(${Math.random() * 200 - 100}px, ${Math.random() * 200 - 100}px) scale(1);
          }
        }
        
        @keyframes shimmer {
          0%, 100% {
            opacity: 0.015;
          }
          50% {
            opacity: 0.03;
          }
        }
      `}} />

      <Card className="w-full max-w-md p-8 sm:p-10 relative z-10 backdrop-blur-xl bg-card/90 shadow-2xl border-2 animate-fade-in transition-colors duration-700">
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
          <div className="inline-flex items-center justify-center p-3 bg-gradient-to-br from-primary/10 to-primary/5 rounded-2xl mb-6 animate-scale-in">
            <Sparkles className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold mb-3 bg-gradient-to-r from-primary via-purple-600 to-primary bg-clip-text text-transparent animate-fade-in">
            Welcome Back
          </h1>
          <p className="text-muted-foreground animate-fade-in">Sign in to your business dashboard</p>
        </div>

        {signupSuccess && (
          <Alert className="mb-6 border-[hsl(var(--marketing-accent))] bg-[hsl(var(--marketing-accent))]/10">
            <CheckCircle2 className="h-4 w-4 text-[hsl(var(--marketing-accent))]" />
            <AlertDescription className="text-[hsl(var(--marketing-text))]">
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
                      className="h-11 bg-background/50 border-2 focus:border-primary transition-colors"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => {
                const [capsLockOn, setCapsLockOn] = useState(false);

                const handleKeyDown = (e: React.KeyboardEvent) => {
                  if (e.getModifierState("CapsLock")) {
                    setCapsLockOn(true);
                  } else {
                    setCapsLockOn(false);
                  }
                };

                const [showPassword, setShowPassword] = useState(false);

                return (
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
                          className="h-11 bg-background/50 border-2 focus:border-primary transition-colors pr-10"
                          {...field}
                          onKeyDown={handleKeyDown}
                          onKeyUp={handleKeyDown}
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
                          <div className="absolute right-10 top-3 text-yellow-600 flex items-center gap-1 text-xs font-medium animate-pulse">
                            <AlertCircle className="h-3 w-3" />
                            CAPS LOCK ON
                          </div>
                        )}
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                );
              }}
            />

            <Button
              type="submit"
              className="w-full h-12 text-base font-semibold bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg hover:shadow-xl transition-all hover-scale mt-8"
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
  );
}
