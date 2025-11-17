import { ReactNode, useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useSuperAdminAuth } from "@/contexts/SuperAdminAuthContext";
import { Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/utils/apiClient";
import { logger } from "@/utils/logger";

// Prevent redirect loops - don't redirect more than once per 3 seconds
const REDIRECT_THROTTLE_MS = 3000;
const MAX_REDIRECTS_PER_WINDOW = 3;
const REDIRECT_WINDOW_MS = 10000;

interface SuperAdminProtectedRouteProps {
  children: ReactNode;
}

export function SuperAdminProtectedRoute({ children }: SuperAdminProtectedRouteProps) {
  const { superAdmin, token, loading, refreshToken } = useSuperAdminAuth();
  const navigate = useNavigate();
  const lastRedirectTime = useRef<number>(0);
  const redirectCount = useRef<number>(0);
  const redirectWindowStart = useRef<number>(0);

  // Remove duplicate verification - auth context handles all verification
  useEffect(() => {
    // Only handle redirection, not verification
    if (!loading && (!token || !superAdmin)) {
      const now = Date.now();
      const timeSinceLastRedirect = now - lastRedirectTime.current;
      
      // Reset redirect count if window has passed
      if (now - redirectWindowStart.current > REDIRECT_WINDOW_MS) {
        redirectCount.current = 0;
        redirectWindowStart.current = now;
      }
      
      // Check if we've exceeded max redirects in window
      if (redirectCount.current >= MAX_REDIRECTS_PER_WINDOW) {
        logger.warn("Redirect limit exceeded - preventing further redirects to avoid loop", undefined, 'SuperAdminProtectedRoute');
        return;
      }
      
      // Throttle individual redirects
      if (timeSinceLastRedirect < REDIRECT_THROTTLE_MS) {
        return;
      }

      lastRedirectTime.current = Date.now();
      redirectCount.current += 1;
      navigate("/super-admin/login", { replace: true });
    }
  }, [token, superAdmin, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Verifying access...</p>
        </div>
      </div>
    );
  }

  if (!token || !superAdmin) {
    return null; // Will redirect
  }

  return <>{children}</>;
}

