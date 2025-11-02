import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { clearAllAuthTokens, getCurrentUserType } from "@/lib/utils/authHelpers";
import { toast } from "@/hooks/use-toast";

/**
 * Hook to handle authentication errors globally
 * Redirects to appropriate login page on auth failures
 */
export function useAuthError() {
  const navigate = useNavigate();

  useEffect(() => {
    const handleAuthError = (event: CustomEvent) => {
      const error = event.detail as { message: string; code?: string };
      
      // Check if it's an auth-related error
      if (
        error.message.includes("token") ||
        error.message.includes("auth") ||
        error.message.includes("unauthorized") ||
        error.message.includes("expired") ||
        error.code === "UNAUTHORIZED" ||
        error.code === "TOKEN_EXPIRED"
      ) {
        const userType = getCurrentUserType();
        clearAllAuthTokens();

        toast({
          variant: "destructive",
          title: "Session Expired",
          description: "Please log in again to continue",
        });

        // Redirect based on user type
        if (userType === "super_admin") {
          navigate("/super-admin/login", { replace: true });
        } else if (userType === "tenant_admin") {
          // Try to get tenant slug from URL
          const pathMatch = window.location.pathname.match(/^\/([^/]+)\/admin/);
          const tenantSlug = pathMatch ? pathMatch[1] : null;
          navigate(tenantSlug ? `/${tenantSlug}/admin/login` : "/marketing", { replace: true });
        } else if (userType === "customer") {
          const pathMatch = window.location.pathname.match(/^\/([^/]+)\/shop/);
          const tenantSlug = pathMatch ? pathMatch[1] : null;
          navigate(tenantSlug ? `/${tenantSlug}/shop/login` : "/shop/login", { replace: true });
        } else {
          navigate("/", { replace: true });
        }
      }
    };

    // Listen for custom auth error events
    window.addEventListener("auth-error" as any, handleAuthError as EventListener);

    return () => {
      window.removeEventListener("auth-error" as any, handleAuthError as EventListener);
    };
  }, [navigate]);
}

/**
 * Emit an auth error event
 */
export function emitAuthError(error: { message: string; code?: string }) {
  const event = new CustomEvent("auth-error", { detail: error });
  window.dispatchEvent(event);
}

