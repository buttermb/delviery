// @ts-nocheck
import { useState, useEffect } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { useAuthRedirect } from "@/hooks/useAuthRedirect";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShoppingBag, Loader2, Sparkles, ArrowLeft } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/utils/apiClient";
import { logger } from "@/utils/logger";
import { PasswordStrengthIndicator } from "@/components/auth/PasswordStrengthIndicator";

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
  const [phoneValidating, setPhoneValidating] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [ageError, setAgeError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [tenant, setTenant] = useState<any>(null);
  const [tenantLoading, setTenantLoading] = useState(true);

  useEffect(() => {
    const fetchTenant = async () => {
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!tenantSlug) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Tenant slug is required",
      });
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Passwords do not match",
      });
      return;
    }

    if (formData.password.length < 8) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Password must be at least 8 characters",
      });
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
          isBusinessBuyer: formData.isBusinessBuyer || false,
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

      toast({
        title: "Account created!",
        description: result.message || "Please check your email to verify your account",
      });

      // Redirect to verification page
      navigate(`/${tenantSlug}/customer/verify-email?email=${encodeURIComponent(formData.email)}`);
    } catch (error: unknown) {
      logger.error("Customer signup error", error, { component: "CustomerSignUpPage" });
      toast({
        variant: "destructive",
        title: "Signup failed",
        description: error instanceof Error ? error.message : "Please try again",
      });
    } finally {
      setLoading(false);
    }
  };

  if (tenantLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[hsl(var(--customer-bg))]">
        <Loader2 className="h-8 w-8 animate-spin text-[hsl(var(--customer-primary))]" />
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[hsl(var(--customer-bg))] p-4">
        <div className="w-full max-w-md bg-white rounded-xl shadow-lg border border-[hsl(var(--customer-border))] p-8">
          <div className="text-center mb-6">
            <ShoppingBag className="h-12 w-12 text-[hsl(var(--customer-text-light))] mx-auto mb-4" />
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
  const logo = tenant.white_label?.logo;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Subtle animated accents */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-[hsl(var(--customer-primary))]/20 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-[hsl(var(--customer-secondary))]/15 rounded-full blur-3xl" />
      </div>

      {/* Card */}
      <div className="relative z-10 w-full max-w-md">
        <div className="bg-slate-800/80 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-700/50 p-8">
          {/* Back Button */}
          <Link 
            to={`/${tenantSlug}/customer/login`}
            className="inline-flex items-center text-sm text-slate-400 hover:text-white mb-6 transition-colors"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to login
          </Link>

          {/* Header */}
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              {logo ? (
                <img src={logo} alt={businessName} className="h-16 object-contain" />
              ) : (
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[hsl(var(--customer-primary))] shadow-xl">
                  <ShoppingBag className="w-8 h-8 text-white" />
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
            <div className="grid grid-cols-2 gap-4">
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
                  required
                  disabled={loading}
                  className="h-11 bg-slate-900/80 border-slate-600 text-white placeholder:text-slate-400 focus:border-[hsl(var(--customer-primary))] focus:ring-2 focus:ring-[hsl(var(--customer-primary))]/20 rounded-lg [&:-webkit-autofill]:!text-white [&:-webkit-autofill]:!bg-slate-900"
                />
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
                  required
                  disabled={loading}
                  className="h-11 bg-slate-900/80 border-slate-600 text-white placeholder:text-slate-400 focus:border-[hsl(var(--customer-primary))] focus:ring-2 focus:ring-[hsl(var(--customer-primary))]/20 rounded-lg [&:-webkit-autofill]:!text-white [&:-webkit-autofill]:!bg-slate-900"
                />
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
                required
                disabled={loading}
                className="h-11 bg-slate-900/80 border-slate-600 text-white placeholder:text-slate-400 focus:border-[hsl(var(--customer-primary))] focus:ring-2 focus:ring-[hsl(var(--customer-primary))]/20 rounded-lg [&:-webkit-autofill]:!text-white [&:-webkit-autofill]:!bg-slate-900"
              />
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
                className="h-11 bg-slate-900/80 border-slate-600 text-white placeholder:text-slate-400 focus:border-[hsl(var(--customer-primary))] focus:ring-2 focus:ring-[hsl(var(--customer-primary))]/20 rounded-lg [&:-webkit-autofill]:!text-white [&:-webkit-autofill]:!bg-slate-900"
              />
            </div>

            <div className="flex items-center space-x-2 py-2">
              <input
                type="checkbox"
                id="isBusinessBuyer"
                checked={formData.isBusinessBuyer}
                onChange={(e) => setFormData({ ...formData, isBusinessBuyer: e.target.checked })}
                className="rounded border-slate-700 bg-slate-900/50 text-[hsl(var(--customer-primary))] focus:ring-2 focus:ring-[hsl(var(--customer-primary))]/20"
              />
              <Label htmlFor="isBusinessBuyer" className="text-sm text-slate-300 cursor-pointer">
                I'm a business buyer (wholesale)
              </Label>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium text-slate-200">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
                disabled={loading}
                className="h-11 bg-slate-900/80 border-slate-600 text-white placeholder:text-slate-400 focus:border-[hsl(var(--customer-primary))] focus:ring-2 focus:ring-[hsl(var(--customer-primary))]/20 rounded-lg [&:-webkit-autofill]:!text-white [&:-webkit-autofill]:!bg-slate-900"
              />
              <PasswordStrengthIndicator password={formData.password} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-sm font-medium text-slate-200">
                Confirm Password
              </Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                required
                disabled={loading}
                className="h-11 bg-slate-900/80 border-slate-600 text-white placeholder:text-slate-400 focus:border-[hsl(var(--customer-primary))] focus:ring-2 focus:ring-[hsl(var(--customer-primary))]/20 rounded-lg [&:-webkit-autofill]:!text-white [&:-webkit-autofill]:!bg-slate-900"
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 bg-[hsl(var(--customer-primary))] hover:bg-[hsl(var(--customer-primary))]/90 text-white font-semibold text-base shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02] rounded-lg"
            >
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
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
