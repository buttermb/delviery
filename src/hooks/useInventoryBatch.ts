import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";

export const useInventoryBatch = (productIds: string[]) => {
  const { tenant } = useTenantAdminAuth();

  return useQuery({
    queryKey: ["inventory-batch", tenant?.id, productIds.join(",")],
    queryFn: async () => {
      if (!productIds.length || !tenant?.id) return {};

      const { data, error } = await (supabase as any)
        .from("inventory")
        .select("product_id, stock")
        .eq("tenant_id", tenant.id)
        .in("product_id", productIds);

      if (error) throw error;

      // Convert array to object keyed by product_id
      return (data || []).reduce((acc, item) => {
        acc[item.product_id] = item.stock;
        return acc;
      }, {} as Record<string, number>);
    },
    enabled: productIds.length > 0 && !!tenant?.id,
    staleTime: 30000, // Cache for 30 seconds
  });
};
