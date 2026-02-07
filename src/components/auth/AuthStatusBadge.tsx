import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, AlertCircle, Clock } from "lucide-react";
import { useSuperAdminAuth } from "@/contexts/SuperAdminAuthContext";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import { useCustomerAuth } from "@/contexts/CustomerAuthContext";

interface AuthStatusBadgeProps {
  userType?: "super_admin" | "tenant_admin" | "customer";
}

export function AuthStatusBadge({ userType }: AuthStatusBadgeProps) {
  const { superAdmin, token: superAdminToken } = useSuperAdminAuth();
  const { admin, tenant, token: tenantAdminToken } = useTenantAdminAuth();
  const { customer, tenant: customerTenant, token: customerToken } = useCustomerAuth();

  // Determine current user and status
  let isAuthenticated = false;
  let displayName = "";
  let status = "disconnected";

  if (!userType) {
    // Auto-detect
    if (superAdmin && superAdminToken) {
      isAuthenticated = true;
      displayName = superAdmin.email;
      status = "super_admin";
    } else if (admin && tenant && tenantAdminToken) {
      isAuthenticated = true;
      displayName = admin.email;
      status = "tenant_admin";
    } else if (customer && customerTenant && customerToken) {
      isAuthenticated = true;
      displayName = customer.email;
      status = "customer";
    }
  } else {
    // Check specific type
    if (userType === "super_admin" && superAdmin && superAdminToken) {
      isAuthenticated = true;
      displayName = superAdmin.email;
      status = "connected";
    } else if (userType === "tenant_admin" && admin && tenant && tenantAdminToken) {
      isAuthenticated = true;
      displayName = admin.email;
      status = "connected";
    } else if (userType === "customer" && customer && customerTenant && customerToken) {
      isAuthenticated = true;
      displayName = customer.email;
      status = "connected";
    }
  }

  if (!isAuthenticated) {
    return (
      <Badge variant="outline" className="gap-1">
        <XCircle className="h-3 w-3" />
        Not authenticated
      </Badge>
    );
  }

  const getStatusConfig = () => {
    switch (status) {
      case "super_admin":
        return {
          variant: "default" as const,
          icon: <CheckCircle2 className="h-3 w-3" />,
          label: "Platform Admin",
          color: "text-purple-600",
        };
      case "tenant_admin":
        return {
          variant: "default" as const,
          icon: <CheckCircle2 className="h-3 w-3" />,
          label: "Tenant Admin",
          color: "text-blue-600",
        };
      case "customer":
        return {
          variant: "default" as const,
          icon: <CheckCircle2 className="h-3 w-3" />,
          label: "Customer",
          color: "text-green-600",
        };
      case "connected":
        return {
          variant: "default" as const,
          icon: <CheckCircle2 className="h-3 w-3" />,
          label: "Connected",
          color: "text-green-600",
        };
      default:
        return {
          variant: "outline" as const,
          icon: <Clock className="h-3 w-3" />,
          label: "Connecting...",
          color: "text-yellow-600",
        };
    }
  };

  const config = getStatusConfig();

  return (
    <Badge variant={config.variant} className={`gap-1 ${config.color}`}>
      {config.icon}
      <span className="hidden sm:inline">{config.label}</span>
      {displayName && <span className="hidden md:inline ml-1">• {displayName}</span>}
    </Badge>
  );
}

