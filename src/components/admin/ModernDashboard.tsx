/**
 * 🏠 Modern Dashboard with Widgets
 * Comprehensive dashboard with stat cards, charts, and activity feeds
 */

import { useQuery } from '@tanstack/react-query';
import { DollarSign, Package, Truck, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfWeek, subDays } from 'date-fns';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useTenantNavigate } from '@/hooks/useTenantNavigate';
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
import { DashboardLayoutEditor } from './dashboard/DashboardLayoutEditor';
import { Skeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';

interface DashboardData {
  revenue: number;
  revenueChange: number;
  orders: number;
  transfers: number;
  alerts: number;
}

export function ModernDashboard() {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;
  const navigateTenant = useTenantNavigate();

  // Fetch dashboard data with proper error handling
  const { data: dashboardData, isLoading, error } = useQuery<DashboardData | null>({
    queryKey: ['modern-dashboard', tenantId],
    queryFn: async () => {
      if (!tenantId) return null;

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const weekStart = startOfWeek(today);
      const lastWeekStart = startOfWeek(subDays(today, 7));

      // Execute queries with proper error handling
      const [todayOrdersResult, lastWeekOrdersResult, activeOrdersResult, transfersResult, lowStockResult] = await Promise.all([
        supabase
          .from('wholesale_orders')
          .select('total_amount')
          .eq('tenant_id', tenantId)
          .gte('created_at', today.toISOString()),
        supabase
          .from('wholesale_orders')
          .select('total_amount')
          .eq('tenant_id', tenantId)
          .gte('created_at', lastWeekStart.toISOString())
          .lt('created_at', weekStart.toISOString()),
        supabase
          .from('wholesale_orders')
          .select('id')
          .eq('tenant_id', tenantId)
          .in('status', ['pending', 'assigned', 'in_transit']),
        supabase
          .from('wholesale_deliveries')
          .select('id, status')
          .eq('tenant_id', tenantId)
          .in('status', ['assigned', 'picked_up', 'in_transit']),
        supabase
          .from('products')
          .select('id')
          .eq('tenant_id', tenantId)
          .lt('stock_quantity', 30)
      ]);

      // Revenue calculation with safe defaults
      const todayRevenue = (todayOrdersResult.data || []).reduce((sum: number, o: { total_amount?: number | null }) =>
        sum + Number(o.total_amount || 0), 0);

      const lastWeekRevenue = (lastWeekOrdersResult.data || []).reduce((sum: number, o: { total_amount?: number | null }) =>
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
    enabled: !!tenantId,
    refetchInterval: 60000,
  });

  // Handle navigation with tenant context
  const handleNavigate = (path: string) => {
    navigateTenant(path);
  };

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="w-full px-3 sm:px-4 md:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="p-4">
              <Skeleton className="h-6 w-24 mb-2" />
              <Skeleton className="h-8 w-32" />
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full px-3 sm:px-4 md:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-2">🏠 Dashboard</h1>
          <p className="text-muted-foreground">
            {format(new Date(), 'EEEE, MMMM d, yyyy')}
          </p>
        </div>
        <DashboardLayoutEditor />
      </div>

      {/* Quick Actions Bar */}
      <QuickActionsBar />

      {/* Stat Cards with tenant-aware navigation */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          title="Revenue"
          value={`$${(dashboardData?.revenue || 0).toLocaleString()}`}
          change={dashboardData?.revenueChange ? {
            value: Math.abs(dashboardData.revenueChange),
            type: dashboardData.revenueChange > 0 ? 'increase' : 'decrease',
          } : undefined}
          subtitle="vs last week"
          icon={<DollarSign className="h-5 w-5" />}
          color="green"
          onClick={() => handleNavigate('big-plug-financial')}
        />

        <StatCard
          title="Orders"
          value={`${dashboardData?.orders || 0} Active`}
          icon={<Package className="h-5 w-5" />}
          color="blue"
          onClick={() => handleNavigate('orders')}
        />

        <StatCard
          title="Transfers"
          value={`${dashboardData?.transfers || 0} In Transit`}
          icon={<Truck className="h-5 w-5" />}
          color="orange"
          onClick={() => handleNavigate('fulfillment-hub')}
        />

        <StatCard
          title="Alerts"
          value={`${dashboardData?.alerts || 0} Items`}
          icon={<AlertTriangle className="h-5 w-5" />}
          color={(dashboardData?.alerts || 0) > 0 ? 'red' : 'green'}
          onClick={() => handleNavigate('inventory-hub')}
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <div className="lg:col-span-2 space-y-4 sm:space-y-6">
          <SalesChartWidget />
          <RevenuePredictionWidget />
          <RecentOrdersWidget />
        </div>

        <div className="space-y-4 sm:space-y-6">
          <InventoryAlertsWidget />
          <ActivityFeedWidget />
        </div>
      </div>

      {/* Bottom Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <LocationMapWidget />
        <PendingTransfersWidget />
      </div>

      {/* Additional Widgets Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <RevenueChartWidget />
        <TopProductsWidget />
      </div>

      {/* Actionable Insights */}
      <ActionableInsights />
    </div>
  );
}
