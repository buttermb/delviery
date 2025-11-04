import { ReactNode, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useCustomerAuth } from "@/contexts/CustomerAuthContext";
import { Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/utils/apiClient";

interface CustomerProtectedRouteProps {
  children: ReactNode;
}

export function CustomerProtectedRoute({ children }: CustomerProtectedRouteProps) {
  const { customer, tenant, token, loading } = useCustomerAuth();
  const navigate = useNavigate();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const [verifying, setVerifying] = useState(true);

  useEffect(() => {
    const verifyAuth = async () => {
      if (loading) return;

      if (!token || !customer || !tenant) {
        if (tenantSlug) {
          navigate(`/${tenantSlug}/shop/login`, { replace: true });
        } else {
          navigate("/shop/login", { replace: true });
        }
        return;
      }

      // Verify tenant slug matches
      if (tenantSlug && tenant.slug !== tenantSlug) {
        navigate(`/${tenant.slug}/shop/login`, { replace: true });
        return;
      }

      // Verify token is still valid
      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const response = await apiFetch(`${supabaseUrl}/functions/v1/customer-auth?action=verify`, {
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
        
        // Verify customer is still active
        if (data.customer.status !== "active") {
          throw new Error("Account is not active");
        }

        setVerifying(false);
      } catch (error) {
        console.error("Auth verification error:", error);
        if (tenantSlug) {
          navigate(`/${tenantSlug}/shop/login`, { replace: true });
        } else {
          navigate("/shop/login", { replace: true });
        }
      }
    };

    verifyAuth();
  }, [token, customer, tenant, tenantSlug, loading, navigate]);

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

  if (!token || !customer || !tenant) {
    return null; // Will redirect
  }

  return <>{children}</>;
}

