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

      // Use wholesale_inventory as that's what disposable_menu_products.product_id references
      const { data, error } = await supabase
        .from("wholesale_inventory")
        .select("id, product_name, base_price, sku, description, image_url, category, quantity_units")
        .eq("tenant_id", tenantId)
        .order("product_name");

      if (error) throw error;
      // Map wholesale_inventory fields to ProductForMenu interface
      return (data || []).map((item) => ({
        id: item.id,
        name: item.product_name,
        price: item.base_price || 0,
        sku: item.sku,
        description: item.description,
        image_url: item.image_url,
        category: item.category,
        stock_quantity: item.quantity_units,
      })) as ProductForMenu[];
    },
    enabled: !!tenantId,
  });
};
