import { useState, useEffect } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { useAuthRedirect } from "@/hooks/useAuthRedirect";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShoppingBag, Loader2, Sparkles, ArrowLeft } from "lucide-react";
import { toast } from "@/hooks/use-toast";

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
  });
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
      const response = await fetch(`${supabaseUrl}/functions/v1/customer-auth?action=signup`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          firstName: formData.firstName,
          lastName: formData.lastName,
          phone: formData.phone,
          tenantSlug,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Signup failed");
      }

      toast({
        title: "Account created!",
        description: "Please log in with your new credentials",
      });

      navigate(`/${tenantSlug}/customer/login`);
    } catch (error: any) {
      console.error("Customer signup error:", error);
      toast({
        variant: "destructive",
        title: "Signup failed",
        description: error.message || "Please try again",
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[hsl(var(--customer-bg))] via-[hsl(var(--customer-surface))] to-[hsl(var(--customer-bg))] p-4 relative overflow-hidden">
      {/* Decorative Background Elements */}
      <div className="absolute inset-0 overflow-hidden opacity-20">
        <div className="absolute top-10 right-10 w-32 h-32 rounded-full bg-[hsl(var(--customer-primary))] blur-3xl" />
        <div className="absolute bottom-10 left-10 w-40 h-40 rounded-full bg-[hsl(var(--customer-secondary))] blur-3xl" />
      </div>

      {/* White Card */}
      <div className="relative z-10 w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-2xl border border-[hsl(var(--customer-border))] p-8">
          {/* Back Button */}
          <Link 
            to={`/${tenantSlug}/customer/login`}
            className="inline-flex items-center text-sm text-[hsl(var(--customer-text-light))] hover:text-[hsl(var(--customer-primary))] mb-6 transition-colors"
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
                <div className="relative">
                  <div className="rounded-full bg-gradient-to-br from-[hsl(var(--customer-primary))] to-[hsl(var(--customer-secondary))] p-4 shadow-lg">
                    <ShoppingBag className="h-8 w-8 text-white" />
                  </div>
                  <div className="absolute -top-1 -right-1">
                    <Sparkles className="h-5 w-5 text-[hsl(var(--customer-accent))] animate-pulse" />
                  </div>
                </div>
              )}
            </div>
            <h1 className="text-3xl font-bold text-[hsl(var(--customer-text))] mb-2">
              Create Account
            </h1>
            <p className="text-[hsl(var(--customer-text-light))]">
              Start shopping at {businessName}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName" className="text-[hsl(var(--customer-text))]">
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
                  className="border-[hsl(var(--customer-border))] focus:border-[hsl(var(--customer-primary))] focus:ring-[hsl(var(--customer-primary))]/20"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="lastName" className="text-[hsl(var(--customer-text))]">
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
                  className="border-[hsl(var(--customer-border))] focus:border-[hsl(var(--customer-primary))] focus:ring-[hsl(var(--customer-primary))]/20"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-[hsl(var(--customer-text))]">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="customer@example.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                disabled={loading}
                className="border-[hsl(var(--customer-border))] focus:border-[hsl(var(--customer-primary))] focus:ring-[hsl(var(--customer-primary))]/20"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone" className="text-[hsl(var(--customer-text))]">
                Phone Number
              </Label>
              <Input
                id="phone"
                type="tel"
                placeholder="(555) 123-4567"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                required
                disabled={loading}
                className="border-[hsl(var(--customer-border))] focus:border-[hsl(var(--customer-primary))] focus:ring-[hsl(var(--customer-primary))]/20"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-[hsl(var(--customer-text))]">
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
                className="border-[hsl(var(--customer-border))] focus:border-[hsl(var(--customer-primary))] focus:ring-[hsl(var(--customer-primary))]/20"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-[hsl(var(--customer-text))]">
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
                className="border-[hsl(var(--customer-border))] focus:border-[hsl(var(--customer-primary))] focus:ring-[hsl(var(--customer-primary))]/20"
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-[hsl(var(--customer-primary))] to-[hsl(var(--customer-secondary))] hover:opacity-90 text-white h-12 font-semibold shadow-lg mt-6"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Creating account...
                </>
              ) : (
                "Create Account"
              )}
            </Button>
          </form>

          {/* Footer */}
          <div className="mt-6 text-center text-sm">
            <span className="text-[hsl(var(--customer-text-light))]">Already have an account? </span>
            <Link 
              to={`/${tenantSlug}/customer/login`}
              className="text-[hsl(var(--customer-primary))] hover:underline font-medium"
            >
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
