import { ReactNode, useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useSuperAdminAuth } from "@/contexts/SuperAdminAuthContext";
import { Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/utils/apiClient";

// Prevent redirect loops - don't redirect more than once per 2 seconds
const REDIRECT_THROTTLE_MS = 2000;

interface SuperAdminProtectedRouteProps {
  children: ReactNode;
}

export function SuperAdminProtectedRoute({ children }: SuperAdminProtectedRouteProps) {
  const { superAdmin, token, loading, refreshToken } = useSuperAdminAuth();
  const navigate = useNavigate();
  const [verifying, setVerifying] = useState(true);
  const lastRedirectTime = useRef<number>(0);
  const verifyAttempted = useRef(false);

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
      // Prevent multiple verification attempts
      if (verifyAttempted.current) return;
      verifyAttempted.current = true;

      if (loading) {
        verifyAttempted.current = false;
        return;
      }

      // Throttle redirects to prevent loops
      const now = Date.now();
      const timeSinceLastRedirect = now - lastRedirectTime.current;
      if (timeSinceLastRedirect < REDIRECT_THROTTLE_MS) {
        setVerifying(false);
        verifyAttempted.current = false;
        return;
      }

      if (!token || !superAdmin) {
        setVerifying(false);
        lastRedirectTime.current = Date.now();
        navigate("/super-admin/login", { replace: true });
        return;
      }

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
      } catch (error) {
        console.error("Auth verification error:", error);
        setVerifying(false);
        lastRedirectTime.current = Date.now();
        navigate("/super-admin/login", { replace: true });
      } finally {
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

