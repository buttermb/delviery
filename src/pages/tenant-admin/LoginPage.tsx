import { useState, useEffect } from "react";
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

export default function TenantAdminLoginPage() {
  const navigate = useNavigate();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { login } = useTenantAdminAuth();
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
        title: "Welcome back!",
        description: `Logged in to ${tenant?.business_name || tenantSlug}`,
      });

      navigate(`/${tenantSlug}/admin/dashboard`, { replace: true });
    } catch (error: any) {
      console.error("Tenant admin login error:", error);
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

  const businessName = tenant.business_name || tenantSlug;
  const logo = tenant.white_label?.logo;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[hsl(var(--tenant-bg))] via-[hsl(var(--tenant-surface))] to-[hsl(var(--tenant-bg))] p-4 relative overflow-hidden">
      {/* Subtle Background Pattern */}
      <div className="absolute inset-0 opacity-30">
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle at 2px 2px, hsl(var(--tenant-primary)) 1px, transparent 0)`,
          backgroundSize: "40px 40px",
        }} />
      </div>

      {/* White Card */}
      <div className="relative z-10 w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl border border-[hsl(var(--tenant-border))] p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              {logo ? (
                <img src={logo} alt={businessName} className="h-16 object-contain" />
              ) : (
                <div className="rounded-full bg-gradient-to-br from-[hsl(var(--tenant-primary))] to-[hsl(var(--tenant-secondary))] p-4 shadow-lg">
                  <Building2 className="h-8 w-8 text-white" />
                </div>
              )}
            </div>
            <h1 className="text-3xl font-bold text-[hsl(var(--tenant-text))] mb-2">
              {businessName}
            </h1>
            <p className="text-[hsl(var(--tenant-text-light))]">
              Admin Panel
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-[hsl(var(--tenant-text))]">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@business.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                className="h-12 border-[hsl(var(--tenant-border))] focus:border-[hsl(var(--tenant-primary))] focus:ring-[hsl(var(--tenant-primary))]/20 transition-all"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-[hsl(var(--tenant-text))]">
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
                className="h-12 border-[hsl(var(--tenant-border))] focus:border-[hsl(var(--tenant-primary))] focus:ring-[hsl(var(--tenant-primary))]/20 transition-all"
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-[hsl(var(--tenant-primary))] to-[hsl(var(--tenant-secondary))] hover:opacity-90 text-white h-12 font-semibold shadow-lg"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Signing in...
                </>
              ) : (
                "Sign In"
              )}
            </Button>
          </form>

          {/* Links */}
          <div className="mt-6 space-y-3 text-center text-sm">
            <ForgotPasswordDialog userType="tenant_admin" tenantSlug={tenantSlug} />
            <div className="pt-3 border-t border-[hsl(var(--tenant-border))]">
              <Link 
                to={`/${tenantSlug}/shop/login`} 
                className="text-[hsl(var(--tenant-primary))] hover:underline font-medium"
              >
                Customer? Go to Customer Portal →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
