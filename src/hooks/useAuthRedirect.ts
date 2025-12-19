import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSuperAdminAuth } from "@/contexts/SuperAdminAuthContext";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import { useCustomerAuth } from "@/contexts/CustomerAuthContext";
import { getDashboardUrl } from "@/lib/utils/authHelpers";

/**
 * Hook to automatically redirect authenticated users to their dashboard
 * Useful for login pages to redirect if already logged in
 */
export function useAuthRedirect() {
  const navigate = useNavigate();
  const { superAdmin, loading: superAdminLoading } = useSuperAdminAuth();
  const { admin, tenant, loading: tenantAdminLoading, isAuthenticated: isTenantAuthenticated } = useTenantAdminAuth();
  const { customer, tenant: customerTenant, loading: customerLoading } = useCustomerAuth();

  useEffect(() => {
    // Wait for all auth contexts to finish loading
    if (superAdminLoading || tenantAdminLoading || customerLoading) return;

    // Redirect based on which user type is authenticated (priority order matters)
    if (superAdmin) {
      navigate("/super-admin/dashboard", { replace: true });
    } else if (admin && tenant && isTenantAuthenticated) {
      navigate(`/${tenant.slug}/admin`, { replace: true });
    } else if (customer && customerTenant) {
      navigate(`/${customerTenant.slug}/shop`, { replace: true });
    }
  }, [superAdmin, admin, tenant, customer, customerTenant, superAdminLoading, tenantAdminLoading, customerLoading, isTenantAuthenticated, navigate]);
}

