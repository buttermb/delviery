import { ReactNode, useEffect, useState, useRef } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import { getTokenExpiration } from "@/lib/auth/jwt";
import { Loader2, AlertCircle } from "lucide-react";
import { apiFetch } from "@/lib/utils/apiClient";
import { logger } from "@/lib/logger";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

// Refresh token if it expires within 10 minutes
const SILENT_REFRESH_THRESHOLD_MS = 10 * 60 * 1000;
// Prevent redirect loops - don't redirect more than once per 3 seconds
const REDIRECT_THROTTLE_MS = 3000;
// Maximum number of redirects in a short period
const MAX_REDIRECTS_PER_WINDOW = 3;
const REDIRECT_WINDOW_MS = 10000; // 10 seconds
// Maximum verification failures before showing error UI
const MAX_VERIFICATION_FAILURES = 3;
// Verification timeout increased to 8 seconds
const VERIFICATION_TIMEOUT_MS = 8000;
// Network timeout reduced to 2 seconds (edge function is now optimized)
const NETWORK_TIMEOUT_MS = 2000;
// Cache verification results for 2 minutes
const VERIFICATION_CACHE_MS = 2 * 60 * 1000;

interface TenantAdminProtectedRouteProps {
  children: ReactNode;
}

// Cache for verification results to avoid redundant API calls
const verificationCache = new Map<string, { verified: boolean; timestamp: number; tenant: any }>();

const isVerificationCacheValid = (token: string): boolean => {
  const cached = verificationCache.get(token);
  if (!cached) return false;
  return Date.now() - cached.timestamp < VERIFICATION_CACHE_MS;
};

