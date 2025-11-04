import { ReactNode, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSuperAdminAuth } from "@/contexts/SuperAdminAuthContext";
import { Loader2 } from "lucide-react";

interface SuperAdminProtectedRouteProps {
  children: ReactNode;
}

export function SuperAdminProtectedRoute({ children }: SuperAdminProtectedRouteProps) {
  const { superAdmin, token, loading, refreshToken } = useSuperAdminAuth();
  const navigate = useNavigate();
  const [verifying, setVerifying] = useState(true);

  useEffect(() => {
    const verifyAuth = async () => {
      if (loading) return;

      if (!token || !superAdmin) {
        navigate("/super-admin/login", { replace: true });
        return;
      }

      // Verify token is still valid
      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const response = await window.fetch(`${supabaseUrl}/functions/v1/super-admin-auth?action=verify`, {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          throw new Error("Token verification failed");
        }

        setVerifying(false);
      } catch (error) {
        console.error("Auth verification error:", error);
        navigate("/super-admin/login", { replace: true });
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

