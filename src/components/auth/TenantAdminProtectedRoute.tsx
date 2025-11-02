import { ReactNode, useEffect, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import { Loader2 } from "lucide-react";

interface TenantAdminProtectedRouteProps {
  children: ReactNode;
}

export function TenantAdminProtectedRoute({ children }: TenantAdminProtectedRouteProps) {
  const { admin, tenant, token, loading, refreshToken } = useTenantAdminAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const [verifying, setVerifying] = useState(true);

  useEffect(() => {
    const verifyAuth = async () => {
      if (loading) return;

      // Allow access to welcome page even without full auth (for post-signup flow)
      const isWelcomePage = location.pathname.includes('/welcome');
      
      if (!token || !admin || !tenant) {
        // Allow welcome page for new signups (they may not be logged in yet)
        if (isWelcomePage && tenantSlug) {
          setVerifying(false);
          return;
        }
        
        if (tenantSlug) {
          navigate(`/${tenantSlug}/admin/login`, { replace: true });
        } else {
          navigate("/admin/login", { replace: true });
        }
        return;
      }

      // Verify tenant slug matches
      if (tenantSlug && tenant.slug !== tenantSlug) {
        navigate(`/${tenant.slug}/admin/login`, { replace: true });
        return;
      }

      // Verify token is still valid
      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const response = await fetch(`${supabaseUrl}/functions/v1/tenant-admin-auth?action=verify`, {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          throw new Error("Token verification failed");
        }

        const data = await response.json();
        
        // Verify tenant is still active
        if (data.tenant.status !== "active" && data.tenant.subscription_status !== "active" && data.tenant.subscription_status !== "trial") {
          throw new Error("Tenant is not active");
        }

        // Check if trial has expired
        const trialEndsAt = data.tenant.trial_ends_at;
        const subscriptionStatus = data.tenant.subscription_status;
        const isTrialExpired = 
          subscriptionStatus === "trial" && 
          trialEndsAt && 
          new Date(trialEndsAt).getTime() < Date.now();

        // Check if current route is billing, trial-expired, or welcome (allow access)
        const currentPath = location.pathname;
        const isAllowedRoute = 
          currentPath.includes("/billing") || 
          currentPath.includes("/trial-expired") ||
          currentPath.includes("/welcome");

        // If trial expired and not on allowed route, redirect to trial-expired
        if (isTrialExpired && !isAllowedRoute && tenantSlug) {
          navigate(`/${tenantSlug}/admin/trial-expired`, { replace: true });
          return;
        }

        setVerifying(false);
      } catch (error) {
        console.error("Auth verification error:", error);
        if (tenantSlug) {
          navigate(`/${tenantSlug}/admin/login`, { replace: true });
        } else {
          navigate("/admin/login", { replace: true });
        }
      }
    };

    verifyAuth();
  }, [token, admin, tenant, tenantSlug, loading, navigate, location.pathname]);

  if (loading || verifying) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Verifying access...</p>
        </div>
      </div>
    );
  }

  // Allow welcome page without full auth (for post-signup flow)
  const isWelcomePage = location.pathname.includes('/welcome');
  if ((!token || !admin || !tenant) && !isWelcomePage) {
    return null; // Will redirect
  }

  return <>{children}</>;
}

