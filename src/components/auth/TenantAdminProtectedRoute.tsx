import { ReactNode, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import { Loader2 } from "lucide-react";

interface TenantAdminProtectedRouteProps {
  children: ReactNode;
}

export function TenantAdminProtectedRoute({ children }: TenantAdminProtectedRouteProps) {
  const { admin, tenant, token, accessToken, loading } = useTenantAdminAuth();
  const navigate = useNavigate();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const [verifying, setVerifying] = useState(true);

  useEffect(() => {
    const verifyAuth = async () => {
      if (loading) return;

      if (!token || !admin || !tenant) {
        if (tenantSlug) {
          navigate(`/${tenantSlug}/admin/login`, { replace: true });
        } else {
          navigate("/marketing", { replace: true });
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
        const tokenToUse = accessToken || token;
        
        if (!tokenToUse) {
          throw new Error("No access token available");
        }
        
        const response = await fetch(`${supabaseUrl}/functions/v1/tenant-admin-auth?action=verify`, {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${tokenToUse}`,
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          throw new Error("Token verification failed");
        }

        const data = await response.json();
        
        // Check if trial has expired
        if (tenant.subscription_status === "trial" && (tenant as any).trial_ends_at) {
          const trialEnds = new Date((tenant as any).trial_ends_at);
          const now = new Date();
          
          if (now > trialEnds) {
            // Allow access to billing and trial-expired pages only
            const currentPath = window.location.pathname;
            if (!currentPath.includes('/billing') && !currentPath.includes('/trial-expired')) {
              navigate(`/${tenantSlug}/admin/trial-expired`, { replace: true });
              return;
            }
          }
        }
        
        // Verify tenant is still active or in trial
        if (data.tenant && (data.tenant.subscription_status === "active" || data.tenant.subscription_status === "trial" || data.tenant.subscription_status === "trialing")) {
          setVerifying(false);
        } else {
          throw new Error("Tenant subscription is not active");
        }
      } catch (error) {
        console.error("Auth verification error:", error);
        if (tenantSlug) {
          navigate(`/${tenantSlug}/admin/login`, { replace: true });
        } else {
          navigate("/marketing", { replace: true });
        }
      }
    };

    verifyAuth();
  }, [token, accessToken, admin, tenant, tenantSlug, loading, navigate]);

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

  if (!token || !admin || !tenant) {
    return null; // Will redirect
  }

  return <>{children}</>;
}

