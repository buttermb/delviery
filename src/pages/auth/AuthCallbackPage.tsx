import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { intendedDestinationUtils } from "@/hooks/useIntendedDestination";
import { Button } from "@/components/ui/button";
import { STORAGE_KEYS } from "@/constants/storageKeys";

type AuthPortal = "tenant-admin" | "super-admin" | "customer";

interface AuthCallbackPageProps {
  portal: AuthPortal;
}

export function AuthCallbackPage({ portal }: AuthCallbackPageProps) {
  const navigate = useNavigate();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<"loading" | "success" | "error" | "loop_detected">("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    // Check for redirect loop
    const checkLoop = () => {
      try {
        const key = 'auth_redirect_timestamps';
        const now = Date.now();
        const timestampsStr = sessionStorage.getItem(key);
        let timestamps: number[] = timestampsStr ? JSON.parse(timestampsStr) : [];

        // Filter out timestamps older than 10 seconds
        timestamps = timestamps.filter(t => now - t < 10000);

        // Add current timestamp
        timestamps.push(now);
        sessionStorage.setItem(key, JSON.stringify(timestamps));

        if (timestamps.length >= 3) {
          logger.warn("Redirect loop detected", { timestamps });
          return true;
        }
        return false;
      } catch {
        return false;
      }
    };

    if (checkLoop()) {
      setStatus("loop_detected");
      return;
    }

    const handleCallback = async () => {
      try {
        // Get the session from the URL hash (Supabase OAuth callback)
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          throw sessionError;
        }

        if (!session) {
          // Try to exchange the code for a session
          const code = searchParams.get("code");
          if (code) {
            const { data, error } = await supabase.auth.exchangeCodeForSession(code);
            if (error) throw error;
            if (!data.session) throw new Error("No session returned from code exchange");
          } else {
            throw new Error("No authentication session found");
          }
        }

        // Check MFA status
        const { data: aalData, error: aalError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

        if (aalError) {
          logger.warn("Failed to check AAL level", aalError);
        }

        // If MFA is required but not yet verified, redirect to MFA challenge
        if (aalData && aalData.currentLevel === "aal1" && aalData.nextLevel === "aal2") {
          logger.info("MFA verification required after OAuth login");
          setStatus("success");

          // Clear redirect timestamps on success
          sessionStorage.removeItem('auth_redirect_timestamps');

          // Redirect to MFA challenge page based on portal
          timers.push(setTimeout(() => {
            switch (portal) {
              case "tenant-admin":
                navigate(`/${tenantSlug}/admin/auth/mfa-challenge`, { replace: true });
                break;
              case "super-admin":
                navigate("/super-admin/auth/mfa-challenge", { replace: true });
                break;
              case "customer":
                navigate(`/${tenantSlug}/customer/auth/mfa-challenge`, { replace: true });
                break;
            }
          }, 1000));
          return;
        }

        // Success - redirect to intended destination or dashboard
        setStatus("success");
        // Clear redirect timestamps on success
        sessionStorage.removeItem('auth_redirect_timestamps');

        toast.success("Welcome!", {
          description: "You've been signed in with Google.",
        });

        // Check for intended destination (user tried to access a protected page before OAuth login)
        const intendedDestination = intendedDestinationUtils.consume();

        timers.push(setTimeout(() => {
          // If there's an intended destination, use it (only for matching portal type)
          if (intendedDestination) {
            // Validate the intended destination matches the current portal context
            const isValidDestination =
              (portal === "tenant-admin" && intendedDestination.includes('/admin/')) ||
              (portal === "super-admin" && intendedDestination.includes('/super-admin/')) ||
              (portal === "customer" && (intendedDestination.includes('/shop/') || intendedDestination.includes('/customer/')));

            if (isValidDestination) {
              logger.debug('[AuthCallback] Redirecting to intended destination', { intendedDestination, portal });
              navigate(intendedDestination, { replace: true });
              return;
            }
            logger.debug('[AuthCallback] Intended destination does not match portal, using default', { intendedDestination, portal });
          }

          // Default redirects based on portal type
          switch (portal) {
            case "tenant-admin":
              navigate(`/${tenantSlug}/admin/dashboard`, { replace: true });
              break;
            case "super-admin":
              navigate("/super-admin/dashboard", { replace: true });
              break;
            case "customer":
              navigate(`/${tenantSlug}/shop/dashboard`, { replace: true });
              break;
          }
        }, 1000));
      } catch (error) {
        logger.error("Auth callback error", error, { component: "AuthCallbackPage", portal });
        setStatus("error");
        setErrorMessage(error instanceof Error ? error.message : "Authentication failed");

        toast.error("Authentication failed", {
          description: error instanceof Error ? error.message : "Please try again",
        });

        // Redirect back to login after a delay
        timers.push(setTimeout(() => {
          switch (portal) {
            case "tenant-admin":
              navigate('/saas/login', { replace: true });
              break;
            case "super-admin":
              navigate("/super-admin/login", { replace: true });
              break;
            case "customer":
              navigate(`/${tenantSlug}/customer/login`, { replace: true });
              break;
          }
        }, 3000));
      }
    };

    handleCallback();
    return () => timers.forEach(t => clearTimeout(t));
  }, [navigate, portal, tenantSlug, searchParams]);

  const handleManualReset = async () => {
    // Clear all sessions and storage
    await supabase.auth.signOut();
    sessionStorage.clear();
    localStorage.removeItem(STORAGE_KEYS.SUPABASE_AUTH_TOKEN); // Attempt to clear persisted token

    const loginUrl = portal === "tenant-admin"
      ? '/saas/login'
      : portal === "super-admin"
        ? "/super-admin/login"
        : `/${tenantSlug}/customer/login`;

    window.location.href = loginUrl;
  };

  return (
    <div className="min-h-dvh flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="text-center space-y-6 p-8">
        {status === "loading" && (
          <>
            <Loader2 className="h-16 w-16 animate-spin text-primary mx-auto" />
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold text-white">Completing sign in...</h2>
              <p className="text-slate-400">Please wait while we verify your credentials</p>
            </div>
          </>
        )}

        {status === "loop_detected" && (
          <>
            <XCircle className="h-16 w-16 text-yellow-500 mx-auto" />
            <div className="space-y-4">
              <div className="space-y-2">
                <h2 className="text-2xl font-semibold text-white">Login Issue Detected</h2>
                <p className="text-slate-400">We detected too many redirect attempts.</p>
                <p className="text-slate-500 text-sm">Please try clearing your session manually.</p>
              </div>
              <Button
                onClick={handleManualReset}
                variant="destructive"
                className="w-full"
              >
                Clear Session & Retry Login
              </Button>
            </div>
          </>
        )}

        {status === "success" && (
          <>
            <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto" />
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold text-white">Success!</h2>
              <p className="text-slate-400">Redirecting you to your dashboard...</p>
            </div>
          </>
        )}

        {status === "error" && (
          <>
            <XCircle className="h-16 w-16 text-red-500 mx-auto" />
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold text-white">Authentication Failed</h2>
              <p className="text-slate-400">{errorMessage || "Please try again"}</p>
              <p className="text-slate-500 text-sm">Redirecting back to login...</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Export pre-configured versions for each portal
export function TenantAdminAuthCallback() {
  return <AuthCallbackPage portal="tenant-admin" />;
}

export function SuperAdminAuthCallback() {
  return <AuthCallbackPage portal="super-admin" />;
}

export function CustomerAuthCallback() {
  return <AuthCallbackPage portal="customer" />;
}

