import { ReactNode } from "react";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, TrendingUp } from "lucide-react";
import { Link } from "react-router-dom";

interface UsageLimitGuardProps {
  resource: "customers" | "menus" | "products" | "locations" | "users";
  children: ReactNode;
}

export function UsageLimitGuard({ resource, children }: UsageLimitGuardProps) {
  const { tenant } = useTenantAdminAuth();
  
  if (!tenant) return <>{children}</>;

  const limits = tenant.limits || { customers: 0, menus: 0, products: 0, locations: 0, users: 0 };
  const usage = tenant.usage || { customers: 0, menus: 0, products: 0, locations: 0, users: 0 };
  
  const limit = limits[resource];
  const current = usage[resource] ?? 0;
  
  // -1 means unlimited
  if (limit === -1) {
    return <>{children}</>;
  }
  
  const actualLimit = limit ?? 0;
  const percentage = actualLimit > 0 ? Math.round((current / actualLimit) * 100) : 0;
  
  // At 100% - Block with upgrade prompt
  if (percentage >= 100) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="pt-6">
          <div className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
              <AlertTriangle className="h-8 w-8 text-red-600" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-red-900 mb-2">
                {resource.charAt(0).toUpperCase() + resource.slice(1)} Limit Reached
              </h3>
              <p className="text-red-700 mb-4">
                You've reached your limit of {actualLimit} {resource}. Upgrade your plan to add more.
              </p>
              <Progress value={100} className="h-2 mb-4" />
              <p className="text-sm text-red-600 mb-4">
                {current} / {actualLimit} {resource} used (100%)
              </p>
            </div>
            <Button asChild className="bg-red-600 hover:bg-red-700 text-white">
              <Link to={`/${tenant.slug}/admin/billing`}>
                <TrendingUp className="mr-2 h-4 w-4" />
                Upgrade Plan
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  // At 80-99% - Show warning but allow action
  if (percentage >= 80) {
    return (
      <div className="space-y-4">
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
                <div>
                  <p className="font-semibold text-yellow-900">
                    ⚠️ Approaching {resource} limit
                  </p>
                  <p className="text-sm text-yellow-700">
                    {current} / {actualLimit} used ({percentage}%)
                  </p>
                </div>
              </div>
              <Button variant="outline" size="sm" asChild className="border-yellow-300">
                <Link to={`/${tenant.slug}/admin/billing`}>
                  Upgrade
                </Link>
              </Button>
            </div>
            <Progress value={percentage} className="h-2 mt-3" />
          </CardContent>
        </Card>
        {children}
      </div>
    );
  }
  
  // Below 80% - No warning
  return <>{children}</>;
}
