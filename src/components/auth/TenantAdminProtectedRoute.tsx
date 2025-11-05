import { ReactNode, useEffect, useState, useRef } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import { getTokenExpiration } from "@/lib/auth/jwt";
import { Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/utils/apiClient";
import { logger } from "@/lib/logger";

// Refresh token if it expires within 10 minutes
const SILENT_REFRESH_THRESHOLD_MS = 10 * 60 * 1000;
// Prevent redirect loops - don't redirect more than once per 3 seconds
const REDIRECT_THROTTLE_MS = 3000;
// Maximum number of redirects in a short period
const MAX_REDIRECTS_PER_WINDOW = 3;
const REDIRECT_WINDOW_MS = 10000; // 10 seconds

interface TenantAdminProtectedRouteProps {
  children: ReactNode;
}

export function TenantAdminProtectedRoute({ children }: TenantAdminProtectedRouteProps) {
  const { admin, tenant, token, accessToken, loading, refreshAuthToken } = useTenantAdminAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const [verifying, setVerifying] = useState(true);
  const lastRedirectTime = useRef<number>(0);
  const verifyAttempted = useRef(false);
  const redirectCount = useRef<number>(0);
  const redirectWindowStart = useRef<number>(0);

  // Safety timeout: if verification takes too long, stop showing loading (reduced from 10s to 5s)
  useEffect(() => {
    if (verifying) {
      const timeout = setTimeout(() => {
        logger.warn("Verification timeout exceeded, allowing navigation", { component: 'TenantAdminProtectedRoute' });
        setVerifying(false);
      }, 5000); // 5 second timeout (reduced for faster failure)

      return () => clearTimeout(timeout);
    }
  }, [verifying]);

  useEffect(() => {
    const verifyAuth = async () => {
      // Prevent multiple verification attempts
      if (verifyAttempted.current) return;
      verifyAttempted.current = true;

      if (loading) {
        verifyAttempted.current = false;
        return;
      }

      // Enhanced redirect throttling to prevent loops
      const now = Date.now();
      const timeSinceLastRedirect = now - lastRedirectTime.current;
      
      // Reset redirect count if window has passed
      if (now - redirectWindowStart.current > REDIRECT_WINDOW_MS) {
        redirectCount.current = 0;
        redirectWindowStart.current = now;
      }
      
      // Check if we've exceeded max redirects in window
      if (redirectCount.current >= MAX_REDIRECTS_PER_WINDOW) {
        console.warn("Redirect limit exceeded - preventing further redirects to avoid loop");
        setVerifying(false);
        verifyAttempted.current = false;
        return;
      }
      
      // Throttle individual redirects
      if (timeSinceLastRedirect < REDIRECT_THROTTLE_MS) {
        setVerifying(false);
        verifyAttempted.current = false;
        return;
      }

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
        lastRedirectTime.current = Date.now();
        redirectCount.current += 1;
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
        lastRedirectTime.current = Date.now();
        redirectCount.current += 1;
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
        
        // Add timeout to prevent hanging (reduced to 3 seconds for faster failure)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          controller.abort();
          setVerifying(false); // Ensure we exit verifying state on timeout
        }, 3000); // 3 second timeout
        
        let response;
        try {
          response = await apiFetch(`${supabaseUrl}/functions/v1/tenant-admin-auth?action=verify`, {
            method: "GET",
            headers: {
              "Authorization": `Bearer ${tokenToUse}`,
            },
            skipAuth: true,
            signal: controller.signal,
          });
        } catch (error: any) {
          clearTimeout(timeoutId);
          // If request is aborted or fails, don't block navigation
          if (error.name === 'AbortError' || error.message?.includes('aborted')) {
            logger.warn('Token verification timeout', error, { component: 'TenantAdminProtectedRoute' });
            // Allow navigation to proceed - user might have valid token in localStorage
            setVerifying(false);
            return;
          }
          throw error;
        }

        clearTimeout(timeoutId);

        if (!response.ok) {
          // If verification fails, don't block - let the auth context handle it
          logger.warn('Token verification failed', { status: response.status }, { component: 'TenantAdminProtectedRoute' });
          setVerifying(false);
          return;
        }

        let data;
        try {
          data = await response.json();
        } catch (error) {
          logger.error('Failed to parse verification response', error, { component: 'TenantAdminProtectedRoute' });
          setVerifying(false);
          return;
        }
        
        // Ensure we have the expected data structure
        if (!data || !data.tenant) {
          logger.warn('Invalid verification response structure', { data }, { component: 'TenantAdminProtectedRoute' });
          // Don't block navigation - proceed with existing tenant data
          setVerifying(false);
          return;
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
              lastRedirectTime.current = Date.now();
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
            lastRedirectTime.current = Date.now();
            navigate(`/${tenantSlug}/admin/trial-expired`, { replace: true });
            return;
          }

          setVerifying(false);
        } else {
          throw new Error("Tenant subscription is not active");
        }
      } catch (error) {
        logger.error("Auth verification error", error, { component: 'TenantAdminProtectedRoute' });
        setVerifying(false); // Always set verifying to false on error
        lastRedirectTime.current = Date.now();
        redirectCount.current += 1;
        if (tenantSlug) {
          navigate(`/${tenantSlug}/admin/login`, { replace: true });
        } else {
          navigate("/marketing", { replace: true });
        }
      } finally {
        verifyAttempted.current = false;
      }
    };

    verifyAuth();
  }, [token, admin, tenant, tenantSlug, loading, navigate]); // Removed location.pathname to prevent re-runs on navigation

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

