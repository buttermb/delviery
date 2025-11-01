import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Package, ArrowRight, Lock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useCustomerAuth } from "@/contexts/CustomerAuthContext";
import { formatSmartDate } from "@/lib/utils/formatDate";

export function MenuList() {
  const navigate = useNavigate();
  const { customer, tenant } = useCustomerAuth();
  const tenantId = tenant?.id;
  const customerId = customer?.customer_id || customer?.id;

  // Fetch available menus
  const { data: menus, isLoading } = useQuery({
    queryKey: ["customer-menus", tenantId, customerId],
    queryFn: async () => {
      if (!tenantId || !customerId) return [];

      // Get menus assigned to this customer
      const { data: menuAccess } = await supabase
        .from("menu_access")
        .select("menu_id, access_code, expires_at")
        .eq("customer_id", customerId)
        .eq("tenant_id", tenantId);

      if (!menuAccess || menuAccess.length === 0) return [];

      const menuIds = menuAccess.map((ma) => ma.menu_id);

      const { data } = await supabase
        .from("menus")
        .select("id, name, description, is_active, created_at")
        .in("id", menuIds)
        .eq("tenant_id", tenantId)
        .eq("is_active", true);

      // Merge with access info
      return (data || []).map((menu) => {
        const access = menuAccess.find((ma) => ma.menu_id === menu.id);
        return {
          ...menu,
          access_code: access?.access_code,
          expires_at: access?.expires_at,
        };
      });
    },
    enabled: !!tenantId && !!customerId,
  });

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">Loading menus...</p>
      </div>
    );
  }

  if (!menus || menus.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground mb-2">No menus available</p>
          <p className="text-sm text-muted-foreground">
            Contact your supplier to get access to menus
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {menus.map((menu: any) => {
        const isExpired = menu.expires_at && new Date(menu.expires_at) < new Date();
        const requiresAccessCode = !!menu.access_code;

        return (
          <Card key={menu.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-semibold text-lg">{menu.name}</h3>
                    {isExpired && (
                      <Badge variant="destructive">Expired</Badge>
                    )}
                    {requiresAccessCode && (
                      <Badge variant="outline" className="gap-1">
                        <Lock className="h-3 w-3" />
                        Access Code Required
                      </Badge>
                    )}
                  </div>
                  {menu.description && (
                    <p className="text-sm text-muted-foreground mb-2">{menu.description}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Created {formatSmartDate(menu.created_at)}
                    {menu.expires_at && (
                      <> • Expires {formatSmartDate(menu.expires_at)}</>
                    )}
                  </p>
                </div>

                <Button
                  variant="outline"
                  onClick={() => {
                    if (isExpired) {
                      return;
                    }
                    navigate(`/${tenant?.slug}/shop/menus/${menu.id}`);
                  }}
                  disabled={isExpired}
                >
                  {isExpired ? (
                    "Expired"
                  ) : (
                    <>
                      Browse Products
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

