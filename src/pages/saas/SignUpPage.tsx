/**
 * SAAS Sign Up Page - Simplified 1-Step Form
 * Registration for new tenants with responsive layout and enhanced UX
 */

import { logger } from '@/lib/logger';
import { useState, useEffect, useRef, Suspense } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ArrowRight, Eye, EyeOff, Building2, User, Mail, Lock, Phone, MapPin, Briefcase, Users, Loader2, ChevronDown, ChevronUp, Check, Shield, Zap, Coins, ArrowLeft } from 'lucide-react';
import { FREE_TIER_MONTHLY_CREDITS } from '@/lib/credits';
import { getPlanConfig, type PlanKey } from '@/config/planPricing';
import { signupProtection } from '@/lib/signupProtection';
import { PasswordStrengthIndicator } from '@/components/auth/PasswordStrengthIndicator';
import { SignupFeaturesShowcase } from '@/components/signup/SignupFeaturesShowcase';
import { PhoneVerificationStep } from '@/components/signup/PhoneVerificationStep';
import { TurnstileWrapper } from '@/components/signup/TurnstileWrapper';
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton';
import { cn } from '@/lib/utils';
import type { TurnstileInstance } from '@marsidev/react-turnstile';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { usePrefetchDashboard } from '@/hooks/usePrefetchDashboard';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { handleError } from '@/utils/errorHandling/handlers';
import { ForceLightMode } from '@/components/marketing/ForceLightMode';
import FloraIQLogo from '@/components/FloraIQLogo';
import { useCsrfToken } from '@/hooks/useCsrfToken';
import { STORAGE_KEYS } from '@/constants/storageKeys';



