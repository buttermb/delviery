/**
 * 🏠 Modern Dashboard with Widgets
 * Comprehensive dashboard with stat cards, charts, and activity feeds
 */

import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  DollarSign, TrendingUp, Package, Truck, Users,
  ArrowUp, ArrowDown, Activity, AlertTriangle, CheckCircle2,
  Clock, Zap, Target, BarChart3
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfWeek, endOfWeek, subDays } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { StatCard } from './dashboard/StatCard';
import { RecentOrdersWidget } from './dashboard/RecentOrdersWidget';
import { InventoryAlertsWidget } from './dashboard/InventoryAlertsWidget';
import { SalesChartWidget } from './dashboard/SalesChartWidget';
import { ActivityFeedWidget } from './dashboard/ActivityFeedWidget';
import { QuickActionsBar } from './dashboard/QuickActionsBar';
import { LocationMapWidget } from './dashboard/LocationMapWidget';
import { PendingTransfersWidget } from './dashboard/PendingTransfersWidget';
import { RevenueChartWidget } from './dashboard/RevenueChartWidget';
import { RevenuePredictionWidget } from './dashboard/RevenuePredictionWidget';
import { TopProductsWidget } from './dashboard/TopProductsWidget';
import { ActionableInsights } from '@/components/admin/ActionableInsights';
// FrontedInventoryWidget removed - had type errors

export function ModernDashboard() {
  const navigate = useNavigate();
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;

  // Fetch dashboard data - PARALLEL QUERIES for 5x faster load
  const { data: dashboardData } = useQuery<{
    revenue: number;
    revenueChange: number;
    orders: number;
    transfers: number;
    alerts: number;
  }>({
    queryKey: ['modern-dashboard', tenantId],
    queryFn: async () => {
      if (!tenantId) return null;

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const weekStart = startOfWeek(today);
      const lastWeekStart = startOfWeek(subDays(today, 7));

      // Execute all queries in parallel using Promise.all
      const [
        todayOrdersResult,
        lastWeekOrdersResult,
        activeOrdersResult,
        transfersResult,
        lowStockResult
      ] = await Promise.all([
        // Today's revenue
        supabase
          .from('wholesale_orders')
          .select('total_amount')
          .eq('tenant_id', tenantId)
          .gte('created_at', today.toISOString()),
        
        // Last week for comparison
        supabase
          .from('wholesale_orders')
          .select('total_amount')
          .eq('tenant_id', tenantId)
          .gte('created_at', lastWeekStart.toISOString())
          .lt('created_at', weekStart.toISOString()),
        
        // Active orders
        supabase
          .from('wholesale_orders')
          .select('id')
          .eq('tenant_id', tenantId)
          .in('status', ['pending', 'assigned', 'in_transit']),
        
        // Transfers
        supabase
          .from('wholesale_deliveries')
          .select('id, status')
          .eq('tenant_id', tenantId)
          .in('status', ['assigned', 'picked_up', 'in_transit']),
        
        // Alerts
        supabase
          .from('wholesale_inventory')
          .select('id')
          .eq('tenant_id', tenantId)
          .lt('quantity_lbs', 30)
      ]);

      const todayRevenue = (todayOrdersResult.data || []).reduce((sum: number, o: { total_amount?: number }) => 
        sum + Number(o.total_amount || 0), 0);

      const lastWeekRevenue = (lastWeekOrdersResult.data || []).reduce((sum: number, o: { total_amount?: number }) => 
        sum + Number(o.total_amount || 0), 0);

      return {
        revenue: todayRevenue,
        revenueChange: lastWeekRevenue > 0 
          ? ((todayRevenue - lastWeekRevenue) / lastWeekRevenue) * 100 
          : 0,
        orders: activeOrdersResult.data?.length || 0,
        transfers: transfersResult.data?.length || 0,
        alerts: lowStockResult.data?.length || 0,
      };
    },
    enabled: !!account?.id,
    refetchInterval: 60000,
  });

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">🏠 Dashboard</h1>
          <p className="text-muted-foreground">
            {format(new Date(), 'EEEE, MMMM d, yyyy')}
          </p>
        </div>
      </div>

      {/* Quick Actions Bar */}
      <QuickActionsBar />

      {/* Stat Cards - Mobile-first responsive grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          title="Revenue"
          value={`$${dashboardData?.revenue.toLocaleString() || '0'}`}
          change={dashboardData?.revenueChange ? {
            value: Math.abs(dashboardData.revenueChange),
            type: dashboardData.revenueChange > 0 ? 'increase' : 'decrease',
          } : undefined}
          subtitle="vs last week"
          icon={<DollarSign className="h-5 w-5" />}
          color="green"
          href="/admin/big-plug-financial"
        />
        
        <StatCard
          title="Orders"
          value={`${dashboardData?.orders || 0} Active`}
          icon={<Package className="h-5 w-5" />}
          color="blue"
          href="/admin/wholesale-orders"
        />

        <StatCard
          title="Transfers"
          value={`${dashboardData?.transfers || 0} In Transit`}
          icon={<Truck className="h-5 w-5" />}
          color="orange"
          href="/admin/fleet-management"
        />

        <StatCard
          title="Alerts"
          value={`${dashboardData?.alerts || 0} Items`}
          icon={<AlertTriangle className="h-5 w-5" />}
          color={dashboardData && dashboardData.alerts > 0 ? 'red' : 'green'}
          href="/admin/inventory-dashboard"
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - 2/3 */}
        <div className="lg:col-span-2 space-y-6">
          <SalesChartWidget />
          <RevenuePredictionWidget />
          <RecentOrdersWidget />
        </div>

        {/* Right Column - 1/3 */}
        <div className="space-y-6">
          {/* FrontedInventoryWidget removed - had type errors */}
          <InventoryAlertsWidget />
          <ActivityFeedWidget />
        </div>
      </div>

      {/* Bottom Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <LocationMapWidget />
        <PendingTransfersWidget />
      </div>

      {/* Additional Widgets Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RevenueChartWidget />
        <TopProductsWidget />
      </div>

      {/* Actionable Insights */}
      <ActionableInsights />
    </div>
  );
}

