import { logger } from '@/lib/logger';
import { useMemo } from "react";
import { Navigate } from "react-router-dom";
import { getCurrentUserType } from "@/lib/utils/authHelpers";
import { STORAGE_KEYS } from "@/constants/storageKeys";

export function SmartRootRedirect() {
  const redirectPath = useMemo(() => {
    try {
      const userType = getCurrentUserType();
      if (!userType) return "/marketing";
      if (userType === "super_admin") return "/super-admin/dashboard";
      if (userType === "courier") return "/courier/dashboard";

      if (userType === "tenant_admin") {
        const tenantData = localStorage.getItem(STORAGE_KEYS.TENANT_DATA);
        if (!tenantData) return "/marketing";
        try {
          const tenant = JSON.parse(tenantData) as { slug?: string };
          return tenant.slug ? `/${tenant.slug}/admin/dashboard` : "/marketing";
        } catch {
          return "/marketing";
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

      return "/marketing";
    } catch (error) {
      logger.error("Error checking auth", error as Error, { component: 'SmartRootRedirect' });
      return "/marketing";
    }
  }, []);

  return <Navigate to={redirectPath} replace />;
}
