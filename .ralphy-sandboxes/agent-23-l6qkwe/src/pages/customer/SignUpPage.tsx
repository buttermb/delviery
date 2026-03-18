import { logger } from '@/lib/logger';
import { useState, useEffect } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { useAuthRedirect } from "@/hooks/useAuthRedirect";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { ShoppingBag, Loader2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/utils/apiClient";
import { PasswordStrengthIndicator } from "@/components/auth/PasswordStrengthIndicator";
import { RateLimitWarning } from "@/components/auth/RateLimitWarning";
import { useAuthRateLimit } from "@/hooks/useAuthRateLimit";
import { PasswordBreachWarning } from "@/components/auth/PasswordBreachWarning";
import { usePasswordBreachCheck } from "@/hooks/usePasswordBreachCheck";
import { Tenant } from "@/types/tenant-extended";
import { useCsrfToken } from "@/hooks/useCsrfToken";
import { AuthErrorAlert, getAuthErrorMessage } from "@/components/auth/AuthErrorAlert";

export default function CustomerSignUpPage() {
  const navigate = useNavigate();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  useAuthRedirect();

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    firstName: "",
    lastName: "",
    phone: "",
    dateOfBirth: "",
    isBusinessBuyer: false,
    businessName: "",
    businessLicenseNumber: "",
  });
  const [loading, setLoading] = useState(false);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [tenantLoading, setTenantLoading] = useState(true);
  const [signupError, setSignupError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const { isLocked, remainingSeconds, recordAttempt, resetOnSuccess } = useAuthRateLimit({
    storageKey: 'floraiq_customer_signup_rate_limit',
  });
  const { validateToken } = useCsrfToken();

  // Password breach checking
  const { checking: breachChecking, result: breachResult, suggestPassword } = usePasswordBreachCheck(formData.password);

  const validateField = (field: string, value: string): string | undefined => {
    switch (field) {
      case 'firstName':
        if (!value.trim()) return 'First name is required';
        if (value.trim().length < 2) return 'First name must be at least 2 characters';
        return;
      case 'lastName':
        if (!value.trim()) return 'Last name is required';
        if (value.trim().length < 2) return 'Last name must be at least 2 characters';
        return;
      case 'email':
        if (!value.trim()) return 'Email is required';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Please enter a valid email address';
        return;
      case 'password':
        if (!value) return 'Password is required';
        if (value.length < 8) return 'Password must be at least 8 characters';
        if (!/[a-zA-Z]/.test(value)) return 'Password must contain at least one letter';
        if (!/\d/.test(value)) return 'Password must contain at least one number';
        return;
      case 'confirmPassword':
        if (!value) return 'Please confirm your password';
        if (value !== formData.password) return 'Passwords do not match';
        return;
      default:
        return;
    }
  };

  const handleBlur = (field: string) => {
    setTouched(prev => ({ ...prev, [field]: true }));
    const value = formData[field as keyof typeof formData] as string;
    const error = validateField(field, value);
    setFieldErrors(prev => {
      if (error) return { ...prev, [field]: error };
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const validateAllFields = (): boolean => {
    const errors: Record<string, string> = {};
    const fields = ['firstName', 'lastName', 'email', 'password', 'confirmPassword'] as const;
    for (const field of fields) {
      const value = formData[field];
      const error = validateField(field, value);
      if (error) errors[field] = error;
    }
    setFieldErrors(errors);
    setTouched({ firstName: true, lastName: true, email: true, password: true, confirmPassword: true });
    return Object.keys(errors).length === 0;
  };

  useEffect(() => {
    const fetchTenant = async () => {
      if (tenantSlug) {
        const { data, error } = await supabase
          .from("tenants")
          .select('id, slug, business_name, white_label')
          .eq("slug", tenantSlug)
          .maybeSingle();

        if (error) {
          logger.error('Failed to fetch tenant', error, { component: 'CustomerSignUpPage', tenantSlug });
        } else if (data) {
          setTenant(data as unknown as Tenant);
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
    setSignupError(null);

    if (!validateAllFields()) {
      return;
    }

    if (!validateToken()) {
      setSignupError("Invalid security token. Please refresh the page and try again.");
      return;
    }

    if (isLocked) {
      return;
    }

    if (!tenantSlug) {
      setSignupError("Store information is missing. Please check the URL and try again.");
      return;
    }

    if (breachResult?.blocked) {
      setSignupError("This password has been found in data breaches. Please choose a different, more secure password.");
      return;
    }

    setLoading(true);

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await apiFetch(`${supabaseUrl}/functions/v1/customer-auth?action=signup`, {
        method: "POST",
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          firstName: formData.firstName,
          lastName: formData.lastName,
          phone: formData.phone || null,
          dateOfBirth: formData.dateOfBirth || null,
          tenantSlug,
          isBusinessBuyer: formData.isBusinessBuyer ?? false,
          businessName: formData.isBusinessBuyer ? formData.businessName : null,
          businessLicenseNumber: formData.isBusinessBuyer ? formData.businessLicenseNumber : null,
        }),
        skipAuth: true,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Signup failed");
      }

      const result = await response.json();

      resetOnSuccess();

      toast.success("Account created!", {
        description: result.message || "Please check your email to verify your account",
      });

      // Redirect to verification page
      navigate(`/${tenantSlug}/customer/verify-email?email=${encodeURIComponent(formData.email)}`);
    } catch (error: unknown) {
      recordAttempt();
      logger.error("Customer signup error", error, { component: "CustomerSignUpPage" });
      const errorMessage = getAuthErrorMessage(error, "Signup failed. Please try again.");
      setSignupError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (tenantLoading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-[hsl(var(--customer-bg))]">
        <Loader2 className="h-8 w-8 animate-spin text-[hsl(var(--customer-primary))]" aria-hidden="true" />
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-[hsl(var(--customer-bg))] p-4">
        <div className="w-full max-w-md bg-white rounded-xl shadow-lg border border-[hsl(var(--customer-border))] p-8">
          <div className="text-center mb-6">
            <ShoppingBag className="h-12 w-12 text-[hsl(var(--customer-text-light))] mx-auto mb-4" aria-hidden="true" />
            <h1 className="text-2xl font-bold text-[hsl(var(--customer-text))] mb-2">Store Not Found</h1>
            <p className="text-[hsl(var(--customer-text-light))]">
              The store "{tenantSlug}" could not be found or is inactive.
            </p>
          </div>
          <Button asChild variant="outline" className="w-full">
            <Link to="/">Go to Home</Link>
          </Button>
        </div>
      </div>
    );
  }

  const businessName = tenant.business_name || tenantSlug;
  const whiteLabel = tenant.white_label as Record<string, unknown> | null;
  const logo = whiteLabel?.logo;

  return (
    <div data-dark-panel className="min-h-dvh flex items-center justify-center p-4 relative overflow-hidden bg-slate-50">
      {/* Subtle animated accents */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-[hsl(var(--customer-primary))]/20 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-[hsl(var(--customer-secondary))]/15 rounded-full blur-3xl" />
      </div>

      {/* Card */}
      <div className="relative z-10 w-full max-w-md">
        <div className="bg-slate-800/80  rounded-2xl shadow-2xl border border-slate-700/50 p-8">
          {/* Back Button */}
          <Link
            to={`/${tenantSlug}/customer/login`}
            className="inline-flex items-center text-sm text-slate-400 hover:text-white mb-6 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-800 rounded-sm"
          >
            <ArrowLeft className="h-4 w-4 mr-1" aria-hidden="true" />
            Back to login
          </Link>

          {/* Header */}
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              {logo ? (
                <img src={logo as string} alt={businessName} className="h-16 object-contain" />
              ) : (
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[hsl(var(--customer-primary))] shadow-xl">
                  <ShoppingBag className="w-8 h-8 text-white" aria-hidden="true" />
                </div>
              )}
            </div>
            <h1 className="text-4xl font-bold text-white mb-2">
              Create Account
            </h1>
            <p className="text-slate-400">
              Start shopping at {businessName}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <RateLimitWarning remainingSeconds={remainingSeconds} variant="dark" />
            <AuthErrorAlert
              message={signupError ?? ''}
              type="error"
              variant="dark"
              className="mb-2"
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName" className="text-sm font-medium text-slate-200">
                  First Name
                </Label>
                <Input
                  id="firstName"
                  type="text"
                  placeholder="John"
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  onBlur={() => handleBlur('firstName')}
                  required
                  disabled={loading}
                  autoComplete="given-name"
                  aria-invalid={!!(touched.firstName && fieldErrors.firstName)}
                  className="h-11 bg-slate-900/80 border-slate-600 text-white placeholder:text-slate-400 focus-visible:border-[hsl(var(--customer-primary))] focus-visible:ring-2 focus-visible:ring-[hsl(var(--customer-primary))]/20 rounded-lg [&:-webkit-autofill]:!text-white [&:-webkit-autofill]:!bg-slate-900"
                />
                {touched.firstName && fieldErrors.firstName && (
                  <p className="text-sm text-red-400" role="alert">{fieldErrors.firstName}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="lastName" className="text-sm font-medium text-slate-200">
                  Last Name
                </Label>
                <Input
                  id="lastName"
                  type="text"
                  placeholder="Doe"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  onBlur={() => handleBlur('lastName')}
                  required
                  disabled={loading}
                  autoComplete="family-name"
                  aria-invalid={!!(touched.lastName && fieldErrors.lastName)}
                  className="h-11 bg-slate-900/80 border-slate-600 text-white placeholder:text-slate-400 focus-visible:border-[hsl(var(--customer-primary))] focus-visible:ring-2 focus-visible:ring-[hsl(var(--customer-primary))]/20 rounded-lg [&:-webkit-autofill]:!text-white [&:-webkit-autofill]:!bg-slate-900"
                />
                {touched.lastName && fieldErrors.lastName && (
                  <p className="text-sm text-red-400" role="alert">{fieldErrors.lastName}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium text-slate-200">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                onBlur={() => handleBlur('email')}
                required
                disabled={loading}
                inputMode="email"
                enterKeyHint="next"
                autoComplete="email"
                aria-invalid={!!(touched.email && fieldErrors.email)}
                className="h-11 bg-slate-900/80 border-slate-600 text-white placeholder:text-slate-400 focus-visible:border-[hsl(var(--customer-primary))] focus-visible:ring-2 focus-visible:ring-[hsl(var(--customer-primary))]/20 rounded-lg [&:-webkit-autofill]:!text-white [&:-webkit-autofill]:!bg-slate-900"
              />
              {touched.email && fieldErrors.email && (
                <p className="text-sm text-red-400" role="alert">{fieldErrors.email}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone" className="text-sm font-medium text-slate-200">
                Phone Number
              </Label>
              <Input
                id="phone"
                type="tel"
                placeholder="(555) 123-4567"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                disabled={loading}
                inputMode="tel"
                enterKeyHint="next"
                autoComplete="tel"
                className="h-11 bg-slate-900/80 border-slate-600 text-white placeholder:text-slate-400 focus-visible:border-[hsl(var(--customer-primary))] focus-visible:ring-2 focus-visible:ring-[hsl(var(--customer-primary))]/20 rounded-lg [&:-webkit-autofill]:!text-white [&:-webkit-autofill]:!bg-slate-900"
              />
            </div>

            <div className="flex items-center space-x-2 py-2">
              <input
                type="checkbox"
                id="isBusinessBuyer"
                checked={formData.isBusinessBuyer}
                onChange={(e) => setFormData({ ...formData, isBusinessBuyer: e.target.checked })}
                className="rounded border-slate-700 bg-slate-900/50 text-[hsl(var(--customer-primary))] focus-visible:ring-2 focus-visible:ring-[hsl(var(--customer-primary))]/20"
              />
              <Label htmlFor="isBusinessBuyer" className="text-sm text-slate-300 cursor-pointer">
                I'm a business buyer (wholesale)
              </Label>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium text-slate-200">
                Password
              </Label>
              <PasswordInput
                id="password"
                placeholder="••••••••"
                value={formData.password}
                onChange={(e) => {
                  const newPassword = e.target.value;
                  setFormData({ ...formData, password: newPassword });
                  if (touched.confirmPassword && formData.confirmPassword) {
                    const confirmError = newPassword !== formData.confirmPassword ? 'Passwords do not match' : undefined;
                    setFieldErrors(prev => {
                      if (confirmError) return { ...prev, confirmPassword: confirmError };
                      const next = { ...prev };
                      delete next.confirmPassword;
                      return next;
                    });
                  }
                }}
                onBlur={() => handleBlur('password')}
                required
                disabled={loading}
                autoComplete="new-password"
                enterKeyHint="next"
                aria-invalid={!!(touched.password && fieldErrors.password)}
                className="h-11 bg-slate-900/80 border-slate-600 text-white placeholder:text-slate-400 focus-visible:border-[hsl(var(--customer-primary))] focus-visible:ring-2 focus-visible:ring-[hsl(var(--customer-primary))]/20 rounded-lg [&:-webkit-autofill]:!text-white [&:-webkit-autofill]:!bg-slate-900"
              />
              <PasswordStrengthIndicator password={formData.password} />
              {touched.password && fieldErrors.password && (
                <p className="text-sm text-red-400" role="alert">{fieldErrors.password}</p>
              )}
              {formData.password.length >= 8 && (
                <PasswordBreachWarning
                  checking={breachChecking}
                  result={breachResult}
                  suggestPassword={suggestPassword}
                  onGeneratePassword={(pw) => setFormData({ ...formData, password: pw, confirmPassword: pw })}
                />
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-sm font-medium text-slate-200">
                Confirm Password
              </Label>
              <PasswordInput
                id="confirmPassword"
                placeholder="••••••••"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                onBlur={() => handleBlur('confirmPassword')}
                required
                disabled={loading}
                autoComplete="new-password"
                enterKeyHint="done"
                aria-invalid={!!(touched.confirmPassword && fieldErrors.confirmPassword)}
                className="h-11 bg-slate-900/80 border-slate-600 text-white placeholder:text-slate-400 focus-visible:border-[hsl(var(--customer-primary))] focus-visible:ring-2 focus-visible:ring-[hsl(var(--customer-primary))]/20 rounded-lg [&:-webkit-autofill]:!text-white [&:-webkit-autofill]:!bg-slate-900"
              />
              {touched.confirmPassword && fieldErrors.confirmPassword && (
                <p className="text-sm text-red-400" role="alert">{fieldErrors.confirmPassword}</p>
              )}
            </div>

            <Button
              type="submit"
              disabled={loading || isLocked}
              className="w-full h-12 bg-[hsl(var(--customer-primary))] hover:bg-[hsl(var(--customer-primary))]/90 text-white font-semibold text-base shadow-lg hover:shadow-xl transition-transform duration-300 hover:scale-[1.02] rounded-lg"
            >
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
              ) : (
                "Create Account"
              )}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-slate-400">
            Already have an account?{" "}
            <Link
              to={`/${tenantSlug}/customer/login`}
              className="text-[hsl(var(--customer-primary))] hover:text-[hsl(var(--customer-primary))]/80 font-medium transition-colors"
            >
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
