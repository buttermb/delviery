/**
 * SAAS Sign Up Page - Modern Multi-Step Design
 * Registration for new tenants with responsive layout and enhanced UX
 */

import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent } from '@/components/ui/card';
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
import { useToast } from '@/hooks/use-toast';
import { ArrowRight, ArrowLeft, Eye, EyeOff, Building2, User, Mail, Lock, Phone, MapPin, Briefcase, Users, FileText, Sparkles } from 'lucide-react';
import { PasswordStrengthIndicator } from '@/components/auth/PasswordStrengthIndicator';
import { SignupStepIndicator } from '@/components/signup/SignupStepIndicator';
import { SignupFeaturesShowcase } from '@/components/signup/SignupFeaturesShowcase';
import { SignupStepContent } from '@/components/signup/SignupStepContent';
import { cn } from '@/lib/utils';

const signupSchema = z.object({
  business_name: z.string().min(2, 'Business name must be at least 2 characters'),
  owner_name: z.string().min(2, 'Your name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  phone: z.string().optional(),
  state: z.string().optional(),
  industry: z.string().optional(),
  company_size: z.string().optional(),
  terms_accepted: z.boolean().refine((val) => val === true, {
    message: 'You must accept the Terms of Service',
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

const STEPS = [
  { label: 'Account', key: 'account' },
  { label: 'Business', key: 'business' },
  { label: 'Review', key: 'review' },
];

// Step validation schemas
const step1Schema = z.object({
  business_name: z.string().min(2, 'Business name must be at least 2 characters'),
  owner_name: z.string().min(2, 'Your name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

const STORAGE_KEY = 'signup_form_data';

export default function SignUpPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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

  // Auto-save form data to localStorage
  useEffect(() => {
    const subscription = form.watch((value) => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
      } catch (error) {
        console.error('Failed to save form data:', error);
      }
    });
    return () => subscription.unsubscribe();
  }, [form]);

  // Load saved form data on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        form.reset(parsed);
      }
    } catch (error) {
      console.error('Failed to load form data:', error);
    }
  }, [form]);

  const validateStep = async (step: number): Promise<boolean> => {
    if (step === 0) {
      const step1Data = form.getValues();
      try {
        step1Schema.parse(step1Data);
        return true;
      } catch (error) {
        form.trigger(['business_name', 'owner_name', 'email', 'password']);
        return false;
      }
    }
    // Step 2 and 3 have optional fields, so they're always valid
    return true;
  };

  const handleNext = async () => {
    const isValid = await validateStep(currentStep);
    if (isValid && currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
      // Scroll to top on step change
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const onSubmit = async (data: SignupFormData) => {
    setIsSubmitting(true);
    try {
      // Clear saved form data
      localStorage.removeItem(STORAGE_KEY);

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
        },
      });

      if (error) {
        throw new Error(error.message || 'Failed to create account');
      }

      if (!result || !result.success) {
        throw new Error(result?.error || 'Failed to create account. Please try again.');
      }

      const tenant = result.tenant;

      toast({
        title: 'Account Created!',
        description: 'Your account has been created successfully. Please sign in to continue.',
      });

      // Redirect to login page with success message
      navigate(`/saas/login?signup=success&tenant=${tenant.slug}`);
    } catch (error: any) {
      console.error('Signup error:', error);
      
      // Provide user-friendly error messages
      let errorMessage = 'Failed to create account. Please try again.';
      if (error.message) {
        if (error.message.includes('already exists')) {
          errorMessage = 'An account with this email already exists. Please sign in instead.';
        } else if (error.message.includes('slug')) {
          errorMessage = 'This business name is already taken. Please try a different name.';
        } else if (error.message.includes('network') || error.message.includes('fetch')) {
          errorMessage = 'Network error. Please check your connection and try again.';
        } else {
          errorMessage = error.message;
        }
      }

      toast({
        title: 'Sign Up Failed',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFinalSubmit = async () => {
    const isValid = await form.trigger();
    if (isValid) {
      await form.handleSubmit(onSubmit)();
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden py-8 px-4 sm:px-6 lg:px-8">
      {/* Animated gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-purple-50 to-emerald-50 dark:from-blue-950/20 dark:via-purple-950/20 dark:to-emerald-950/20" />
      
      {/* Floating orbs */}
      <div className="absolute top-20 left-10 w-96 h-96 bg-blue-500/20 dark:bg-blue-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '4s' }} />
      <div className="absolute bottom-20 right-10 w-[500px] h-[500px] bg-purple-500/20 dark:bg-purple-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '6s', animationDelay: '1s' }} />
      <div className="absolute top-1/2 left-1/3 w-80 h-80 bg-emerald-500/15 dark:bg-emerald-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '5s', animationDelay: '2s' }} />
      
      {/* Grid pattern overlay */}
      <div className="absolute inset-0 opacity-[0.015] dark:opacity-[0.03]" style={{
        backgroundImage: 'radial-gradient(circle at 1px 1px, hsl(var(--foreground)) 1px, transparent 0)',
        backgroundSize: '40px 40px'
      }} />

      <div className="max-w-7xl mx-auto relative z-10">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-emerald-500/10 backdrop-blur-sm border border-primary/20 mb-4 animate-fade-in">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-primary">14-Day Free Trial • No Credit Card Required</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold mb-2 bg-gradient-to-r from-blue-600 via-purple-600 to-emerald-600 bg-clip-text text-transparent animate-fade-in" style={{ animationDelay: '0.1s' }}>
            Start Your Journey Today
          </h1>
          <p className="text-muted-foreground text-lg animate-fade-in" style={{ animationDelay: '0.2s' }}>Transform your wholesale business in minutes</p>
          <p className="text-sm text-muted-foreground mt-2 animate-fade-in" style={{ animationDelay: '0.3s' }}>
            Already have an account?{' '}
            <Link to="/saas/login" className="text-primary font-medium hover:underline">
              Sign in
            </Link>
          </p>
        </div>

        {/* Main Content - Responsive Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-6 lg:gap-8">
          {/* Left Column - Form */}
          <div className="relative animate-fade-in" style={{ animationDelay: '0.4s' }}>
            {/* Glow effect */}
            <div className="absolute -inset-1 bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-emerald-500/20 rounded-2xl blur-xl opacity-75" />
            <Card className="relative w-full shadow-2xl backdrop-blur-sm bg-card/95 border-2 border-primary/10">
            <CardContent className="p-6 sm:p-8">
              {/* Step Indicator */}
              <div className="mb-8">
                <SignupStepIndicator
                  currentStep={currentStep}
                  totalSteps={STEPS.length}
                  steps={STEPS}
                />
              </div>

              {/* Form Content */}
              <Form {...form}>
                <form onSubmit={(e) => e.preventDefault()} className="space-y-6">
                  {/* Step 1: Account Basics */}
                  <SignupStepContent step={0} currentStep={currentStep}>
                    <div className="space-y-5">
                      <div>
                        <h2 className="text-2xl font-semibold mb-1">Account Information</h2>
                        <p className="text-sm text-muted-foreground">
                          Create your account to get started
                        </p>
                      </div>

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
                              <Input
                                placeholder="Big Mike's Wholesale"
                                {...field}
                                className="h-12 bg-card/50 backdrop-blur-sm border-2 focus:ring-4 focus:ring-primary/20 transition-all"
                              />
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
                              <Input placeholder="John Doe" {...field} className="h-12 bg-card/50 backdrop-blur-sm border-2 focus:ring-4 focus:ring-primary/20 transition-all" />
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
                              <Input
                                type="email"
                                placeholder="you@business.com"
                                {...field}
                                className="h-12 bg-card/50 backdrop-blur-sm border-2 focus:ring-4 focus:ring-primary/20 transition-all"
                              />
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
                                  {...field}
                                  className="h-12 pr-10 bg-card/50 backdrop-blur-sm border-2 focus:ring-4 focus:ring-primary/20 transition-all"
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
                    </div>
                  </SignupStepContent>

                  {/* Step 2: Business Details */}
                  <SignupStepContent step={1} currentStep={currentStep}>
                    <div className="space-y-5">
                      <div>
                        <h2 className="text-2xl font-semibold mb-1">Business Details</h2>
                        <p className="text-sm text-muted-foreground">
                          Help us personalize your experience (all optional)
                        </p>
                      </div>

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
                                placeholder="555-123-4567"
                                {...field}
                                className="h-12 bg-card/50 backdrop-blur-sm border-2 focus:ring-4 focus:ring-primary/20 transition-all"
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
                    </div>
                  </SignupStepContent>

                  {/* Step 3: Review & Terms */}
                  <SignupStepContent step={2} currentStep={currentStep}>
                    <div className="space-y-5">
                      <div>
                        <h2 className="text-2xl font-semibold mb-1">Review & Terms</h2>
                        <p className="text-sm text-muted-foreground">
                          Review your information and accept terms to continue
                        </p>
                      </div>

                      {/* Review Summary */}
                      <Card className="bg-muted/50">
                        <CardContent className="pt-6">
                          <h3 className="font-semibold mb-4 flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            Account Summary
                          </h3>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Business:</span>
                              <span className="font-medium">{form.watch('business_name') || '—'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Owner:</span>
                              <span className="font-medium">{form.watch('owner_name') || '—'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Email:</span>
                              <span className="font-medium">{form.watch('email') || '—'}</span>
                            </div>
                            {form.watch('phone') && (
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Phone:</span>
                                <span className="font-medium">{form.watch('phone')}</span>
                              </div>
                            )}
                            {form.watch('state') && (
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">State:</span>
                                <span className="font-medium">{form.watch('state')}</span>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>

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
                  </SignupStepContent>

                   {/* Navigation Buttons */}
                  <div className="flex items-center justify-between pt-6 border-t">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleBack}
                      disabled={currentStep === 0}
                      className="min-w-[100px] h-12 hover:scale-105 transition-all"
                    >
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Back
                    </Button>

                    {currentStep < STEPS.length - 1 ? (
                      <Button
                        type="button"
                        onClick={handleNext}
                        className="min-w-[100px] h-12 bg-gradient-to-r from-blue-600 to-purple-600 hover:shadow-lg hover:scale-105 transition-all duration-200"
                      >
                        Next
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        onClick={handleFinalSubmit}
                        disabled={isSubmitting}
                        className="min-w-[100px] h-12 bg-gradient-to-r from-blue-600 to-purple-600 hover:shadow-lg hover:scale-105 transition-all duration-200"
                      >
                        {isSubmitting ? (
                          'Creating Account...'
                        ) : (
                          <>
                            Start Free Trial
                            <ArrowRight className="ml-2 h-4 w-4" />
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
          </div>

          {/* Right Column - Features Showcase (Desktop Only) */}
          <div className="hidden lg:block animate-fade-in" style={{ animationDelay: '0.5s' }}>
            <div className="sticky top-8">
              <SignupFeaturesShowcase />
            </div>
          </div>
        </div>

        {/* Features Showcase - Mobile (Below Form) */}
        <div className="lg:hidden mt-8 animate-fade-in" style={{ animationDelay: '0.6s' }}>
          <SignupFeaturesShowcase />
        </div>
      </div>
    </div>
  );
}
