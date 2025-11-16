import { useMemo } from 'react';

export const useMenuStats = (menus: any[] | undefined) => {
  return useMemo(() => {
    if (!menus) {
      return {
        totalMenus: 0,
        activeMenus: 0,
        burnedMenus: 0,
        totalViews: 0,
        totalOrders: 0,
        totalRevenue: 0,
        conversionRate: 0,
        averageOrderValue: 0,
        todayViews: 0,
        todayOrders: 0,
        todayRevenue: 0
      };
    }

    const today = new Date().toDateString();
    
    const activeMenus = menus.filter(m => m.status === 'active');
    const burnedMenus = menus.filter(m => m.status !== 'active');
    
    const totalViews = menus.reduce((sum, menu) => {
      return sum + (menu.menu_access_logs?.[0]?.count || 0);
    }, 0);

    const allOrders = menus.flatMap(m => m.menu_orders || []);
    const totalOrders = allOrders.length;
    
    const totalRevenue = allOrders.reduce((sum, order) => {
      return sum + parseFloat(order.total_amount || 0);
    }, 0);

    const todayOrders = allOrders.filter(order => 
      new Date(order.created_at).toDateString() === today
    );

    const todayRevenue = todayOrders.reduce((sum, order) => {
      return sum + parseFloat(order.total_amount || 0);
    }, 0);

    const todayViews = menus.reduce((sum, menu) => {
      const logs = menu.menu_access_logs || [];
      return sum + logs.filter((log: any) => 
        new Date(log.accessed_at).toDateString() === today
      ).length;
    }, 0);

    const conversionRate = totalViews > 0 ? (totalOrders / totalViews) * 100 : 0;
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    return {
      totalMenus: menus.length,
      activeMenus: activeMenus.length,
      burnedMenus: burnedMenus.length,
      totalViews,
      totalOrders,
      totalRevenue,
      conversionRate,
      averageOrderValue,
      todayViews,
      todayOrders,
      todayRevenue
    };
  }, [menus]);
};
