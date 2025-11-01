import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuthRedirect } from "@/hooks/useAuthRedirect";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Tenant Not Found</CardTitle>
            <CardDescription>
              The tenant "{tenantSlug}" could not be found or is inactive.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="w-full">
              <Link to="/">Go to Home</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const businessName = tenant.business_name || tenantSlug;
  const logo = tenant.white_label?.logo;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            {logo ? (
              <img src={logo} alt={businessName} className="h-12 object-contain" />
            ) : (
              <div className="rounded-full bg-blue-600 p-3">
                <Building2 className="h-8 w-8 text-white" />
              </div>
            )}
          </div>
          <CardTitle className="text-2xl font-bold">{businessName}</CardTitle>
          <CardDescription>
            Admin Panel - Sign in to manage your business
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@business.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                "Sign In"
              )}
            </Button>
          </form>
          <div className="mt-4 space-y-2 text-center text-sm">
            <ForgotPasswordDialog userType="tenant_admin" tenantSlug={tenantSlug} />
            <div className="pt-2 border-t">
              <Link 
                to={`/${tenantSlug}/shop/login`} 
                className="text-muted-foreground hover:text-foreground"
              >
                Customer? Go to Customer Portal →
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

