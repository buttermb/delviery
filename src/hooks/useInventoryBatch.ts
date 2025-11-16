import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useInventoryBatch = (productIds: string[]) => {
  return useQuery({
    queryKey: ["inventory-batch", productIds.join(",")],
    queryFn: async () => {
      if (!productIds.length) return {};
      
      const { data, error } = await supabase
        .from("inventory")
        .select("product_id, stock")
        .in("product_id", productIds);

      if (error) throw error;

      // Convert array to object keyed by product_id
      return (data || []).reduce((acc, item) => {
        acc[item.product_id] = item.stock;
        return acc;
      }, {} as Record<string, number>);
    },
    enabled: productIds.length > 0,
    staleTime: 30000, // Cache for 30 seconds
  });
};
