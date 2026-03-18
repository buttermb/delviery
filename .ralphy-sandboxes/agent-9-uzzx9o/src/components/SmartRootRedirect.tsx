import { logger } from '@/lib/logger';
import { lazy, Suspense, useMemo } from "react";
import { Navigate } from "react-router-dom";
import { getCurrentUserType } from "@/lib/utils/authHelpers";
import { STORAGE_KEYS } from "@/constants/storageKeys";
import { LoadingFallback } from "./LoadingFallback";

const MarketingHome = lazy(() => import("@/pages/MarketingHome"));

export function SmartRootRedirect() {
  const redirectPath = useMemo<string | null>(() => {
    try {
      const userType = getCurrentUserType();
      if (!userType) return null; // No redirect needed — render marketing inline
      if (userType === "super_admin") return "/super-admin/dashboard";
      if (userType === "courier") return "/courier/dashboard";

      if (userType === "tenant_admin") {
        const tenantData = localStorage.getItem(STORAGE_KEYS.TENANT_DATA);
        if (!tenantData) return null;
        try {
          const tenant = JSON.parse(tenantData) as { slug?: string };
          return tenant.slug ? `/${tenant.slug}/admin/dashboard` : null;
        } catch {
          return null;
        }
      }

      if (userType === "customer") {
        const tenantData = localStorage.getItem(STORAGE_KEYS.CUSTOMER_TENANT_DATA);
        if (!tenantData) return "/shop";
        try {
          const tenant = JSON.parse(tenantData) as { slug?: string };
          return tenant.slug ? `/${tenant.slug}/shop` : "/shop";
        } catch {
          return "/shop";
        }
      }

      return null;
    } catch (error) {
      logger.error("Error checking auth", error as Error, { component: 'SmartRootRedirect' });
      return null;
    }
  }, []);

  // Authenticated users get redirected to their dashboard
  if (redirectPath) {
    return <Navigate to={redirectPath} replace />;
  }

  // Unauthenticated users see marketing page directly (no redirect)
  return (
    <Suspense fallback={<LoadingFallback />}>
      <MarketingHome />
    </Suspense>
  );
}
