/**
 * MobileDashboard Component
 *
 * Mobile-optimized dashboard with stacked single-column layout.
 * Features:
 * - Single column layout optimized for touch
 * - Pull-to-refresh functionality
 * - Collapsible sections for better navigation
 * - Touch-friendly quick actions
 * - Compact KPI cards
 * - Streamlined widget display
 */

import { useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import DollarSign from "lucide-react/dist/esm/icons/dollar-sign";
import ShoppingCart from "lucide-react/dist/esm/icons/shopping-cart";
import Package from "lucide-react/dist/esm/icons/package";
import Users from "lucide-react/dist/esm/icons/users";
import TrendingUp from "lucide-react/dist/esm/icons/trending-up";
import TrendingDown from "lucide-react/dist/esm/icons/trending-down";
import Minus from "lucide-react/dist/esm/icons/minus";
import ChevronDown from "lucide-react/dist/esm/icons/chevron-down";
import ChevronUp from "lucide-react/dist/esm/icons/chevron-up";
import Plus from "lucide-react/dist/esm/icons/plus";
import Smartphone from "lucide-react/dist/esm/icons/smartphone";
import AlertTriangle from "lucide-react/dist/esm/icons/alert-triangle";
import RefreshCw from "lucide-react/dist/esm/icons/refresh-cw";
import Settings from "lucide-react/dist/esm/icons/settings";
import Activity from "lucide-react/dist/esm/icons/activity";
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { logger } from '@/lib/logger';
import { PullToRefresh } from '@/components/mobile/PullToRefresh';
import { MobileErrorBoundary } from '@/components/mobile/MobileErrorBoundary';
import { triggerHaptic } from '@/lib/utils/mobile';
import { queryKeys } from '@/lib/queryKeys';

interface MobileKPIData {
  todayRevenue: number;
  todayOrders: number;
  lowStockCount: number;
  pendingOrders: number;
  revenueTrend: number;
  orderTrend: number;
}

interface QuickActionItem {
  id: string;
  label: string;
  icon: React.ElementType;
  href: string;
  badge?: number;
}

export function MobileDashboard() {
  const navigate = useNavigate();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();
  const tenantId = tenant?.id;

  // Collapsible section states
  const [kpiExpanded, setKpiExpanded] = useState(true);
  const [actionsExpanded, setActionsExpanded] = useState(true);
  const [alertsExpanded, setAlertsExpanded] = useState(true);

  // Fetch KPI data
  const { data: kpiData, isLoading: kpiLoading, refetch: refetchKpi } = useQuery({
    queryKey: queryKeys.mobileDashboard.kpi(tenantId),
    queryFn: async (): Promise<MobileKPIData> => {
      if (!tenantId) {
        return {
          todayRevenue: 0,
          todayOrders: 0,
          lowStockCount: 0,
          pendingOrders: 0,
          revenueTrend: 0,
          orderTrend: 0,
        };
      }

      const now = new Date();
      const today = new Date(now);
      today.setHours(0, 0, 0, 0);

      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      try {
        // Get today's orders
        const { data: todayOrders } = await supabase
          .from('wholesale_orders')
          .select('total_amount')
          .eq('tenant_id', tenantId)
          .gte('created_at', today.toISOString());

        // Get yesterday's orders for comparison
        const { data: yesterdayOrders } = await supabase
          .from('wholesale_orders')
          .select('total_amount')
          .eq('tenant_id', tenantId)
          .gte('created_at', yesterday.toISOString())
          .lt('created_at', today.toISOString());

        // Get pending orders count
        const { count: pendingCount } = await supabase
          .from('wholesale_orders')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .eq('status', 'pending');

        // Get low stock items count
        const { data: products } = await supabase
          .from('products')
          .select('available_quantity, stock_quantity, low_stock_alert')
          .eq('tenant_id', tenantId);

        const DEFAULT_LOW_STOCK_THRESHOLD = 10;
        const lowStockCount = products?.filter(item => {
          const currentQty = item.available_quantity ?? item.stock_quantity ?? 0;
          const threshold = item.low_stock_alert ?? DEFAULT_LOW_STOCK_THRESHOLD;
          return currentQty <= threshold;
        }).length || 0;

        // Calculate totals
        const todayRevenue = (todayOrders || []).reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);
        const todayOrderCount = todayOrders?.length || 0;
        const yesterdayRevenue = (yesterdayOrders || []).reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);
        const yesterdayOrderCount = yesterdayOrders?.length || 0;

        // Calculate trends
        const revenueTrend = yesterdayRevenue > 0
          ? ((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100
          : todayRevenue > 0 ? 100 : 0;

        const orderTrend = yesterdayOrderCount > 0
          ? ((todayOrderCount - yesterdayOrderCount) / yesterdayOrderCount) * 100
          : todayOrderCount > 0 ? 100 : 0;

        return {
          todayRevenue,
          todayOrders: todayOrderCount,
          lowStockCount,
          pendingOrders: pendingCount || 0,
          revenueTrend,
          orderTrend,
        };
      } catch (error) {
        logger.error('Failed to fetch mobile dashboard KPIs', error, { component: 'MobileDashboard' });
        return {
          todayRevenue: 0,
          todayOrders: 0,
          lowStockCount: 0,
          pendingOrders: 0,
          revenueTrend: 0,
          orderTrend: 0,
        };
      }
    },
    enabled: !!tenantId,
    staleTime: 30000,
    refetchInterval: 60000,
  });

  // Fetch low stock items for alerts
  const { data: lowStockItems, refetch: refetchLowStock } = useQuery({
    queryKey: queryKeys.mobileDashboard.lowStock(tenantId),
    queryFn: async () => {
      if (!tenantId) return [];

      const { data: products } = await supabase
        .from('products')
        .select('id, name, available_quantity, stock_quantity, low_stock_alert')
        .eq('tenant_id', tenantId);

      const DEFAULT_LOW_STOCK_THRESHOLD = 10;
      return (products || [])
        .filter(item => {
          const currentQty = item.available_quantity ?? item.stock_quantity ?? 0;
          const threshold = item.low_stock_alert ?? DEFAULT_LOW_STOCK_THRESHOLD;
          return currentQty <= threshold;
        })
        .slice(0, 5)
        .map(item => ({
          id: item.id,
          name: item.name || 'Unknown Product',
          quantity: item.available_quantity ?? item.stock_quantity ?? 0,
          threshold: item.low_stock_alert ?? DEFAULT_LOW_STOCK_THRESHOLD,
        }));
    },
    enabled: !!tenantId,
    staleTime: 60000,
  });

  // Quick actions
  const quickActions: QuickActionItem[] = [
    {
      id: 'new-order',
      label: 'New Order',
      icon: Plus,
      href: `/${tenantSlug}/admin/orders?tab=wholesale&action=new`,
    },
    {
      id: 'add-product',
      label: 'Add Product',
      icon: Package,
      href: `/${tenantSlug}/admin/inventory/products`,
    },
    {
      id: 'create-menu',
      label: 'Create Menu',
      icon: Smartphone,
      href: `/${tenantSlug}/admin/disposable-menus`,
    },
    {
      id: 'add-customer',
      label: 'Add Customer',
      icon: Users,
      href: `/${tenantSlug}/admin/customer-hub?tab=contacts&action=new`,
    },
  ];

  // Pull to refresh handler
  const handleRefresh = useCallback(async () => {
    await Promise.all([
      refetchKpi(),
      refetchLowStock(),
      queryClient.invalidateQueries({ queryKey: queryKeys.mobileDashboard.all }),
    ]);
  }, [refetchKpi, refetchLowStock, queryClient]);

  // Manual refresh handler with haptic feedback
  const handleManualRefresh = useCallback(async () => {
    triggerHaptic('medium');
    try {
      await handleRefresh();
    } catch (error) {
      logger.error('Failed to refresh mobile dashboard', error, { component: 'MobileDashboard' });
    }
  }, [handleRefresh]);

  // Trend helpers
  const getTrendIcon = (trend: number) => {
    if (trend > 5) return <TrendingUp className="h-3 w-3 text-green-600" />;
    if (trend < -5) return <TrendingDown className="h-3 w-3 text-red-600" />;
    return <Minus className="h-3 w-3 text-muted-foreground" />;
  };

  const getTrendColor = (trend: number) => {
    if (trend > 5) return 'text-green-600';
    if (trend < -5) return 'text-red-600';
    return 'text-muted-foreground';
  };

  const formatTrend = (trend: number) => {
    const sign = trend >= 0 ? '+' : '';
    return `${sign}${trend.toFixed(0)}%`;
  };

  // Handle quick action click
  const handleQuickAction = (action: QuickActionItem) => {
    triggerHaptic('light');
    navigate(action.href);
  };

  return (
    <MobileErrorBoundary>
      <PullToRefresh onRefresh={handleRefresh}>
        <div className="min-h-dvh bg-background pb-20 safe-area-top">
          {/* Mobile Header */}
          <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <h1 className="text-lg font-bold truncate">
                  {tenant?.business_name || 'Dashboard'}
                </h1>
                <p className="text-xs text-muted-foreground">Today's Overview</p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleManualRefresh}
                  className="h-9 w-9 touch-manipulation"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigate(`/${tenantSlug}/admin/settings`)}
                  className="h-9 w-9 touch-manipulation"
                >
                  <Settings className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </header>

          {/* Main Content - Single Column Stack */}
          <main className="px-4 py-4 space-y-4">
            {/* KPI Cards Section */}
            <Collapsible open={kpiExpanded} onOpenChange={setKpiExpanded}>
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  className="w-full flex items-center justify-between p-0 h-auto mb-2 touch-manipulation"
                  onClick={() => triggerHaptic('light')}
                >
                  <span className="text-sm font-semibold text-muted-foreground">Performance</span>
                  {kpiExpanded ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-3">
                {kpiLoading ? (
                  <div className="grid grid-cols-2 gap-3">
                    {[1, 2, 3, 4].map((i) => (
                      <Skeleton key={i} className="h-24 rounded-lg" />
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {/* Revenue Card */}
                    <Card className="touch-manipulation active:scale-[0.98] transition-transform">
                      <CardContent className="p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="h-7 w-7 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                            <DollarSign className="h-4 w-4 text-green-600" />
                          </div>
                          <span className="text-xs text-muted-foreground">Revenue</span>
                        </div>
                        <div className="text-xl font-bold truncate">
                          {formatCurrency(kpiData?.todayRevenue || 0)}
                        </div>
                        <div className={`flex items-center gap-1 text-xs ${getTrendColor(kpiData?.revenueTrend || 0)}`}>
                          {getTrendIcon(kpiData?.revenueTrend || 0)}
                          <span>{formatTrend(kpiData?.revenueTrend || 0)} vs yesterday</span>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Orders Card */}
                    <Card className="touch-manipulation active:scale-[0.98] transition-transform">
                      <CardContent className="p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="h-7 w-7 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                            <ShoppingCart className="h-4 w-4 text-blue-600" />
                          </div>
                          <span className="text-xs text-muted-foreground">Orders</span>
                        </div>
                        <div className="text-xl font-bold">{kpiData?.todayOrders || 0}</div>
                        <div className={`flex items-center gap-1 text-xs ${getTrendColor(kpiData?.orderTrend || 0)}`}>
                          {getTrendIcon(kpiData?.orderTrend || 0)}
                          <span>{formatTrend(kpiData?.orderTrend || 0)} vs yesterday</span>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Pending Orders Card */}
                    <Card
                      className="touch-manipulation active:scale-[0.98] transition-transform cursor-pointer"
                      onClick={() => {
                        triggerHaptic('light');
                        navigate(`/${tenantSlug}/admin/orders?status=pending`);
                      }}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="h-7 w-7 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                            <Activity className="h-4 w-4 text-amber-600" />
                          </div>
                          <span className="text-xs text-muted-foreground">Pending</span>
                        </div>
                        <div className="text-xl font-bold">{kpiData?.pendingOrders || 0}</div>
                        <div className="text-xs text-muted-foreground">orders to process</div>
                      </CardContent>
                    </Card>

                    {/* Low Stock Card */}
                    <Card
                      className={`touch-manipulation active:scale-[0.98] transition-transform cursor-pointer ${
                        (kpiData?.lowStockCount || 0) > 0 ? 'border-orange-300 dark:border-orange-600' : ''
                      }`}
                      onClick={() => {
                        triggerHaptic('light');
                        navigate(`/${tenantSlug}/admin/inventory-hub?tab=monitoring`);
                      }}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <div className={`h-7 w-7 rounded-full flex items-center justify-center ${
                            (kpiData?.lowStockCount || 0) > 0
                              ? 'bg-orange-100 dark:bg-orange-900/30'
                              : 'bg-gray-100 dark:bg-gray-900/30'
                          }`}>
                            <Package className={`h-4 w-4 ${
                              (kpiData?.lowStockCount || 0) > 0 ? 'text-orange-600' : 'text-gray-600'
                            }`} />
                          </div>
                          <span className="text-xs text-muted-foreground">Low Stock</span>
                        </div>
                        <div className={`text-xl font-bold ${
                          (kpiData?.lowStockCount || 0) > 0 ? 'text-orange-600' : ''
                        }`}>
                          {kpiData?.lowStockCount || 0}
                        </div>
                        <div className="text-xs text-muted-foreground">items to reorder</div>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </CollapsibleContent>
            </Collapsible>

            {/* Quick Actions Section */}
            <Collapsible open={actionsExpanded} onOpenChange={setActionsExpanded}>
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  className="w-full flex items-center justify-between p-0 h-auto mb-2 touch-manipulation"
                  onClick={() => triggerHaptic('light')}
                >
                  <span className="text-sm font-semibold text-muted-foreground">Quick Actions</span>
                  {actionsExpanded ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="grid grid-cols-4 gap-2">
                  {quickActions.map((action) => {
                    const Icon = action.icon;
                    return (
                      <Button
                        key={action.id}
                        variant="outline"
                        className="h-auto flex-col gap-1.5 p-3 relative touch-manipulation active:scale-95"
                        onClick={() => handleQuickAction(action)}
                      >
                        {action.badge !== undefined && action.badge > 0 && (
                          <Badge
                            variant="destructive"
                            className="absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[10px]"
                          >
                            {action.badge}
                          </Badge>
                        )}
                        <Icon className="h-5 w-5" />
                        <span className="text-[10px] font-medium text-center leading-tight">
                          {action.label}
                        </span>
                      </Button>
                    );
                  })}
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Low Stock Alerts Section */}
            {lowStockItems && lowStockItems.length > 0 && (
              <Collapsible open={alertsExpanded} onOpenChange={setAlertsExpanded}>
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    className="w-full flex items-center justify-between p-0 h-auto mb-2 touch-manipulation"
                    onClick={() => triggerHaptic('light')}
                  >
                    <span className="text-sm font-semibold text-orange-600 dark:text-orange-400 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      Stock Alerts ({lowStockItems.length})
                    </span>
                    {alertsExpanded ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <Card className="border-orange-200 dark:border-orange-800 bg-orange-50/50 dark:bg-orange-950/20">
                    <CardContent className="p-3 space-y-2">
                      {lowStockItems.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between p-2 bg-white dark:bg-card rounded-md border border-orange-200/50 dark:border-orange-800/50 touch-manipulation active:scale-[0.98]"
                          onClick={() => {
                            triggerHaptic('light');
                            navigate(`/${tenantSlug}/admin/inventory/products?search=${encodeURIComponent(item.name)}`);
                          }}
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{item.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {item.quantity} left (reorder at {item.threshold})
                            </p>
                          </div>
                          <Badge
                            variant="outline"
                            className={`flex-shrink-0 text-[10px] ${
                              item.quantity <= 0
                                ? 'bg-red-100 text-red-700 border-red-200'
                                : 'bg-orange-100 text-orange-700 border-orange-200'
                            }`}
                          >
                            {item.quantity <= 0 ? 'Out' : 'Low'}
                          </Badge>
                        </div>
                      ))}
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full mt-2 text-orange-600 border-orange-200 touch-manipulation"
                        onClick={() => {
                          triggerHaptic('light');
                          navigate(`/${tenantSlug}/admin/inventory-hub?tab=monitoring`);
                        }}
                      >
                        View All Alerts
                      </Button>
                    </CardContent>
                  </Card>
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* Recent Activity Placeholder */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-muted-foreground">
                  Recent Activity
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0">
                <div className="text-center py-6">
                  <Activity className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Activity will appear here
                  </p>
                </div>
              </CardContent>
            </Card>
          </main>
        </div>
      </PullToRefresh>
    </MobileErrorBoundary>
  );
}

export { MobileDashboard as default };
