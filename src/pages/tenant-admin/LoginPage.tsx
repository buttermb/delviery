import { logger } from '@/lib/logger';
import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuthRedirect } from "@/hooks/useAuthRedirect";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, Loader2, ArrowLeft } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import { Link } from "react-router-dom";
import { ForgotPasswordDialog } from "@/components/auth/ForgotPasswordDialog";
import { TwoFactorVerification } from "@/components/auth/TwoFactorVerification";
import { Database } from "@/integrations/supabase/types";

type Tenant = Database['public']['Tables']['tenants']['Row'];

export default function TenantAdminLoginPage() {
  const navigate = useNavigate();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { login, mfaRequired, verifyMfa } = useTenantAdminAuth();
  useAuthRedirect(); // Redirect if already logged in
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [tenantLoading, setTenantLoading] = useState(true);


  useEffect(() => {
    const fetchTenant = async (): Promise<void> => {
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

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
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
        title: "Welcome back!",
        description: `Logged in to ${tenant?.business_name || tenantSlug}`,
      });

      navigate(`/${tenantSlug}/admin/dashboard`, { replace: true });
    } catch (error: unknown) {
      logger.error("Tenant admin login error", error, { component: 'TenantAdminLoginPage' });
      const errorMessage = error instanceof Error ? error.message : "Invalid credentials";
      toast({
        variant: "destructive",
        title: "Login failed",
        description: errorMessage,
      });
      setLoading(false);
    }
  };

  if (tenantLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[hsl(var(--tenant-bg))]">
        <Loader2 className="h-8 w-8 animate-spin text-[hsl(var(--tenant-primary))]" />
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[hsl(var(--tenant-bg))] p-4">
        <div className="w-full max-w-md bg-white rounded-xl shadow-lg border border-[hsl(var(--tenant-surface))] p-8">
          <div className="text-center mb-6">
            <Building2 className="h-12 w-12 text-[hsl(var(--tenant-text-light))] mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-[hsl(var(--tenant-text))] mb-2">Tenant Not Found</h1>
            <p className="text-[hsl(var(--tenant-text-light))]">
              The tenant "{tenantSlug}" could not be found or is inactive.
            </p>
          </div>
          <Button asChild variant="outline" className="w-full">
            <Link to="/">Go to Home</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (mfaRequired) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[hsl(var(--tenant-bg))] p-4">
        <div className="w-full max-w-md bg-white rounded-xl shadow-lg border border-[hsl(var(--tenant-surface))] p-8">
          <TwoFactorVerification
            onVerified={() => {
              // Auth context handles state update and redirect
              toast({
                title: "Authentication Successful",
                description: "You have been securely logged in.",
              });
            }}
          />
        </div>
      </div>
    );
  }

  const businessName = tenant.business_name || tenantSlug;
  const logo = null; // White label settings not implemented yet

  return (
    <div className="min-h-screen flex items-center justify-center bg-[hsl(var(--tenant-bg))] p-4 relative overflow-hidden">
      {/* Animated Background Gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--tenant-primary))]/5 via-[hsl(var(--tenant-surface))] to-[hsl(var(--tenant-secondary))]/5" />

      {/* Floating Orbs */}
      <div className="absolute top-20 left-10 w-72 h-72 bg-[hsl(var(--tenant-primary))]/10 rounded-full blur-3xl animate-pulse-slow" />
      <div className="absolute bottom-20 right-10 w-96 h-96 bg-[hsl(var(--tenant-secondary))]/10 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: "1s" }} />

      {/* Subtle Grid Pattern */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle at 2px 2px, hsl(var(--tenant-primary)) 1px, transparent 0)`,
          backgroundSize: "48px 48px",
        }} />
      </div>

      {/* Card Container with Glow Effect */}
      <div className="relative z-10 w-full max-w-md">
        <div className="absolute inset-0 bg-gradient-to-r from-[hsl(var(--tenant-primary))]/20 to-[hsl(var(--tenant-secondary))]/20 rounded-2xl blur-xl" />
        <div className="relative bg-card rounded-2xl shadow-2xl border border-border backdrop-blur-sm p-4 sm:p-6 md:p-8">
          {/* Header */}
          <div className="text-center mb-6 sm:mb-8">
            <div className="flex justify-center mb-3 sm:mb-4">
              {logo ? (
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--tenant-primary))]/30 to-[hsl(var(--tenant-secondary))]/30 rounded-2xl blur-xl" />
                  <img src={logo} alt={businessName} className="relative h-12 sm:h-16 object-contain" />
                </div>
              ) : (
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--tenant-primary))] to-[hsl(var(--tenant-secondary))] rounded-full blur-lg opacity-50" />
                  <div className="relative rounded-full bg-gradient-to-br from-[hsl(var(--tenant-primary))] to-[hsl(var(--tenant-secondary))] p-3 sm:p-4 shadow-2xl">
                    <Building2 className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
                  </div>
                </div>
              )}
            </div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground mb-1 sm:mb-2 break-words">
              {businessName}
            </h1>
            <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1 sm:py-1.5 rounded-full bg-[hsl(var(--tenant-primary))]/10 border border-[hsl(var(--tenant-primary))]/20">
              <span className="text-xs sm:text-sm font-medium text-[hsl(var(--tenant-primary))]">Admin Panel</span>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm sm:text-base font-medium">
                Email Address
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@business.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                className="min-h-[44px] sm:h-12 bg-background/50 backdrop-blur-sm transition-all text-sm sm:text-base touch-manipulation"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm sm:text-base font-medium">
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
                className="min-h-[44px] sm:h-12 bg-background/50 backdrop-blur-sm transition-all text-sm sm:text-base touch-manipulation"
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-[hsl(var(--tenant-primary))] to-[hsl(var(--tenant-secondary))] hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 text-white min-h-[44px] sm:h-12 font-semibold shadow-md touch-manipulation text-sm sm:text-base"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 sm:h-5 sm:w-5 animate-spin" />
                  <span>Signing in...</span>
                </>
              ) : (
                <span>Sign In to Dashboard</span>
              )}
            </Button>
          </form>

          {/* Links */}
          <div className="mt-4 sm:mt-6 space-y-3 text-center text-xs sm:text-sm">
            <ForgotPasswordDialog userType="tenant_admin" tenantSlug={tenantSlug} />
            <div className="pt-3 sm:pt-4 border-t border-border">
              <p className="text-muted-foreground mb-2">Not an admin?</p>
              <Link
                to={`/${tenantSlug}/shop`}
                className="inline-flex items-center gap-1 text-[hsl(var(--tenant-primary))] hover:text-[hsl(var(--tenant-secondary))] font-medium transition-colors touch-manipulation min-h-[44px]"
              >
                <span className="text-xs sm:text-sm">Go to Customer Portal →</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
