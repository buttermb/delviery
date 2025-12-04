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
            product:products(*)
          ),
          menu_access_logs(count),
          menu_orders(total_amount)
        `)
        .eq('id', menuId)
        .maybeSingle();

      if (!menu) throw new Error('Menu not found');

      // Calculate analytics
      // Filter logs that are actual page views (where actions_taken is null or not an event)
      const pageViewLogs = menu.menu_access_logs?.filter((log: any) =>
        !log.actions_taken || !log.actions_taken.action
      ) || [];

      // Filter logs that are events
      const eventLogs = menu.menu_access_logs?.filter((log: any) =>
        log.actions_taken && log.actions_taken.action
      ) || [];

      const productsWithImages = menu.disposable_menu_products?.filter(
        (mp: any) => mp.product?.image_url || mp.product?.images?.length > 0
      ).length || 0;

      const productsWithoutImages = (menu.disposable_menu_products?.length || 0) - productsWithImages;

      const totalRevenue = menu.menu_orders?.reduce(
        (sum: number, order: any) => sum + (order.total_amount || 0),
        0
      ) || 0;

      const imageViews = eventLogs.filter((log: any) => log.actions_taken.action === 'image_viewed').length;
      const imageZooms = eventLogs.filter((log: any) => log.actions_taken.action === 'image_zoomed').length;

      const analytics: MenuAnalytics = {
        total_views: pageViewLogs.length,
        total_orders: menu.menu_orders?.length || 0,
        total_revenue: totalRevenue,
        products_with_images: productsWithImages,
        products_without_images: productsWithoutImages,
        image_views: imageViews,
        image_zooms: imageZooms,
        avg_time_on_menu: pageViewLogs.reduce((acc: number, log: any) => acc + (log.session_duration_seconds || 0), 0) / (pageViewLogs.length || 1),
        conversion_rate: pageViewLogs.length > 0
          ? ((menu.menu_orders?.length || 0) / pageViewLogs.length) * 100
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
          product:products(
            id,
            name,
            image_url
          )
        `)
        .eq('menu_id', menuId);

      if (!menuProducts) return [];

      // Fetch logs for this menu to aggregate per product
      const { data: logs } = await supabase
        .from('menu_access_logs')
        .select('actions_taken')
        .eq('menu_id', menuId)
        .not('actions_taken', 'is', null);

      // Calculate per-product analytics
      const analytics: ProductImageAnalytics[] = menuProducts.map((mp: any) => {
        const hasImage = !!mp.product?.image_url;

        const productLogs = logs?.filter((log: any) =>
          log.actions_taken?.product_id === mp.product_id
        ) || [];

        const viewCount = productLogs.filter((log: any) => log.actions_taken?.action === 'image_viewed').length;
        const zoomCount = productLogs.filter((log: any) => log.actions_taken?.action === 'image_zoomed').length;

        const addToCartCount = productLogs.filter((log: any) => log.actions_taken?.action === 'add_to_cart').length;
        const conversionRate = viewCount > 0 ? (addToCartCount / viewCount) * 100 : 0;

        return {
          product_id: mp.product_id,
          product_name: mp.product?.name || 'Unknown',
          has_image: hasImage,
          view_count: viewCount,
          zoom_count: zoomCount,
          add_to_cart_count: addToCartCount,
          conversion_rate: conversionRate
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
      actions_taken: { action: 'image_viewed', product_id: productId },
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
      actions_taken: { action: 'image_zoomed', product_id: productId },
      accessed_at: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to track image zoom:', error);
  }
};
