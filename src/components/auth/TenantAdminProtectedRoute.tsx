import { ReactNode, useEffect, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import { getTokenExpiration } from "@/lib/auth/jwt";
import { Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/utils/apiClient";

// Refresh token if it expires within 10 minutes
const SILENT_REFRESH_THRESHOLD_MS = 10 * 60 * 1000;

interface TenantAdminProtectedRouteProps {
  children: ReactNode;
}

export function TenantAdminProtectedRoute({ children }: TenantAdminProtectedRouteProps) {
  const { admin, tenant, token, accessToken, loading, refreshAuthToken } = useTenantAdminAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const [verifying, setVerifying] = useState(true);

  useEffect(() => {
    const verifyAuth = async () => {
      console.log('🔐 TenantAdminProtectedRoute - verifyAuth called:', {
        loading,
        hasToken: !!token,
        hasAdmin: !!admin,
        hasTenant: !!tenant,
        tenantSlug,
        currentPath: location.pathname,
      });

      if (loading) return;

      // Silent token refresh if expiring soon
      const currentToken = accessToken || token;
      if (currentToken) {
        const expiration = getTokenExpiration(currentToken);
        if (expiration) {
          const timeUntilExpiry = expiration.getTime() - Date.now();
          if (timeUntilExpiry > 0 && timeUntilExpiry < SILENT_REFRESH_THRESHOLD_MS) {
            console.log(`Token expires in ${Math.round(timeUntilExpiry / 1000 / 60)} minutes, silently refreshing`);
            await refreshAuthToken();
          }
        }
      }

      // Allow access to welcome page even without full auth (for post-signup flow)
      const isWelcomePage = location.pathname.includes('/welcome');
      
      if (!token || !admin || !tenant) {
        console.log('❌ Auth check failed - redirecting to login:', { token: !!token, admin: !!admin, tenant: !!tenant });
        // Allow welcome page for new signups (they may not be logged in yet)
        if (isWelcomePage && tenantSlug) {
          setVerifying(false);
          return;
        }
        
        if (tenantSlug) {
          console.log('🔀 Redirecting to:', `/${tenantSlug}/admin/login`);
          navigate(`/${tenantSlug}/admin/login`, { replace: true });
        } else {
          console.log('🔀 No tenant slug, redirecting to marketing');
          navigate("/marketing", { replace: true });
        }
        return;
      }

      console.log('✅ Auth check passed - user is authenticated');

      // Verify tenant slug matches (auth context should have already handled this)
      if (tenantSlug && tenant.slug !== tenantSlug) {
        console.log('⚠️ Tenant slug mismatch detected, should have been caught by auth context');
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
        
        const response = await apiFetch(`${supabaseUrl}/functions/v1/tenant-admin-auth?action=verify`, {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${tokenToUse}`,
          },
          skipAuth: true,
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
          navigate("/marketing", { replace: true });
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