export function TenantAdminProtectedRoute({ children }: TenantAdminProtectedRouteProps) {
  const { admin, tenant, token, accessToken, loading, refreshAuthToken } = useTenantAdminAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const [verifying, setVerifying] = useState(true);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [failureCount, setFailureCount] = useState(0);
  const lastRedirectTime = useRef<number>(0);
  const verifyAttempted = useRef(false);
  const redirectCount = useRef<number>(0);
  const redirectWindowStart = useRef<number>(0);

  // Safety timeout: if verification takes too long, handle as failure
  useEffect(() => {
    if (verifying && !verificationError) {
      const timeout = setTimeout(() => {
        logger.error("Verification timeout exceeded", { 
          component: 'TenantAdminProtectedRoute',
          timeout: VERIFICATION_TIMEOUT_MS,
          failureCount: failureCount + 1
        });
        setVerifying(false);
        setFailureCount(prev => prev + 1);
        
        if (failureCount + 1 >= MAX_VERIFICATION_FAILURES) {
          setVerificationError("Authentication verification timed out. Please try logging in again.");
        }
      }, VERIFICATION_TIMEOUT_MS);

      return () => clearTimeout(timeout);
    }
  }, [verifying, verificationError, failureCount]);

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
        logger.error("Redirect limit exceeded", { 
          component: 'TenantAdminProtectedRoute',
          redirectCount: redirectCount.current,
          windowMs: REDIRECT_WINDOW_MS
        });
        setVerifying(false);
        setFailureCount(prev => prev + 1);
        
        if (failureCount + 1 >= MAX_VERIFICATION_FAILURES) {
          setVerificationError("Too many redirect attempts. Please clear your browser cache and try again.");
        }
        
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
          logger.info("Allowing access to welcome page", { component: 'TenantAdminProtectedRoute' });
          setVerifying(false);
          return;
        }
        
        logger.warn("Missing authentication credentials", { 
          component: 'TenantAdminProtectedRoute',
          hasToken: !!token,
          hasAdmin: !!admin,
          hasTenant: !!tenant,
          failureCount: failureCount + 1
        });
        
        setVerifying(false);
        setFailureCount(prev => prev + 1);
        lastRedirectTime.current = Date.now();
        redirectCount.current += 1;
        
        if (failureCount + 1 >= MAX_VERIFICATION_FAILURES) {
          setVerificationError("Unable to verify authentication. Please log in again.");
          return;
        }
        
        if (tenantSlug) {
          navigate(`/${tenantSlug}/admin/login`, { replace: true });
        } else {
          navigate("/marketing", { replace: true });
        }
        return;
      }

      // Verify tenant slug matches (auth context should have already handled this)
      if (tenantSlug && tenant.slug !== tenantSlug) {
        logger.warn("Tenant slug mismatch", {
          component: 'TenantAdminProtectedRoute',
          expectedSlug: tenantSlug,
          actualSlug: tenant.slug
        });
        setVerifying(false);
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

        // Check cache first to avoid redundant API calls
        if (isVerificationCacheValid(tokenToUse)) {
          const cached = verificationCache.get(tokenToUse);
          logger.info('Using cached verification result', { 
            component: 'TenantAdminProtectedRoute',
            tenant: cached?.tenant?.business_name 
          });
          setVerifying(false);
          return;
        }
        
        // Reduced timeout to 2 seconds (edge function is now optimized)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          controller.abort();
          setVerifying(false);
        }, NETWORK_TIMEOUT_MS);
        
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
            logger.error('Token verification network timeout', error, { 
              component: 'TenantAdminProtectedRoute',
              failureCount: failureCount + 1,
              timeout: 3000
            });
            setVerifying(false);
            setFailureCount(prev => prev + 1);
            
            if (failureCount + 1 >= MAX_VERIFICATION_FAILURES) {
              setVerificationError("Network timeout while verifying authentication. Please check your connection and try again.");
            }
            return;
          }
          throw error;
        }

        clearTimeout(timeoutId);

        if (!response.ok) {
          logger.error('Token verification failed', { 
            component: 'TenantAdminProtectedRoute',
            status: response.status,
            statusText: response.statusText,
            failureCount: failureCount + 1
          });
          setVerifying(false);
          setFailureCount(prev => prev + 1);
          
          if (failureCount + 1 >= MAX_VERIFICATION_FAILURES) {
            setVerificationError(`Authentication verification failed (${response.status}). Please log in again.`);
          }
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
          
          // Cache successful verification
          verificationCache.set(tokenToUse, {
            verified: true,
            timestamp: Date.now(),
            tenant: data.tenant
          });
          
          logger.info('Verification successful, cached result', {
            component: 'TenantAdminProtectedRoute',
            tenant: data.tenant?.business_name
          });
        } else {
          throw new Error("Tenant subscription is not active");
        }
      } catch (error: any) {
        logger.error("Auth verification error", error, { 
          component: 'TenantAdminProtectedRoute',
          errorMessage: error?.message,
          errorStack: error?.stack,
          failureCount: failureCount + 1
        });
        setVerifying(false);
        setFailureCount(prev => prev + 1);
        lastRedirectTime.current = Date.now();
        redirectCount.current += 1;
        
        if (failureCount + 1 >= MAX_VERIFICATION_FAILURES) {
          setVerificationError(`Authentication error: ${error?.message || 'Unknown error'}. Please log in again.`);
          return;
        }
        
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

  // Show error UI if max failures reached
  if (verificationError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertCircle className="h-6 w-6 text-destructive" />
              <CardTitle>Authentication Error</CardTitle>
            </div>
            <CardDescription>
              We encountered an issue verifying your authentication
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">{verificationError}</p>
            <div className="flex flex-col gap-2">
              <Button
                onClick={() => {
                  setVerificationError(null);
                  setFailureCount(0);
                  setVerifying(true);
                  verifyAttempted.current = false;
                }}
              >
                Try Again
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  if (tenantSlug) {
                    navigate(`/${tenantSlug}/admin/login`, { replace: true });
                  } else {
                    navigate("/marketing", { replace: true });
                  }
                }}
              >
                Return to Login
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading || verifying) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-2">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Verifying access...</p>
          {failureCount > 0 && (
            <p className="text-xs text-muted-foreground">
              Attempt {failureCount + 1} of {MAX_VERIFICATION_FAILURES}
            </p>
          )}
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

