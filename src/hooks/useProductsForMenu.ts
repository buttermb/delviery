import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ProductForMenu {
  id: string;
  name: string;
  price: number;
  sku?: string;
  description?: string;
  image_url?: string;
  category?: string;
  stock_quantity?: number;
}

export const useProductsForMenu = (tenantId?: string) => {
  return useQuery({
    queryKey: ["products-for-menu", tenantId],
    queryFn: async () => {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const query = supabase
        .from("products")
        .select("id, name, price, sku, description, image_url, category, stock_quantity") as any;
      
      const { data, error } = await query
        .eq("tenant_id", tenantId)
        .order("name");

      if (error) throw error;
      return data as ProductForMenu[];
    },
    enabled: !!tenantId,
  });
};
