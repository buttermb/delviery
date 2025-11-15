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
  
  // Check for email verification success
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const verified = urlParams.get('verified');
    const emailParam = urlParams.get('email');
    
    if (verified === 'true' && emailParam) {
      setEmail(emailParam);
      toast({
        title: 'Email Verified!',
        description: 'Please enter your password to complete login.',
      });
      // Clean up URL
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);
    }
  }, []);

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
    } catch (error: unknown) {
      logger.error("Customer login error", error);
      
      // Handle email verification error
      if (error instanceof Error && (error as any).requires_verification) {
        toast({
          variant: "destructive",
          title: "Email Not Verified",
          description: error.message || "Please verify your email address before logging in.",
        });
        navigate(`/${tenantSlug}/customer/verify-email?email=${encodeURIComponent(email)}`);
        setLoading(false);
        return;
      }
      
      toast({
        variant: "destructive",
        title: "Login failed",
        description: error instanceof Error ? error.message : "Invalid credentials",
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
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--customer-primary))]/95 via-[hsl(var(--customer-secondary))]/90 to-[hsl(var(--customer-primary))]/95" />
      
      {/* Animated orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-white/10 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-white/10 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-white/5 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '2s' }} />
      </div>

      <div className="max-w-md w-full relative z-10 animate-fade-in">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-white/10 backdrop-blur-xl border border-white/20 mb-6 shadow-2xl animate-scale-in">
            <ShoppingBag className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-5xl font-bold text-white mb-3 tracking-tight animate-fade-in" style={{ animationDelay: '0.1s' }}>
            Welcome Back
          </h1>
          <div className="flex items-center justify-center gap-2 animate-fade-in" style={{ animationDelay: '0.2s' }}>
            <Sparkles className="w-4 h-4 text-white/80" />
            <p className="text-white/80 text-lg font-medium">{businessName}</p>
            <Sparkles className="w-4 h-4 text-white/80" />
          </div>
        </div>

        {/* Premium Glassmorphic Card */}
        <div className="bg-white/10 backdrop-blur-2xl rounded-3xl shadow-2xl border border-white/20 p-8 animate-scale-in" style={{ animationDelay: '0.3s' }}>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2 group">
              <Label htmlFor="email" className="text-sm font-semibold text-white/90">
                Email Address
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="min-h-[48px] bg-white/5 backdrop-blur-xl border-white/10 text-white placeholder:text-white/40 focus:border-white/30 focus:ring-2 focus:ring-white/20 rounded-xl transition-all duration-300 hover:bg-white/10 focus:bg-white/10"
              />
            </div>

            <div className="space-y-2 group">
              <Label htmlFor="password" className="text-sm font-semibold text-white/90">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="min-h-[48px] bg-white/5 backdrop-blur-xl border-white/10 text-white placeholder:text-white/40 focus:border-white/30 focus:ring-2 focus:ring-white/20 rounded-xl transition-all duration-300 hover:bg-white/10 focus:bg-white/10"
              />
            </div>

            <Button
              type="submit"
              className="w-full min-h-[52px] bg-white text-[hsl(var(--customer-primary))] hover:bg-white/90 font-bold text-base shadow-2xl hover:shadow-white/20 transition-all duration-300 hover:scale-[1.02] rounded-xl relative overflow-hidden group"
              disabled={loading}
            >
              <span className="relative z-10 flex items-center justify-center gap-2">
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <ShoppingBag className="h-5 w-5" />
                    Sign In to Shop
                  </>
                )}
              </span>
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-700" />
            </Button>
          </form>

          {/* Footer Links */}
          <div className="mt-8 space-y-4">
            <div className="flex items-center justify-center gap-3 text-sm">
              <ForgotPasswordDialog userType="customer" tenantSlug={tenantSlug}>
                <button className="text-white/90 hover:text-white font-medium transition-all duration-300 hover:scale-105">
                  Forgot password?
                </button>
              </ForgotPasswordDialog>
              <span className="text-white/40">•</span>
              <Link
                to={`/${tenantSlug}/customer/signup`}
                className="text-white/90 hover:text-white font-medium transition-all duration-300 hover:scale-105"
              >
                Create account
              </Link>
            </div>

            <div className="pt-4 border-t border-white/10 text-center">
              <Link
                to={`/${tenantSlug}/admin/login`}
                className="text-sm text-white/70 hover:text-white transition-all duration-300 hover:scale-105 inline-flex items-center gap-1"
              >
                Business owner? Admin Login →
              </Link>
            </div>
          </div>
        </div>

        {/* Trust indicators */}
        <div className="mt-6 text-center animate-fade-in" style={{ animationDelay: '0.4s' }}>
          <p className="text-white/60 text-xs font-medium">
            🔒 Secure & encrypted connection
          </p>
        </div>
      </div>
    </div>
  );
}
