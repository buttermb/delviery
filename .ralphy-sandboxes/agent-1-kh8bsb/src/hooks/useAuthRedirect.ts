import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSuperAdminAuth } from "@/contexts/SuperAdminAuthContext";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import { useCustomerAuth } from "@/contexts/CustomerAuthContext";
import { intendedDestinationUtils } from "@/hooks/useIntendedDestination";

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
    // Only consume intended destination when we have an authenticated user to redirect
    if (superAdmin) {
      const intended = intendedDestinationUtils.consume();
      navigate(intended || "/super-admin/dashboard", { replace: true });
    } else if (admin && tenant && isTenantAuthenticated) {
      const intended = intendedDestinationUtils.consume();
      navigate(intended || `/${tenant.slug}/admin/dashboard`, { replace: true });
    } else if (customer && customerTenant) {
      const intended = intendedDestinationUtils.consume();
      navigate(intended || `/${customerTenant.slug}/shop`, { replace: true });
    }
  }, [superAdmin, admin, tenant, customer, customerTenant, superAdminLoading, tenantAdminLoading, customerLoading, isTenantAuthenticated, navigate]);
}

