import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

export interface MenuProductPreview {
  id: string;
  product_id: string;
  custom_price: number | null;
  display_order: number;
  display_availability: boolean;
  product: {
    id: string;
    product_name: string;
    description: string | null;
    base_price: number;
    image_url: string | null;
    category: string | null;
    strain_type: string | null;
    thc_content: number | null;
    cbd_content: number | null;
    // Compliance fields
    lab_name?: string | null;
    lab_results_url?: string | null;
    test_date?: string | null;
    coa_url?: string | null;
    batch_number?: string | null;
  } | null;
}

export const useMenuProductsForPreview = (menuId: string | undefined, enabled = true) => {
  return useQuery({
    queryKey: ['menu-products-preview', menuId],
    queryFn: async (): Promise<MenuProductPreview[]> => {
      if (!menuId) {
        return [];
      }

      // Fetch menu products with joined product details from wholesale_inventory
      const { data, error } = await (supabase as any)
        .from('disposable_menu_products')
        .select(`
          id,
          product_id,
          custom_price,
          display_order,
          display_availability,
          wholesale_inventory!product_id (
            id,
            product_name,
            description,
            base_price,
            image_url,
            category,
            strain_type,
            thc_content,
            cbd_content
          )
        `)
        .eq('menu_id', menuId)
        .order('display_order', { ascending: true });

      if (error) {
        logger.error('Failed to fetch menu products for preview', error, { component: 'useMenuProductsForPreview', menuId });
        throw error;
      }

      // Map the data to include product info
      return (data || []).map((item) => ({
        id: item.id,
        product_id: item.product_id,
        custom_price: item.custom_price,
        display_order: item.display_order ?? 0,
        display_availability: item.display_availability ?? true,
        product: item.wholesale_inventory ? {
          id: item.wholesale_inventory.id,
          product_name: item.wholesale_inventory.product_name,
          description: item.wholesale_inventory.description,
          base_price: item.wholesale_inventory.base_price,
          image_url: item.wholesale_inventory.image_url,
          category: item.wholesale_inventory.category,
          strain_type: item.wholesale_inventory.strain_type,
          thc_content: item.wholesale_inventory.thc_content,
          cbd_content: item.wholesale_inventory.cbd_content,
        } : null,
      }));
    },
    enabled: enabled && !!menuId,
    staleTime: 60 * 1000, // Cache for 1 minute
    gcTime: 5 * 60 * 1000,
  });
};
