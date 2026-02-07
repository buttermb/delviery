import { logger } from '@/lib/logger';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface QuickStats {
  activeOrders: number;
  todayRevenue: number;
  onlineCouriers: number;
}

export const AdminQuickStatsHeader = () => {
  const { tenant } = useTenantAdminAuth();
  const [stats, setStats] = useState<QuickStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    
    const fetchQuickStats = async () => {
      if (!tenant?.id) return;

      try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const [ordersRes, couriersRes] = await Promise.all([
          supabase
            .from('orders')
            .select('total_amount, status')
            .eq('tenant_id', tenant.id) // Filter by tenant
            .gte('created_at', today.toISOString()),
          supabase
            .from('couriers')
            .select('is_online')
            .eq('tenant_id', tenant.id) // Filter by tenant
            .eq('is_online', true)
        ]);

        if (!isMounted) return;

        const activeOrders = ordersRes.data?.filter(o => 
          ['pending', 'accepted', 'picked_up'].includes(o.status)
        ).length || 0;

        const todayRevenue = ordersRes.data?.reduce((sum, o) => 
          sum + Number(o.total_amount || 0), 0
        ) || 0;

        setStats({
          activeOrders,
          todayRevenue,
          onlineCouriers: couriersRes.data?.length || 0
        });
      } catch (error) {
        if (isMounted) {
          logger.error('Failed to fetch quick stats', error, { component: 'AdminQuickStatsHeader' });
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };
    
    fetchQuickStats();
    
    // Refresh every 60 seconds
    const interval = setInterval(() => {
      if (isMounted) {
        fetchQuickStats();
      }
    }, 60000);
    
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [tenant?.id]);

  if (loading) {
    return (
      <div className="space-y-2 pb-3 border-b">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-3 w-32" />
      </div>
    );
  }

  return (
    <div className="space-y-2 pb-3 border-b">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">Quick Stats</span>
        <TrendingUp className="h-3 w-3 text-success" />
      </div>
      <div className="space-y-1 text-xs">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Active Orders</span>
          <span className="font-semibold">{stats?.activeOrders || 0}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Today Revenue</span>
          <span className="font-semibold text-success">${(stats?.todayRevenue || 0).toFixed(0)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Online Couriers</span>
          <span className="font-semibold">{stats?.onlineCouriers || 0}</span>
        </div>
      </div>
    </div>
  );
};
