import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";

type AuthPortal = "tenant-admin" | "super-admin" | "customer";

interface AuthCallbackPageProps {
  portal: AuthPortal;
}

export function AuthCallbackPage({ portal }: AuthCallbackPageProps) {
  const navigate = useNavigate();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
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
          
          // Redirect to MFA challenge page based on portal
          setTimeout(() => {
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
          }, 1000);
          return;
        }

        // Success - redirect to dashboard
        setStatus("success");
        toast({
          title: "Welcome!",
          description: "You've been signed in with Google.",
        });

        setTimeout(() => {
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
        }, 1000);
      } catch (error) {
        logger.error("Auth callback error", error, { component: "AuthCallbackPage", portal });
        setStatus("error");
        setErrorMessage(error instanceof Error ? error.message : "Authentication failed");
        
        toast({
          variant: "destructive",
          title: "Authentication failed",
          description: error instanceof Error ? error.message : "Please try again",
        });

        // Redirect back to login after a delay
        setTimeout(() => {
          switch (portal) {
            case "tenant-admin":
              navigate(`/${tenantSlug}/admin/login`, { replace: true });
              break;
            case "super-admin":
              navigate("/super-admin/login", { replace: true });
              break;
            case "customer":
              navigate(`/${tenantSlug}/customer/login`, { replace: true });
              break;
          }
        }, 3000);
      }
    };

    handleCallback();
  }, [navigate, portal, tenantSlug, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
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

