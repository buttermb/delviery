import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Lock, ArrowRight, Calendar } from "lucide-react";
import { useCustomerAuth } from "@/contexts/CustomerAuthContext";
import { useNavigate } from "react-router-dom";
import { formatSmartDate } from "@/lib/utils/formatDate";

interface MenuListProps {
  tenantId?: string;
  customerId?: string;
}

export function MenuList({ tenantId: propTenantId, customerId: propCustomerId }: MenuListProps = {}) {
  const navigate = useNavigate();
  const { tenant, customer } = useCustomerAuth();
  const finalTenantId = propTenantId || tenant?.id;
  const finalCustomerId = propCustomerId || customer?.customer_id || customer?.id;

  // Fetch available menus for this customer
  const { data: menus, isLoading } = useQuery({
    queryKey: ["customer-menus", finalTenantId, finalCustomerId],
    queryFn: async () => {
      if (!finalTenantId || !finalCustomerId) return [];

      // Get menus that the customer has access to
      const result = await (supabase as any)
        .from("menu_access")
        .select(`
          menu_id,
          expires_at,
          access_code,
          menus (
            id,
            name,
            description,
            is_active,
            created_at
          )
        `)
        .eq("tenant_id", finalTenantId)
        .eq("customer_id", finalCustomerId)
        .order("created_at", { ascending: false })
        .limit(5);
      const { data: accessRecords } = result;

      if (!accessRecords) return [];

      interface AccessRecord {
        menu_id: string;
        expires_at?: string | null;
        access_code?: string | null;
        menus?: {
          id: string;
          name?: string;
          description?: string | null;
          is_active?: boolean;
        } | null;
      }

      interface MenuItem {
        id: string;
        name: string;
        description?: string | null;
        expires_at?: string | null;
        requiresAccessCode: boolean;
      }

      // Filter out expired menus and inactive menus
      const now = new Date();
      return (accessRecords as any[])
        .filter((record: any) => {
          const menu = record.menus;
          if (!menu || !menu.is_active) return false;
          if (record.expires_at && new Date(record.expires_at) < now) return false;
          return true;
        })
        .map((record: AccessRecord): MenuItem => ({
          id: record.menu_id,
          name: record.menus?.name || "Unnamed Menu",
          description: record.menus?.description,
          expires_at: record.expires_at || undefined,
          requiresAccessCode: !!record.access_code,
        }));
    },
    enabled: !!finalTenantId && !!finalCustomerId,
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 bg-gray-100 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (!menus || menus.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-[hsl(var(--customer-primary))]/10 to-[hsl(var(--customer-secondary))]/5 mb-4">
          <div className="text-4xl animate-bounce" style={{ animationDuration: "2s" }}>
            📋
          </div>
        </div>
        <h3 className="text-lg font-semibold text-[hsl(var(--customer-text))] mb-2">No menus available</h3>
        <p className="text-sm text-[hsl(var(--customer-text-light))] max-w-sm mx-auto mb-4">
          Contact your supplier to get access to menus. They'll send you a menu link when ready!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {menus.map((menu) => (
        <Card
          key={menu.id}
          className="p-4 hover:shadow-md transition-shadow cursor-pointer border-[hsl(var(--customer-border))] bg-[hsl(var(--customer-bg))]"
          onClick={() => navigate(`/${tenant?.slug}/shop/menus/${menu.id}`)}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="font-semibold text-[hsl(var(--customer-text))]">{menu.name}</h4>
                {menu.requiresAccessCode && (
                  <Badge variant="outline" className="gap-1 border-[hsl(var(--customer-primary))]/30 text-[hsl(var(--customer-primary))] text-xs">
                    <Lock className="h-3 w-3" />
                    Code Required
                  </Badge>
                )}
              </div>
              {menu.description && (
                <p className="text-sm text-[hsl(var(--customer-text-light))] line-clamp-2 mb-2">
                  {menu.description}
                </p>
              )}
              {menu.expires_at && (
                <div className="flex items-center gap-1 text-xs text-[hsl(var(--customer-text-light))]">
                  <Calendar className="h-3 w-3" />
                  Expires: {formatSmartDate(menu.expires_at)}
                </div>
              )}
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="ml-4 text-[hsl(var(--customer-primary))] hover:bg-[hsl(var(--customer-surface))]"
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/${tenant?.slug}/shop/menus/${menu.id}`);
              }}
            >
              View
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </Card>
      ))}
      {menus.length >= 5 && (
        <Button
          variant="outline"
          className="w-full border-[hsl(var(--customer-border))] text-[hsl(var(--customer-text))] hover:bg-[hsl(var(--customer-surface))]"
        >
          View All Menus
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      )}
    </div>
  );
}
