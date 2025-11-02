/**
 * Menu List Component
 * Displays available menus for customer portal
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShoppingBag, Lock, Calendar } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useCustomerAuth } from "@/contexts/CustomerAuthContext";
import { formatCurrency } from "@/lib/utils/formatCurrency";

interface MenuListProps {
  tenantId?: string;
  customerId?: string;
}

export function MenuList({ tenantId, customerId }: MenuListProps) {
  const navigate = useNavigate();
  const { tenant, customer } = useCustomerAuth();

  const effectiveTenantId = tenantId || tenant?.id;
  const effectiveCustomerId = customerId || customer?.customer_id || customer?.id;

  // Fetch available menus for this customer
  const { data: menus, isLoading } = useQuery({
    queryKey: ["customer-menus", effectiveTenantId, effectiveCustomerId],
    queryFn: async () => {
      if (!effectiveTenantId || !effectiveCustomerId) return [];

      // Get menus the customer has access to
      const { data: accessRecords } = await supabase
        .from("menu_access")
        .select("menu_id, access_code, expires_at")
        .eq("tenant_id", effectiveTenantId)
        .eq("customer_id", effectiveCustomerId);

      if (!accessRecords || accessRecords.length === 0) return [];

      const menuIds = accessRecords
        .filter((a) => !a.expires_at || new Date(a.expires_at) > new Date())
        .map((a) => a.menu_id);

      if (menuIds.length === 0) return [];

      // Fetch menu details
      const { data: menuData, error } = await supabase
        .from("menus")
        .select("*")
        .in("id", menuIds)
        .eq("tenant_id", effectiveTenantId)
        .eq("is_active", true);

      if (error) throw error;

      // Combine with access info
      return (menuData || []).map((menu) => {
        const access = accessRecords.find((a) => a.menu_id === menu.id);
        return {
          ...menu,
          access_code: access?.access_code,
          expires_at: access?.expires_at,
        };
      });
    },
    enabled: !!effectiveTenantId && !!effectiveCustomerId,
  });

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader>
              <div className="h-4 bg-muted rounded w-3/4" />
            </CardHeader>
            <CardContent>
              <div className="h-20 bg-muted rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!menus || menus.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <ShoppingBag className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Menus Available</h3>
            <p className="text-muted-foreground">
              You don't have access to any menus yet. Contact your supplier to get started.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {menus.map((menu) => {
        const isExpired = menu.expires_at && new Date(menu.expires_at) < new Date();

        return (
          <Card key={menu.id} className="hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-lg">{menu.name || "Untitled Menu"}</CardTitle>
                  {menu.description && (
                    <CardDescription className="mt-1 line-clamp-2">
                      {menu.description}
                    </CardDescription>
                  )}
                </div>
                {isExpired ? (
                  <Badge variant="destructive">Expired</Badge>
                ) : (
                  <Badge variant="default">Active</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {menu.expires_at && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>
                      Expires: {new Date(menu.expires_at).toLocaleDateString()}
                    </span>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => navigate(`/${tenant?.slug}/shop/menu/${menu.id}`)}
                    className="flex-1"
                    disabled={isExpired}
                  >
                    <ShoppingBag className="h-4 w-4 mr-2" />
                    View Menu
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
