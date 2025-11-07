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
  const [verifying, setVerifying] = useState(false); // CRITICAL FIX: Start as false, not true
  const lastRedirectTime = useRef<number>(0);
  const verifyAttempted = useRef(false);
  const redirectCount = useRef<number>(0);
  const redirectWindowStart = useRef<number>(0);

  // Safety timeout: if verification takes too long, stop showing loading
  useEffect(() => {
    if (!verifying) return;
    
    const timeout = setTimeout(() => {
      if (verifying) {
        logger.warn("Auth verification timeout - stopping verification", undefined, 'SuperAdminProtectedRoute');
        setVerifying(false);
      }
    }, 10000); // 10 second timeout

    return () => clearTimeout(timeout);
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
        logger.warn("Redirect limit exceeded - preventing further redirects to avoid loop", undefined, 'SuperAdminProtectedRoute');
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

      // If not authenticated, don't verify - let the redirect happen
      if (!token || !superAdmin) {
        setVerifying(false);
        lastRedirectTime.current = Date.now();
        redirectCount.current += 1;
        navigate("/super-admin/login", { replace: true });
        return;
      }

      // Skip if already checking
      if (verifying) {
        verifyAttempted.current = false;
        return;
      }

      // Lock verification to prevent concurrent requests
      setVerifying(true);

      // Verify token is still valid
      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const response = await apiFetch(`${supabaseUrl}/functions/v1/super-admin-auth?action=verify`, {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${token}`,
          },
          skipAuth: true,
        });

        if (!response.ok) {
          throw new Error("Token verification failed");
        }

        const data = await response.json();
        
        // Ensure we have the expected data structure
        if (!data || !data.superAdmin) {
          throw new Error("Invalid response from server");
        }

        setVerifying(false);
        verifyAttempted.current = false;
      } catch (error) {
        logger.error("Auth verification error", error, 'SuperAdminProtectedRoute');
        setVerifying(false);
        lastRedirectTime.current = Date.now();
        redirectCount.current += 1;
        navigate("/super-admin/login", { replace: true });
        verifyAttempted.current = false;
      }
    };

    verifyAuth();
  }, [token, superAdmin, loading, navigate]);

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

  if (!token || !superAdmin) {
    return null; // Will redirect
  }

  return <>{children}</>;
}