const signupSchema = z.object({
  business_name: z.string()
    .min(2, 'Business name must be at least 2 characters')
    .max(100, 'Business name must be less than 100 characters')
    .regex(/^[a-zA-Z0-9\s\-'&.]+$/, 'Business name contains invalid characters'),
  owner_name: z.string()
    .min(2, 'Your name must be at least 2 characters')
    .max(100, 'Name must be less than 100 characters')
    .regex(/^[a-zA-Z\s\-']+$/, 'Name can only contain letters, spaces, hyphens, and apostrophes'),
  email: z.string()
    .email('Please enter a valid email address (e.g., you@business.com)')
    .max(255, 'Email must be less than 255 characters')
    .toLowerCase(),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(72, 'Password must be less than 72 characters')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must include uppercase, lowercase, and a number'),
  phone: z.string()
    .regex(/^[\d\s\-()+]*$/, 'Phone number contains invalid characters')
    .max(20, 'Phone number is too long')
    .optional(),
  state: z.string().optional(),
  industry: z.string().optional(),
  company_size: z.string().optional(),
  terms_accepted: z.boolean().refine((val) => val === true, {
    message: 'You must accept the Terms of Service to continue',
  }),
});

type SignupFormData = z.infer<typeof signupSchema>;

const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
];

const INDUSTRIES = [
  { value: 'wholesale', label: 'Wholesale' },
  { value: 'retail', label: 'Retail' },
  { value: 'distribution', label: 'Distribution' },
  { value: 'other', label: 'Other' },
];

const COMPANY_SIZES = [
  { value: '1-10', label: '1-10 employees' },
  { value: '11-50', label: '11-50 employees' },
  { value: '51-200', label: '51-200 employees' },
  { value: '200+', label: '200+ employees' },
];

const SIGNUP_STORAGE_KEY = STORAGE_KEYS.SIGNUP_FORM_DATA;
const SIGNUP_EXPIRY_KEY = STORAGE_KEYS.SIGNUP_FORM_DATA_EXPIRY;
const DRAFT_EXPIRY_HOURS = 24;
const SUBMIT_COOLDOWN_MS = 3000;

export default function SignUpPage() {
  const navigate = useNavigate();
  const { handleSignupSuccess } = useTenantAdminAuth();
  const { prefetch } = usePrefetchDashboard();
  const [showOptionalFields, setShowOptionalFields] = useState(false);
  const turnstileRef = useRef<TurnstileInstance | null>(null);
  const [searchParams] = useSearchParams();
  const selectedPlan = (searchParams.get('plan') as PlanKey) || 'free';
  const planConfig = getPlanConfig(selectedPlan);

  // Phone verification state
  const [showPhoneVerification, setShowPhoneVerification] = useState(false);
  const [phoneHash, setPhoneHash] = useState<string | null>(null);
  const [pendingFormData, setPendingFormData] = useState<SignupFormData | null>(null);

  const form = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      business_name: '',
      owner_name: '',
      email: '',
      password: '',
      phone: '',
      state: '',
      industry: '',
      company_size: '',
      terms_accepted: false,
    },
    mode: 'onChange',
  });

  // Handle Clerk auth check callback
  const [lastSubmitTime, setLastSubmitTime] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [captchaToken, setCaptchaToken] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { validateToken } = useCsrfToken();



  // Use defined hooks before any return
  // Auto-save form data to localStorage with expiry
  useEffect(() => {
    const subscription = form.watch((value) => {
      try {
        const expiryTime = Date.now() + (DRAFT_EXPIRY_HOURS * 60 * 60 * 1000);
        localStorage.setItem(SIGNUP_STORAGE_KEY, JSON.stringify(value));
        localStorage.setItem(SIGNUP_EXPIRY_KEY, expiryTime.toString());
      } catch (error) {
        logger.error('Failed to save form data to localStorage', error);
      }
    });
    return () => subscription.unsubscribe();
  }, [form]);

  // Load saved form data on mount (with expiry check)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(SIGNUP_STORAGE_KEY);
      const expiry = localStorage.getItem(SIGNUP_EXPIRY_KEY);

      if (saved && expiry) {
        const expiryTime = parseInt(expiry, 10);
        const now = Date.now();

        if (now < expiryTime) {
          // Data is still valid
          const parsed = JSON.parse(saved);
          form.reset(parsed);
        }
        // Note: Expired data is cleared when form is submitted successfully
      }
    } catch (error) {
      logger.error('Failed to load form data from localStorage', error);
    }
  }, [form]);

  const onSubmit = async (data: SignupFormData) => {
    if (!validateToken()) {
      toast.error('Invalid security token. Please refresh the page and try again.');
      return;
    }

    // Client-side rate limiting
    const now = Date.now();
    if (now - lastSubmitTime < SUBMIT_COOLDOWN_MS) {
      toast.error('Please wait a moment before submitting again.');
      return;
    }
    setLastSubmitTime(now);

    setIsSubmitting(true);

    // Track analytics: signup attempt
    try {
      if (typeof window !== 'undefined' && 'analytics' in window) {
        (window as unknown as Record<string, { track?: (event: string, props: Record<string, unknown>) => void }>).analytics?.track('Signup Attempt', {
          email: data.email,
          business_name: data.business_name,
          has_phone: !!data.phone,
          has_state: !!data.state,
          industry: data.industry || 'not_specified',
        });
      }
    } catch {
      // Silently fail analytics
    }

    try {
      logger.info('[SIGNUP] Starting tenant signup', { component: 'SignUpPage' });

      // Anti-abuse: Check signup eligibility
      logger.info('[SIGNUP] Checking signup eligibility');
      const eligibility = await signupProtection.checkEligibility(data.email);

      if (!eligibility.allowed) {
        logger.warn('[SIGNUP] Signup blocked', { reason: eligibility.blockReason });
        toast.error(eligibility.blockReason || 'Please contact support if you believe this is an error.');
        setIsSubmitting(false);
        return;
      }

      // Log warnings for monitoring
      if (eligibility.warnings.length > 0) {
        logger.info('[SIGNUP] Eligibility warnings', { warnings: eligibility.warnings, riskScore: eligibility.riskScore });
      }

      // Phone verification required for high-risk signups
      if (eligibility.requiresPhoneVerification && !phoneHash) {
        logger.info('[SIGNUP] Phone verification required', { riskScore: eligibility.riskScore });
        setPendingFormData(data);
        setShowPhoneVerification(true);
        setIsSubmitting(false);
        return;
      }

      // Clear saved form data
      try {
        localStorage.removeItem(SIGNUP_STORAGE_KEY);
        localStorage.removeItem(SIGNUP_EXPIRY_KEY);
      } catch (error) {
        logger.warn('Failed to clear localStorage', error);
      }

      // CAPTCHA validation - only required if Turnstile is configured
      const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY;
      if (turnstileSiteKey && !captchaToken) {
        toast.error('Please complete the security verification.');
        setIsSubmitting(false);
        return;
      }

      // Call tenant-signup Edge Function
      const { data: result, error } = await supabase.functions.invoke('tenant-signup', {
        body: {
          email: data.email,
          password: data.password,
          business_name: data.business_name,
          owner_name: data.owner_name,
          phone: data.phone,
          state: data.state,
          industry: data.industry,
          company_size: data.company_size,
          captchaToken, // Include CAPTCHA token
        },
      });

      logger.info('[SIGNUP] Response received', {
        hasError: !!error,
        hasResult: !!result,
        resultKeys: result ? Object.keys(result) : [],
        errorMessage: error?.message
      });

      if (error) {
        logger.error('[SIGNUP] Edge function error', error);
        throw new Error(error.message || 'Failed to create account');
      }

      // Check for error in response body (some edge functions return 200 with error)
      if (result && typeof result === 'object' && 'error' in result && result.error) {
        logger.error('[SIGNUP] Error in response body', result);
        const errorMessage = typeof result.error === 'string' ? result.error : 'Failed to create account';
        throw new Error(errorMessage);
      }

      if (!result || !result.success) {
        logger.error('[SIGNUP] Validation failed', result);
        throw new Error(result?.error || 'Failed to create account. Please try again.');
      }

      const tenant = result.tenant;
      logger.info('[SIGNUP] Tenant created', {
        tenantId: tenant.id,
        slug: tenant.slug,
        hasSession: !!result.session
      });

      // Establish Supabase session if tokens were returned
      if (result.session?.access_token && result.session?.refresh_token) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: result.session.access_token,
          refresh_token: result.session.refresh_token,
        });

        if (sessionError) {
          logger.error('[SIGNUP] Failed to set Supabase session', sessionError);
          logger.error('Account created but login failed. Please try logging in manually.', null, { component: 'SignUpPage' });
        } else {
          logger.info('[SIGNUP] Supabase session established');

          // Verify session is actually active before proceeding (prevents race condition)
          let retries = 3;
          let sessionConfirmed = false;
          while (retries > 0 && !sessionConfirmed) {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
              sessionConfirmed = true;
              logger.info('[SIGNUP] Session confirmed active after verification');
            } else {
              retries--;
              logger.debug(`[SIGNUP] Session not ready yet, retrying... (${retries} left)`);
              await new Promise(resolve => setTimeout(resolve, 200));
            }
          }

          if (!sessionConfirmed) {
            logger.warn('[SIGNUP] Session not confirmed after retries, continuing anyway');
          }
        }
      }

      // Always set lastTenantSlug immediately after tenant creation
      try {
        localStorage.setItem(STORAGE_KEYS.LAST_TENANT_SLUG, tenant.slug);
        logger.info('[SIGNUP] Saved lastTenantSlug', { slug: tenant.slug });
      } catch (error) {
        logger.error('[SIGNUP] Failed to save lastTenantSlug', error);
      }

      // Update auth context (handles localStorage and state)
      if (handleSignupSuccess) {
        await handleSignupSuccess(result);
      } else {
        // Fallback: Store non-sensitive user and tenant data
        try {
          localStorage.setItem(STORAGE_KEYS.TENANT_ADMIN_USER, JSON.stringify(result.user));
          localStorage.setItem(STORAGE_KEYS.TENANT_DATA, JSON.stringify(result.tenant));
        } catch (error) {
          logger.error('Failed to store auth data in localStorage', error);
          // Continue anyway as tokens are in httpOnly cookies
        }
      }

      logger.info('[SIGNUP] Account created, cookies set automatically', {
        slug: tenant.slug,
        userId: result.user.id,
      });

      toast.success('Account Created!', {
        description: 'Setting up your dashboard...',
      });

      // Track analytics: signup success
      try {
        if (typeof window !== 'undefined' && 'analytics' in window) {
          (window as unknown as Record<string, { track?: (event: string, props: Record<string, unknown>) => void }>).analytics?.track('Signup Success', {
            tenant_id: tenant.id,
            tenant_slug: tenant.slug,
            email: data.email,
          });
        }
      } catch {
        // Silently fail analytics
      }

      // Auto-assign free tier for new signups (credit-based model)
      try {
        logger.info('[SIGNUP] Auto-assigning free tier');

        // Update tenant to free tier
        const { error: updateError } = await supabase
          .from('tenants')
          .update({
            is_free_tier: true,
            credits_enabled: true,
          })
          .eq('id', tenant.id);

        if (updateError) {
          logger.warn('[SIGNUP] Failed to set free tier status', updateError);
        }

        // Grant initial credits via RPC
        const { error: creditError } = await supabase.rpc('grant_free_credits' as never, {
          p_tenant_id: tenant.id
        } as never);

        if (creditError) {
          logger.warn('[SIGNUP] Failed to grant initial credits', creditError);
        } else {
          logger.info('[SIGNUP] Initial credits granted', { tenantId: tenant.id });
        }
      } catch (freeTierError) {
        logger.warn('[SIGNUP] Free tier assignment failed, continuing anyway', freeTierError);
      }

      // Record device fingerprint for anti-abuse tracking
      try {
        logger.info('[SIGNUP] Recording device fingerprint');
        const fpResult = await signupProtection.recordFingerprint(tenant.id);

        if (fpResult.success) {
          // Update tenant with signup protection data
          await signupProtection.updateTenantProtection(
            tenant.id,
            eligibility.riskScore,
            false, // phoneVerified - will be updated if verified
            fpResult.fingerprintId
          );
          logger.info('[SIGNUP] Fingerprint recorded', { fingerprintId: fpResult.fingerprintId });
        } else {
          logger.warn('[SIGNUP] Failed to record fingerprint', { error: fpResult.error });
        }
      } catch (fpError) {
        logger.warn('[SIGNUP] Fingerprint recording failed, continuing anyway', fpError);
      }

      // Prefetch dashboard data with visual feedback
      // Wait up to 800ms for prefetch to complete before navigating
      const prefetchPromise = prefetch(tenant.slug, tenant.id).catch((error) => {
        logger.warn('[SIGNUP] Prefetch failed, continuing anyway', error);
      });

      const timeoutPromise = new Promise(resolve => setTimeout(resolve, 800));

      await Promise.race([prefetchPromise, timeoutPromise]);

      // Navigate based on selected plan
      if (selectedPlan !== 'free') {
        // For paid plans, go to select-plan page with plan pre-selected
        navigate(`/select-plan?tenant_id=${tenant.id}&plan=${selectedPlan}`, {
          replace: true,
          state: {
            fromSignup: true,
            tenantSlug: tenant.slug,
            selectedPlan,
          },
        });
        logger.info('[SIGNUP] Navigation to plan selection', { slug: tenant.slug, plan: selectedPlan });
      } else {
        // For free tier, go directly to dashboard
        navigate(`/${tenant.slug}/admin/dashboard?welcome=true`, {
          replace: true,
          state: {
            fromSignup: true,
            tenantSlug: tenant.slug,
            isFreeTier: true,
          },
        });
        logger.info('[SIGNUP] Navigation complete - free tier', { slug: tenant.slug });
      }
    } catch (error) {
      const message = handleError(error, {
        component: 'SignUpPage',
        showToast: false,
        context: { action: 'signup_failed' }
      });

      // Track analytics: signup error
      try {
        if (typeof window !== 'undefined' && 'analytics' in window) {
          (window as unknown as Record<string, { track?: (event: string, props: Record<string, unknown>) => void }>).analytics?.track('Signup Error', {
            error_message: message,
            email: data.email,
          });
        }
      } catch {
        // Silently fail analytics
      }

      // Reset CAPTCHA on error
      if (turnstileRef.current) {
        try {
          turnstileRef.current.reset();
          setCaptchaToken('');
        } catch (captchaError) {
          logger.warn('Failed to reset CAPTCHA', captchaError);
        }
      }

      // Provide user-friendly error messages
      let errorMessage = 'Failed to create account. Please try again.';
      if (message) {
        if (message.includes('already exists')) {
          errorMessage = 'An account with this email already exists. Please sign in instead.';
        } else if (message.includes('slug')) {
          errorMessage = 'This business name is already taken. Please try a different name.';
        } else if (message.includes('network') || message.includes('fetch')) {
          errorMessage = 'Network error. Please check your connection and try again.';
        } else {
          errorMessage = message;
        }
      }

      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };



  return (
    <ForceLightMode>
      <div className="min-h-dvh flex w-full bg-background">
        {/* LEFT SIDE - FORM (45%) */}
        <div className="flex-1 flex flex-col justify-center px-4 sm:px-6 lg:flex-none lg:w-[45%] xl:w-[40%] bg-background relative z-10 overflow-y-auto">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/')}
            className="absolute top-4 left-4 z-50 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Home
          </Button>

          <div className="mx-auto w-full max-w-sm lg:max-w-md pt-20 pb-12">
            <div className="mb-10">
              <FloraIQLogo size="lg" className="mb-6" />
              <h1 className="text-3xl font-bold tracking-tight text-foreground mb-3">
                Get Started Free
              </h1>
              <p className="text-lg text-muted-foreground">
                Transform your wholesale distribution in minutes.
              </p>
              <p className="text-sm text-muted-foreground mt-4">
                Already have an account?{' '}
                <Link to="/saas/login" className="text-primary font-medium hover:underline">
                  Sign in
                </Link>
              </p>
            </div>

            {/* Form Container (No Card) */}
            <div className="space-y-6">
              {/* Phone Verification Step */}
              {showPhoneVerification ? (
                <div className="space-y-6">

                  <div>
                    <h2 className="text-2xl font-semibold mb-1">Verify Your Phone</h2>
                    <p className="text-sm text-muted-foreground">
                      For your security, please verify your phone number
                    </p>
                  </div>
                  <PhoneVerificationStep
                    required={true}
                    onVerified={(hash, _phoneNumber) => {
                      setPhoneHash(hash);
                      setShowPhoneVerification(false);
                      // Re-submit the form with verified phone
                      if (pendingFormData) {
                        logger.info('[SIGNUP] Phone verified, resubmitting form');
                        form.handleSubmit(onSubmit)();
                      }
                    }}
                    onSkip={() => {
                      // If user skips, still allow signup but log it
                      logger.warn('[SIGNUP] User skipped phone verification');
                      setShowPhoneVerification(false);
                      if (pendingFormData) {
                        form.handleSubmit(onSubmit)();
                      }
                    }}
                  />
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setShowPhoneVerification(false);
                      setPendingFormData(null);
                    }}
                    className="w-full"
                  >
                    Back to Sign Up
                  </Button>
                </div>
              ) : (
                /* Form Content */
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    {/* Dynamic Plan Summary Card */}
                    {selectedPlan !== 'free' && (
                      <div className="mb-2 p-4 rounded-lg border-2 border-primary bg-primary/5">
                        <div className="flex justify-between items-start">
                          <div>
                            <Badge className="bg-primary text-primary-foreground">{planConfig.name} Plan</Badge>
                            <p className="text-2xl font-bold mt-2">${planConfig.priceMonthly}/mo</p>
                            <p className="text-sm text-muted-foreground">{planConfig.description}</p>
                          </div>
                          <Link to="/pricing" className="text-sm text-primary hover:underline">
                            Change plan
                          </Link>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          14-day free trial • Cancel anytime
                        </p>
                      </div>
                    )}

                    <div>
                      <h2 className="text-2xl font-semibold mb-1">
                        {selectedPlan === 'free'
                          ? 'Create Your Free Account'
                          : `Start Your ${planConfig.name} Trial`}
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        {selectedPlan === 'free'
                          ? `Get ${FREE_TIER_MONTHLY_CREDITS.toLocaleString()} free credits every month • Upgrade anytime`
                          : `14-day free trial of ${planConfig.name} • No credit card required to start`}
                      </p>
                    </div>

                    {/* Google OAuth - Prominent placement */}
                    <div className="space-y-3">
                      <GoogleSignInButton
                        className="w-full h-12"
                      />



                      {/* Divider */}
                      <div className="relative flex items-center py-2">
                        <div className="flex-grow border-t border-border" />
                        <span className="flex-shrink mx-4 text-xs text-muted-foreground uppercase tracking-wide">or continue with email</span>
                        <div className="flex-grow border-t border-border" />
                      </div>
                    </div>

                    {/* Required Fields */}
                    <div className="space-y-5">
                      <FormField
                        control={form.control}
                        name="business_name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-2">
                              <Building2 className="h-4 w-4" />
                              Business Name *
                            </FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Input
                                  placeholder="Big Mike's Wholesale"
                                  {...field}
                                  className={cn(
                                    "h-12 bg-card/50 backdrop-blur-sm border-2 focus-visible:ring-4 focus-visible:ring-primary/20 transition-all pr-10",
                                    field.value && !form.formState.errors.business_name && "border-emerald-500/50"
                                  )}
                                />
                                {field.value && !form.formState.errors.business_name && (
                                  <Check className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-emerald-500" />
                                )}
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="owner_name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-2">
                              <User className="h-4 w-4" />
                              Your Name *
                            </FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Input
                                  placeholder="John Doe"
                                  {...field}
                                  className={cn(
                                    "h-12 bg-card/50 backdrop-blur-sm border-2 focus-visible:ring-4 focus-visible:ring-primary/20 transition-all pr-10",
                                    field.value && !form.formState.errors.owner_name && "border-emerald-500/50"
                                  )}
                                />
                                {field.value && !form.formState.errors.owner_name && (
                                  <Check className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-emerald-500" />
                                )}
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-2">
                              <Mail className="h-4 w-4" />
                              Email *
                            </FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Input
                                  type="email"
                                  placeholder="you@business.com"
                                  autoComplete="email"
                                  {...field}
                                  className={cn(
                                    "h-12 bg-card/50 backdrop-blur-sm border-2 focus-visible:ring-4 focus-visible:ring-primary/20 transition-all pr-10",
                                    field.value && !form.formState.errors.email && "border-emerald-500/50"
                                  )}
                                />
                                {field.value && !form.formState.errors.email && (
                                  <Check className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-emerald-500" />
                                )}
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
                          <FormItem>
                            <FormLabel className="flex items-center gap-2">
                              <Lock className="h-4 w-4" />
                              Password *
                            </FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Input
                                  type={showPassword ? "text" : "password"}
                                  placeholder="••••••••"
                                  autoComplete="new-password"
                                  {...field}
                                  className="h-12 pr-10 bg-card/50 backdrop-blur-sm border-2 focus-visible:ring-4 focus-visible:ring-primary/20 transition-all"
                                />
                                <button
                                  type="button"
                                  onClick={() => setShowPassword(!showPassword)}
                                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                  aria-label={showPassword ? "Hide password" : "Show password"}
                                >
                                  {showPassword ? (
                                    <EyeOff className="h-4 w-4" />
                                  ) : (
                                    <Eye className="h-4 w-4" />
                                  )}
                                </button>
                              </div>
                            </FormControl>
                            <PasswordStrengthIndicator password={field.value} />
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* CAPTCHA Verification - Only render if configured */}
                      {import.meta.env.VITE_TURNSTILE_SITE_KEY && (
                        <div className="flex justify-center py-2">
                          <TurnstileWrapper
                            siteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY}
                            onSuccess={(token) => setCaptchaToken(token)}
                            onError={() => {
                              setCaptchaToken('');
                              toast.error('CAPTCHA verification failed. Please try again.');
                            }}
                            onExpire={() => {
                              setCaptchaToken('');
                            }}
                            turnstileRef={turnstileRef}
                          />
                        </div>
                      )}

                      {/* Optional Fields - Collapsible */}
                      <Collapsible open={showOptionalFields} onOpenChange={setShowOptionalFields}>
                        <CollapsibleTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            className="w-full justify-between text-muted-foreground hover:text-foreground"
                          >
                            <span className="text-sm">Optional: Business Details</span>
                            {showOptionalFields ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="space-y-5 pt-2">
                          <FormField
                            control={form.control}
                            name="phone"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="flex items-center gap-2">
                                  <Phone className="h-4 w-4" />
                                  Phone
                                </FormLabel>
                                <FormControl>
                                  <Input
                                    type="tel"
                                    placeholder="555-123-4567"
                                    {...field}
                                    className="h-12 bg-card/50 backdrop-blur-sm border-2 focus-visible:ring-4 focus-visible:ring-primary/20 transition-all"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <FormField
                              control={form.control}
                              name="state"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="flex items-center gap-2">
                                    <MapPin className="h-4 w-4" />
                                    State
                                  </FormLabel>
                                  <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl>
                                      <SelectTrigger className="h-11">
                                        <SelectValue placeholder="Select state" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      {US_STATES.map((state) => (
                                        <SelectItem key={state} value={state}>
                                          {state}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name="industry"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="flex items-center gap-2">
                                    <Briefcase className="h-4 w-4" />
                                    Industry
                                  </FormLabel>
                                  <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl>
                                      <SelectTrigger className="h-11">
                                        <SelectValue placeholder="Select industry" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      {INDUSTRIES.map((industry) => (
                                        <SelectItem key={industry.value} value={industry.value}>
                                          {industry.label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>

                          <FormField
                            control={form.control}
                            name="company_size"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="flex items-center gap-2">
                                  <Users className="h-4 w-4" />
                                  Company Size
                                </FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                  <FormControl>
                                    <SelectTrigger className="h-11">
                                      <SelectValue placeholder="Select company size" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {COMPANY_SIZES.map((size) => (
                                      <SelectItem key={size.value} value={size.value}>
                                        {size.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </CollapsibleContent>
                      </Collapsible>

                      {/* Terms Acceptance */}
                      <FormField
                        control={form.control}
                        name="terms_accepted"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel className="text-sm font-normal cursor-pointer">
                                I agree to the{' '}
                                <a
                                  href="/terms"
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-primary underline hover:text-primary/80"
                                >
                                  Terms of Service
                                </a>{' '}
                                and{' '}
                                <a
                                  href="/privacy"
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-primary underline hover:text-primary/80"
                                >
                                  Privacy Policy
                                </a>
                              </FormLabel>
                              <FormMessage />
                            </div>
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Submit Button */}
                    <div className="space-y-4">
                      <Button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full h-14 text-base font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200"
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                            Creating Your Account...
                          </>
                        ) : (
                          <>
                            <Coins className="mr-2 h-5 w-5" />
                            Start Free with Credits
                            <ArrowRight className="ml-2 h-5 w-5" />
                          </>
                        )}
                      </Button>

                      {/* Trust indicators below button */}
                      <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <Shield className="h-3.5 w-3.5 text-emerald-500" />
                          <span>Bank-level security</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Zap className="h-3.5 w-3.5 text-amber-500" />
                          <span>Setup in 2 min</span>
                        </div>
                      </div>
                    </div>
                  </form>
                </Form>
              )}
            </div> {/* End Form Container */}

            {/* Features Showcase - Mobile */}
            <div className="lg:hidden mt-8 mb-8">
              <SignupFeaturesShowcase plan={selectedPlan} />
            </div>
          </div>
        </div>

        {/* RIGHT SIDE - BRANDING */}
        <div className="hidden lg:flex flex-1 relative bg-primary overflow-hidden items-center justify-center p-12">
          {/* Background Overlay */}
          <div className="absolute inset-0 z-0">
            <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1628126235206-5260b9ea6441?q=80&w=2574&auto=format&fit=crop')] bg-cover bg-center opacity-30 mix-blend-overlay filter blur-[1px]"></div>
            <div className="absolute inset-0 bg-gradient-to-br from-primary/95 to-primary-dark/95"></div>
          </div>

          {/* Branding Content */}
          <div className="relative z-10 w-full max-w-2xl flex flex-col items-center justify-center h-full">
            <div className="mb-8 text-center">
              <h2 className="text-3xl font-bold text-white mb-4">Join 500+ Distributors</h2>
              <p className="text-primary-foreground/80">Streamline your operations with our all-in-one platform.</p>
            </div>

            {/* Feature Showcase Component */}
            <div className="w-full">
              <Suspense fallback={<div className="h-96 bg-white/5 rounded-lg animate-pulse" />}>
                <SignupFeaturesShowcase plan={selectedPlan} variant="branding" />
              </Suspense>
            </div>
          </div>
        </div>
      </div>

    </ForceLightMode>
  );
}
