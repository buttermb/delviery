/**
 * Multi-Step Signup Page
 * Step 1: Email & Password (with strength indicator)
 * Step 2: Full Name & Phone
 * Step 3: Tenant Selection or Creation
 */

import { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { useDebounce } from '@/hooks/useDebounce';
import { PasswordStrengthIndicator } from '@/components/auth/PasswordStrengthIndicator';
import { cn } from '@/lib/utils';
import {
  Loader2,
  ArrowRight,
  ArrowLeft,
  CheckCircle,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Mail,
  User,
  Phone,
  Building2,
  Plus,
} from 'lucide-react';
import { AuthErrorAlert, getAuthErrorMessage } from '@/components/auth/AuthErrorAlert';

// Step 1: Email & Password
const step1Schema = z.object({
  email: z.string()
    .email('Please enter a valid email address')
    .max(255, 'Email must be less than 255 characters')
    .transform((val) => val.toLowerCase().trim()),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(72, 'Password must be less than 72 characters')
    .regex(/[a-z]/, 'Password must include a lowercase letter')
    .regex(/[A-Z]/, 'Password must include an uppercase letter')
    .regex(/\d/, 'Password must include a number'),
  confirmPassword: z.string()
    .min(1, 'Please confirm your password'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

// Step 2: Name & Phone
const step2Schema = z.object({
  fullName: z.string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be less than 100 characters')
    .regex(/^[a-zA-Z\s\-']+$/, 'Name can only contain letters, spaces, hyphens, and apostrophes'),
  phone: z.string()
    .regex(/^[\d\s\-()+]*$/, 'Phone number contains invalid characters')
    .max(20, 'Phone number is too long')
    .optional()
    .or(z.literal('')),
});

// Step 3: Tenant selection or creation
const step3Schema = z.object({
  tenantMode: z.enum(['create', 'join']),
  businessName: z.string().optional(),
  tenantSlug: z.string().optional(),
}).refine((data) => {
  if (data.tenantMode === 'create') {
    return data.businessName && data.businessName.length >= 2;
  }
  if (data.tenantMode === 'join') {
    return data.tenantSlug && data.tenantSlug.length >= 2;
  }
  return false;
}, {
  message: 'Please provide a business name or tenant identifier',
  path: ['businessName'],
});

type Step1Data = z.infer<typeof step1Schema>;
type Step2Data = z.infer<typeof step2Schema>;
type Step3Data = z.infer<typeof step3Schema>;

const TOTAL_STEPS = 3;

// Email validation regex - RFC 5322 compliant (simplified)
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

type EmailValidationStatus = 'idle' | 'checking' | 'valid' | 'invalid';

export function SignupPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [emailValidationStatus, setEmailValidationStatus] = useState<EmailValidationStatus>('idle');

  // Store data from completed steps
  const [step1Data, setStep1Data] = useState<Step1Data | null>(null);
  const [step2Data, setStep2Data] = useState<Step2Data | null>(null);

  // Step 1 form
  const step1Form = useForm<Step1Data>({
    resolver: zodResolver(step1Schema),
    defaultValues: {
      email: '',
      password: '',
      confirmPassword: '',
    },
    mode: 'onChange',
  });

  // Step 2 form
  const step2Form = useForm<Step2Data>({
    resolver: zodResolver(step2Schema),
    defaultValues: {
      fullName: '',
      phone: '',
    },
    mode: 'onChange',
  });

  // Step 3 form
  const step3Form = useForm<Step3Data>({
    resolver: zodResolver(step3Schema),
    defaultValues: {
      tenantMode: 'create',
      businessName: '',
      tenantSlug: '',
    },
    mode: 'onChange',
  });

  const watchedPassword = step1Form.watch('password');
  const watchedEmail = step1Form.watch('email');
  const watchedTenantMode = step3Form.watch('tenantMode');

  // Debounce email for validation (300ms delay)
  const debouncedEmail = useDebounce(watchedEmail, 300);

  // Real-time email format validation with debounce
  useEffect(() => {
    // If email is empty, reset to idle state
    if (!debouncedEmail || debouncedEmail.trim() === '') {
      setEmailValidationStatus('idle');
      return;
    }

    // Show checking state while waiting for debounce
    if (watchedEmail !== debouncedEmail) {
      setEmailValidationStatus('checking');
      return;
    }

    // Validate the debounced email
    const trimmedEmail = debouncedEmail.trim().toLowerCase();
    const isValidFormat = EMAIL_REGEX.test(trimmedEmail);

    setEmailValidationStatus(isValidFormat ? 'valid' : 'invalid');
  }, [debouncedEmail, watchedEmail]);

  // Memoized validation indicator component
  const emailValidationIndicator = useMemo(() => {
    if (emailValidationStatus === 'idle') return null;

    if (emailValidationStatus === 'checking') {
      return (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      );
    }

    if (emailValidationStatus === 'valid') {
      return (
        <CheckCircle2 className="h-4 w-4 text-green-600" />
      );
    }

    if (emailValidationStatus === 'invalid') {
      return (
        <AlertCircle className="h-4 w-4 text-red-500" />
      );
    }

    return null;
  }, [emailValidationStatus]);

  const handleStep1Submit = (data: Step1Data) => {
    setStep1Data(data);
    setCurrentStep(2);
  };

  const handleStep2Submit = (data: Step2Data) => {
    setStep2Data(data);
    setCurrentStep(3);
  };

  const handleStep3Submit = async (data: Step3Data) => {
    setSignupError(null);

    if (!step1Data || !step2Data) {
      setSignupError('Please complete all previous steps before continuing.');
      return;
    }

    setIsSubmitting(true);

    try {
      const urlSlug = data.tenantMode === 'create' && data.businessName
        ? data.businessName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '')
        : data.tenantSlug || '';

      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: step1Data.email,
        password: step1Data.password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/confirm`,
          data: {
            full_name: step2Data.fullName,
            phone: step2Data.phone || null,
            tenant_slug: urlSlug,
          },
        },
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error('Failed to create user account');

      // If creating a new tenant
      if (data.tenantMode === 'create' && data.businessName) {
        const { error: tenantError } = await (supabase as any)
          .from('tenants')
          .insert({
            business_name: data.businessName,
            slug: urlSlug,
            owner_email: step1Data.email,
            owner_name: step2Data.fullName,
            subscription_plan: 'free',
            subscription_status: 'trial',
            created_at: new Date().toISOString(),
          })
          .select()
          .maybeSingle();

        if (tenantError) {
          logger.warn('Tenant creation error (may already exist)', tenantError, { component: 'SignupPage' });
        }

        // Create tenant_users record
        const { error: tenantUserError } = await (supabase as any)
          .from('tenant_users')
          .insert({
            email: step1Data.email,
            name: step2Data.fullName,
          });

        if (tenantUserError) {
          logger.warn('Tenant user creation error', tenantUserError, { component: 'SignupPage' });
        }
      }

      toast({
        title: 'Account created!',
        description: 'Please check your email to verify your account.',
      });

      // Redirect to verify email page
      navigate('/verify-email', {
        state: {
          email: step1Data.email,
          fromSignup: true,
        },
      });
    } catch (error: unknown) {
      logger.error('Signup error', error, { component: 'SignupPage' });
      const errorMessage = getAuthErrorMessage(error, 'An error occurred during signup. Please try again.');
      setSignupError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const goBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const stepTitles = [
    'Create your account',
    'Personal information',
    'Set up your organization',
  ];

  const stepDescriptions = [
    'Enter your email and choose a secure password',
    'Tell us a bit about yourself',
    'Create a new organization or join an existing one',
  ];

  return (
    <div className="min-h-dvh flex items-center justify-center p-4 bg-gradient-to-br from-background to-muted/50">
      <div className="w-full max-w-md">
        {/* Progress Indicator */}
        <div className="mb-6">
          <div className="flex items-center justify-center gap-2 mb-3">
            {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map((step) => (
              <div key={step} className="flex items-center">
                <div
                  className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold transition-all ${
                    step < currentStep
                      ? 'bg-primary text-primary-foreground'
                      : step === currentStep
                        ? 'bg-primary text-primary-foreground ring-2 ring-primary/30 ring-offset-2'
                        : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {step < currentStep ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : (
                    step
                  )}
                </div>
                {step < TOTAL_STEPS && (
                  <div
                    className={`h-0.5 w-8 sm:w-12 mx-1 transition-colors ${
                      step < currentStep ? 'bg-primary' : 'bg-muted'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
          <p className="text-center text-xs text-muted-foreground">
            Step {currentStep} of {TOTAL_STEPS}
          </p>
        </div>

        <Card className="shadow-lg border">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-xl sm:text-2xl">
              {stepTitles[currentStep - 1]}
            </CardTitle>
            <CardDescription>
              {stepDescriptions[currentStep - 1]}
            </CardDescription>
          </CardHeader>

          <CardContent>
            {/* Error Alert */}
            <AuthErrorAlert
              message={signupError || ''}
              type="error"
              variant="light"
              className="mb-4"
            />

            {/* STEP 1: Email & Password */}
            {currentStep === 1 && (
              <Form {...step1Form}>
                <form onSubmit={step1Form.handleSubmit(handleStep1Submit)} className="space-y-4">
                  <FormField
                    control={step1Form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            <Input
                              {...field}
                              type="email"
                              placeholder="you@company.com"
                              className={cn(
                                "pl-9 pr-9 h-11",
                                emailValidationStatus === 'valid' && "border-green-500 focus-visible:ring-green-500",
                                emailValidationStatus === 'invalid' && "border-red-500 focus-visible:ring-red-500"
                              )}
                              autoComplete="email"
                              autoFocus
                              disabled={isSubmitting}
                            />
                            <div className="absolute right-3 top-3">
                              {emailValidationIndicator}
                            </div>
                          </div>
                        </FormControl>
                        {emailValidationStatus === 'valid' && (
                          <p className="text-xs text-green-600 flex items-center gap-1 mt-1">
                            <CheckCircle2 className="h-3 w-3" />
                            Valid email format
                          </p>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={step1Form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              {...field}
                              type={showPassword ? 'text' : 'password'}
                              placeholder="Create a strong password"
                              className="pr-9 h-11"
                              autoComplete="new-password"
                              disabled={isSubmitting}
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute right-3 top-3 text-muted-foreground hover:text-foreground transition-colors"
                              tabIndex={-1}
                              aria-label={showPassword ? 'Hide password' : 'Show password'}
                            >
                              {showPassword ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                        </FormControl>
                        <PasswordStrengthIndicator password={watchedPassword} className="mt-2" />
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={step1Form.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Confirm Password</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              {...field}
                              type={showConfirmPassword ? 'text' : 'password'}
                              placeholder="Confirm your password"
                              className="pr-9 h-11"
                              autoComplete="new-password"
                              disabled={isSubmitting}
                            />
                            <button
                              type="button"
                              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                              className="absolute right-3 top-3 text-muted-foreground hover:text-foreground transition-colors"
                              tabIndex={-1}
                              aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                            >
                              {showConfirmPassword ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button type="submit" className="w-full h-11 mt-2" disabled={isSubmitting}>
                    Continue
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </form>
              </Form>
            )}

            {/* STEP 2: Full Name & Phone */}
            {currentStep === 2 && (
              <Form {...step2Form}>
                <form onSubmit={step2Form.handleSubmit(handleStep2Submit)} className="space-y-4">
                  <FormField
                    control={step2Form.control}
                    name="fullName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Full Name</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            <Input
                              {...field}
                              type="text"
                              placeholder="John Smith"
                              className="pl-9 h-11"
                              autoComplete="name"
                              autoFocus
                              disabled={isSubmitting}
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={step2Form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Phone Number
                          <span className="text-muted-foreground font-normal ml-1">(optional)</span>
                        </FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            <Input
                              {...field}
                              type="tel"
                              placeholder="(555) 123-4567"
                              className="pl-9 h-11"
                              autoComplete="tel"
                              inputMode="tel"
                              disabled={isSubmitting}
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex gap-3 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={goBack}
                      disabled={isSubmitting}
                      className="flex-1 h-11"
                    >
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Back
                    </Button>
                    <Button type="submit" className="flex-[2] h-11" disabled={isSubmitting}>
                      Continue
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </form>
              </Form>
            )}

            {/* STEP 3: Tenant Selection or Creation */}
            {currentStep === 3 && (
              <Form {...step3Form}>
                <form onSubmit={step3Form.handleSubmit(handleStep3Submit)} className="space-y-4">
                  <FormField
                    control={step3Form.control}
                    name="tenantMode"
                    render={({ field }) => (
                      <FormItem>
                        <div className="grid grid-cols-2 gap-3">
                          <button
                            type="button"
                            onClick={() => field.onChange('create')}
                            disabled={isSubmitting}
                            className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                              field.value === 'create'
                                ? 'border-primary bg-primary/5'
                                : 'border-muted hover:border-primary/50'
                            }`}
                          >
                            <Plus className="h-5 w-5" />
                            <span className="text-sm font-medium">Create New</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => field.onChange('join')}
                            disabled={isSubmitting}
                            className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                              field.value === 'join'
                                ? 'border-primary bg-primary/5'
                                : 'border-muted hover:border-primary/50'
                            }`}
                          >
                            <Building2 className="h-5 w-5" />
                            <span className="text-sm font-medium">Join Existing</span>
                          </button>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {watchedTenantMode === 'create' && (
                    <FormField
                      control={step3Form.control}
                      name="businessName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Business Name</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Building2 className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                              <Input
                                {...field}
                                type="text"
                                placeholder="Your Company Name"
                                className="pl-9 h-11"
                                autoFocus
                                disabled={isSubmitting}
                              />
                            </div>
                          </FormControl>
                          {field.value && field.value.length >= 2 && (
                            <p className="text-xs text-muted-foreground">
                              Your URL: <span className="font-medium">{field.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}.floraiq.com</span>
                            </p>
                          )}
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  {watchedTenantMode === 'join' && (
                    <FormField
                      control={step3Form.control}
                      name="tenantSlug"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Organization ID</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Building2 className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                              <Input
                                {...field}
                                type="text"
                                placeholder="your-organization"
                                className="pl-9 h-11"
                                autoFocus
                                disabled={isSubmitting}
                              />
                            </div>
                          </FormControl>
                          <p className="text-xs text-muted-foreground">
                            Enter the organization identifier shared with you
                          </p>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  <div className="flex gap-3 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={goBack}
                      disabled={isSubmitting}
                      className="flex-1 h-11"
                    >
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Back
                    </Button>
                    <Button
                      type="submit"
                      disabled={isSubmitting}
                      aria-busy={isSubmitting}
                      className="flex-[2] h-11"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Creating account...
                        </>
                      ) : (
                        <>
                          Create Account
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </Form>
            )}

            {/* Login link */}
            <div className="mt-6 text-center text-sm text-muted-foreground">
              Already have an account?{' '}
              <Link
                to="/saas/login"
                className="text-primary hover:underline font-medium"
              >
                Sign in
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Terms */}
        <p className="text-xs text-center text-muted-foreground mt-4 px-4">
          By signing up, you agree to our{' '}
          <Link to="/terms" className="text-primary hover:underline">
            Terms of Service
          </Link>{' '}
          and{' '}
          <Link to="/privacy" className="text-primary hover:underline">
            Privacy Policy
          </Link>
        </p>
      </div>
    </div>
  );
}
