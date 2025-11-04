import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuthRedirect } from "@/hooks/useAuthRedirect";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShoppingBag, Loader2, Sparkles } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useCustomerAuth } from "@/contexts/CustomerAuthContext";
import { Link } from "react-router-dom";
import { ForgotPasswordDialog } from "@/components/auth/ForgotPasswordDialog";
import { logger } from "@/utils/logger";

export default function CustomerLoginPage() {
  const navigate = useNavigate();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { login } = useCustomerAuth();
  useAuthRedirect(); // Redirect if already logged in
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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

    setLoading(true);
    
    try {
      await login(email, password, tenantSlug);
      
      toast({
        title: "Welcome!",
        description: `Logged in successfully`,
      });

      navigate(`/${tenantSlug}/shop/dashboard`, { replace: true });
    } catch (error: any) {
      logger.error("Customer login error", error);
      toast({
        variant: "destructive",
        title: "Login failed",
        description: error.message || "Invalid credentials",
      });
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
              Welcome Back!
            </h1>
            <p className="text-[hsl(var(--customer-text-light))]">
              {businessName} - Customer Portal
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-[hsl(var(--customer-text))]">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="customer@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                className="h-12 border-[hsl(var(--customer-border))] focus:border-[hsl(var(--customer-primary))] focus:ring-[hsl(var(--customer-primary))]/20 transition-all"
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
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                className="h-12 border-[hsl(var(--customer-border))] focus:border-[hsl(var(--customer-primary))] focus:ring-[hsl(var(--customer-primary))]/20 transition-all"
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-[hsl(var(--customer-primary))] to-[hsl(var(--customer-secondary))] hover:opacity-90 text-white h-12 font-semibold shadow-lg"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Signing in...
                </>
              ) : (
                "Sign In to Shop"
              )}
            </Button>
          </form>

          {/* Links */}
          <div className="mt-6 space-y-3 text-center text-sm">
            <div className="flex items-center justify-center gap-2">
              <ForgotPasswordDialog userType="customer" tenantSlug={tenantSlug} />
              <span className="text-[hsl(var(--customer-text-light))]">•</span>
              <Link 
                to={`/${tenantSlug}/customer/signup`}
                className="text-[hsl(var(--customer-primary))] hover:underline font-medium"
              >
                Create account
              </Link>
            </div>
            <div className="pt-3 border-t border-[hsl(var(--customer-border))]">
              <Link 
                to={`/${tenantSlug}/admin/login`} 
                className="text-[hsl(var(--customer-text-light))] hover:text-[hsl(var(--customer-primary))] transition-colors"
              >
                Business owner? Admin Login →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
