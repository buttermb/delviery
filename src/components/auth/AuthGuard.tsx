import { ReactNode, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSuperAdminAuth } from "@/contexts/SuperAdminAuthContext";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import { useCustomerAuth } from "@/contexts/CustomerAuthContext";
import { getLoginUrl, getCurrentUserType } from "@/lib/utils/authHelpers";

interface AuthGuardProps {
  children: ReactNode;
  requireAuth?: boolean;
  allowedUserTypes?: ("super_admin" | "tenant_admin" | "customer")[];
  redirectTo?: string;
}

/**
 * Universal Auth Guard Component
 * Protects routes and redirects based on authentication status and user type
 */
export function AuthGuard({
  children,
  requireAuth = true,
  allowedUserTypes,
  redirectTo,
}: AuthGuardProps) {
  const navigate = useNavigate();
  const { superAdmin, loading: superAdminLoading } = useSuperAdminAuth();
  const { admin, tenant, loading: tenantAdminLoading } = useTenantAdminAuth();
  const { customer, loading: customerLoading } = useCustomerAuth();

  const userType = getCurrentUserType();
  const isLoading = superAdminLoading || tenantAdminLoading || customerLoading;

  useEffect(() => {
    if (isLoading) return;

    // If auth is required but user is not logged in
    if (requireAuth && !userType) {
      const loginUrl = redirectTo || getLoginUrl("tenant_admin"); // Default to tenant admin
      navigate(loginUrl, { replace: true });
      return;
    }

    // If user is logged in but user type is not allowed
    if (requireAuth && userType && allowedUserTypes && !allowedUserTypes.includes(userType)) {
      // Redirect to their appropriate dashboard
      const dashboardUrl = userType === "super_admin"
        ? "/super-admin/dashboard"
        : userType === "tenant_admin"
        ? `/${tenant?.slug}/admin/dashboard`
        : `/${tenant?.slug}/shop/dashboard`;
      
      navigate(dashboardUrl || "/", { replace: true });
      return;
    }
  }, [isLoading, requireAuth, userType, allowedUserTypes, navigate, redirectTo, tenant]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // If auth is required and no user, show nothing (will redirect)
  if (requireAuth && !userType) {
    return null;
  }

  // If user type restrictions exist and user doesn't match
  if (allowedUserTypes && userType && !allowedUserTypes.includes(userType)) {
    return null;
  }

  return <>{children}</>;
}

