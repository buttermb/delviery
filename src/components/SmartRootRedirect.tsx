import { useEffect, useState, useRef } from "react";
import { Navigate } from "react-router-dom";
import { LoadingFallback } from "./LoadingFallback";
import { getCurrentUserType } from "@/lib/utils/authHelpers";
import { logger } from "@/utils/logger";

export function SmartRootRedirect() {
  const [checking, setChecking] = useState(true);
  const [redirectPath, setRedirectPath] = useState<string | null>(null);
  const hasChecked = useRef(false);

  useEffect(() => {
    // Prevent multiple checks
    if (hasChecked.current) return;
    hasChecked.current = true;

    const checkAuthAndRedirect = () => {
      try {
        const userType = getCurrentUserType();

        if (!userType) {
          // Not authenticated, go to marketing page
          setRedirectPath("/marketing");
          setChecking(false);
          return;
        }

        // Check super admin
        if (userType === "super_admin") {
          setRedirectPath("/super-admin/dashboard");
          setChecking(false);
          return;
        }

        // Check tenant admin
        if (userType === "tenant_admin") {
          const tenantData = localStorage.getItem("tenant_data");
          if (tenantData) {
            try {
              const tenant = JSON.parse(tenantData);
              setRedirectPath(`/${tenant.slug}/admin/dashboard`);
            } catch {
              setRedirectPath("/marketing");
            }
          } else {
            setRedirectPath("/marketing");
          }
          setChecking(false);
          return;
        }

        // Check courier
        if (userType === "courier") {
          setRedirectPath("/courier/dashboard");
          setChecking(false);
          return;
        }

        // Check customer
        if (userType === "customer") {
          const tenantData = localStorage.getItem("customer_tenant_data");
          if (tenantData) {
            try {
              const tenant = JSON.parse(tenantData);
              setRedirectPath(`/${tenant.slug}/shop`);
            } catch {
              setRedirectPath("/shop");
            }
          } else {
            setRedirectPath("/shop");
          }
          setChecking(false);
          return;
        }

        // Fallback
        setRedirectPath("/marketing");
        setChecking(false);
      } catch (error) {
        logger.error("Error checking auth", error as Error, { component: 'SmartRootRedirect' });
        setRedirectPath("/marketing");
        setChecking(false);
      }
    };

    checkAuthAndRedirect();
  }, []);

  if (checking) {
    return <LoadingFallback />;
  }

  return <Navigate to={redirectPath || "/marketing"} replace />;
}
