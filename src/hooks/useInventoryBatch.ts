import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import { queryKeys } from "@/lib/queryKeys";

export const useInventoryBatch = (productIds: string[]) => {
  const { tenant } = useTenantAdminAuth();

  return useQuery({
    queryKey: queryKeys.inventoryBatch.byProducts(tenant?.id, productIds.join(",")),
    queryFn: async () => {
      if (!productIds.length || !tenant?.id) return {};

      // Query products table for stock_quantity
      const { data, error } = await supabase
        .from("products")
        .select("id, stock_quantity")
        .eq("tenant_id", tenant.id)
        .in("id", productIds);

      if (error) throw error;

      // Convert array to object keyed by product id
      return (data || []).reduce((acc, item) => {
        acc[item.id] = item.stock_quantity ?? 0;
        return acc;
      }, {} as Record<string, number>);
    },
    enabled: productIds.length > 0 && !!tenant?.id,
    staleTime: 30000, // Cache for 30 seconds
  });
};
