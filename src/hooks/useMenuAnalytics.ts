import { logger } from '@/lib/logger';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface MenuAnalytics {
  total_views: number;
  total_orders: number;
  total_revenue: number;
  products_with_images: number;
  products_without_images: number;
  image_views: number;
  image_zooms: number;
  avg_time_on_menu: number;
  conversion_rate: number;
}

interface ProductImageAnalytics {
  product_id: string;
  product_name: string;
  has_image: boolean;
  view_count: number;
  zoom_count: number;
  add_to_cart_count: number;
  conversion_rate: number;
}

/**
 * Hook to fetch menu analytics including image performance
 */
export const useMenuAnalytics = (menuId: string) => {
  return useQuery({
    queryKey: ['menu-analytics', menuId],
    queryFn: async () => {
      // Get basic menu stats
      const { data: menu } = await supabase
        .from('disposable_menus')
        .select(`
          *,
          disposable_menu_products(
            *,
            product:wholesale_inventory(*)
          ),
          menu_access_logs(count),
          menu_orders(total_amount)
        `)
        .eq('id', menuId)
        .maybeSingle();

      if (!menu) throw new Error('Menu not found');

      // Calculate analytics
      const productsWithImages = menu.disposable_menu_products?.filter(
        (mp: any) => mp.product?.image_url || mp.product?.images?.length > 0
      ).length || 0;

      const productsWithoutImages = (menu.disposable_menu_products?.length || 0) - productsWithImages;

      const totalRevenue = menu.menu_orders?.reduce(
        (sum: number, order: any) => sum + (order.total_amount || 0),
        0
      ) || 0;

      const analytics: MenuAnalytics = {
        total_views: menu.menu_access_logs?.length || 0,
        total_orders: menu.menu_orders?.length || 0,
        total_revenue: totalRevenue,
        products_with_images: productsWithImages,
        products_without_images: productsWithoutImages,
        image_views: 0, // TODO: Track from logs
        image_zooms: 0, // TODO: Track from logs
        avg_time_on_menu: 0, // TODO: Calculate from session data
        conversion_rate: menu.menu_access_logs?.length > 0
          ? ((menu.menu_orders?.length || 0) / menu.menu_access_logs.length) * 100
          : 0
      };

      return analytics;
    },
    enabled: !!menuId
  });
};

/**
 * Hook to fetch product-level image analytics
 */
export const useProductImageAnalytics = (menuId: string) => {
  return useQuery({
    queryKey: ['product-image-analytics', menuId],
    queryFn: async () => {
      const { data: menuProducts } = await supabase
        .from('disposable_menu_products')
        .select(`
          *,
          product:wholesale_inventory(
            id,
            product_name,
            image_url,
            images
          )
        `)
        .eq('menu_id', menuId);

      if (!menuProducts) return [];

      // Calculate per-product analytics
      const analytics: ProductImageAnalytics[] = menuProducts.map((mp: any) => {
        const hasImage = !!(mp.product?.image_url || mp.product?.images?.length > 0);

        return {
          product_id: mp.product_id,
          product_name: mp.product?.product_name || 'Unknown',
          has_image: hasImage,
          view_count: 0, // TODO: Track from logs
          zoom_count: 0, // TODO: Track from logs
          add_to_cart_count: 0, // TODO: Track from cart events
          conversion_rate: 0 // TODO: Calculate
        };
      });

      return analytics;
    },
    enabled: !!menuId
  });
};

/**
 * Track image view event
 */
export const trackImageView = async (
  menuId: string,
  productId: string,
  accessToken?: string
) => {
  try {
    await supabase.from('menu_access_logs').insert({
      menu_id: menuId,
      action: 'image_viewed',
      details: { product_id: productId },
      accessed_at: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to track image view:', error);
  }
};

/**
 * Track image zoom event
 */
export const trackImageZoom = async (
  menuId: string,
  productId: string,
  accessToken?: string
) => {
  try {
    await supabase.from('menu_access_logs').insert({
      menu_id: menuId,
      action: 'image_zoomed',
      details: { product_id: productId },
      accessed_at: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to track image zoom:', error);
  }
};
