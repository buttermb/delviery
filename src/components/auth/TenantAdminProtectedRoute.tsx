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

  // Safety timeout: if verification takes too long, stop showing loading
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (verifying) {
        console.warn("Auth verification timeout - stopping verification");
        setVerifying(false);
      }
    }, 10000); // 10 second timeout

    return () => clearTimeout(timeout);
  }, [verifying]);

  useEffect(() => {
    const verifyAuth = async () => {
      // Removed console.log for production

      if (loading) return;

      // Silent token refresh if expiring soon
      const currentToken = accessToken || token;
      if (currentToken) {
        const expiration = getTokenExpiration(currentToken);
        if (expiration) {
          const timeUntilExpiry = expiration.getTime() - Date.now();
          if (timeUntilExpiry > 0 && timeUntilExpiry < SILENT_REFRESH_THRESHOLD_MS) {
            await refreshAuthToken();
          }
        }
      }

      // Allow access to welcome page even without full auth (for post-signup flow)
      const isWelcomePage = location.pathname.includes('/welcome');
      
        if (!token || !admin || !tenant) {
        // Allow welcome page for new signups (they may not be logged in yet)
        if (isWelcomePage && tenantSlug) {
          setVerifying(false);
          return;
        }
        
        setVerifying(false); // Always set verifying to false before redirect
        if (tenantSlug) {
          navigate(`/${tenantSlug}/admin/login`, { replace: true });
        } else {
          navigate("/marketing", { replace: true });
        }
        return;
      }

      // Verify tenant slug matches (auth context should have already handled this)
      if (tenantSlug && tenant.slug !== tenantSlug) {
        setVerifying(false); // Always set verifying to false before redirect
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
        
        // Add timeout to prevent hanging
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
        
        const response = await apiFetch(`${supabaseUrl}/functions/v1/tenant-admin-auth?action=verify`, {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${tokenToUse}`,
          },
          skipAuth: true,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error("Token verification failed");
        }

        const data = await response.json();
        
        // Ensure we have the expected data structure
        if (!data || !data.tenant) {
          throw new Error("Invalid response from server");
        }
        
        // Check if trial has expired
        if (tenant.subscription_status === "trial" && (tenant as any).trial_ends_at) {
          const trialEnds = new Date((tenant as any).trial_ends_at);
          const now = new Date();
          
          if (now > trialEnds) {
            // Allow access to billing and trial-expired pages only
            const currentPath = window.location.pathname;
            if (!currentPath.includes('/billing') && !currentPath.includes('/trial-expired')) {
              setVerifying(false);
              navigate(`/${tenantSlug}/admin/trial-expired`, { replace: true });
              return;
            }
          }
        }
        
        // Verify tenant is still active or in trial
        if (data.tenant && (data.tenant.subscription_status === "active" || data.tenant.subscription_status === "trial" || data.tenant.subscription_status === "trialing")) {
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
            setVerifying(false);
            navigate(`/${tenantSlug}/admin/trial-expired`, { replace: true });
            return;
          }

          setVerifying(false);
        } else {
          throw new Error("Tenant subscription is not active");
        }
      } catch (error) {
        console.error("Auth verification error:", error);
        setVerifying(false); // Always set verifying to false on error
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

