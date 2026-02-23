import { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DateRange } from 'react-day-picker';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import {
  Eye, ShoppingCart, DollarSign, TrendingUp, Package,
  BarChart3, RefreshCw, Trophy, Crown, Medal, X, Plus
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { logger } from '@/lib/logger';
import { cn } from '@/lib/utils';
import { AnalyticsDateRangePicker } from '@/components/admin/disposable-menus/AnalyticsDateRangePicker';
import { AnalyticsExportButton } from '@/components/admin/disposable-menus/AnalyticsExportButton';

interface MenuComparisonProps {
  className?: string;
}

interface MenuOption {
  id: string;
  name: string;
}

interface AccessLogRow {
  id: string;
  menu_id: string;
  accessed_at: string;
  ip_address?: string | null;
}

interface MenuOrderRow {
  id: string;
  menu_id: string;
  total_amount: number | null;
  status: string;
  created_at: string;
  order_data: unknown;
}

interface OrderItem {
  product_id?: string;
  product_name: string;
  quantity: number;
  price_per_unit: number;
}

interface MenuMetrics {
  menuId: string;
  menuName: string;
  views: number;
  uniqueVisitors: number;
  orders: number;
  revenue: number;
  conversionRate: number;
  avgOrderValue: number;
  topProducts: { name: string; revenue: number; orders: number }[];
}

interface MetricDefinition {
  key: keyof Omit<MenuMetrics, 'menuId' | 'menuName' | 'topProducts'>;
  label: string;
  format: 'number' | 'currency' | 'percentage';
  icon: React.ElementType;
  color: string;
  higherIsBetter: boolean;
}

const METRICS: MetricDefinition[] = [
  { key: 'views', label: 'Total Views', format: 'number', icon: Eye, color: 'text-violet-500', higherIsBetter: true },
  { key: 'uniqueVisitors', label: 'Unique Visitors', format: 'number', icon: Eye, color: 'text-blue-500', higherIsBetter: true },
  { key: 'orders', label: 'Orders', format: 'number', icon: ShoppingCart, color: 'text-emerald-500', higherIsBetter: true },
  { key: 'revenue', label: 'Total Revenue', format: 'currency', icon: DollarSign, color: 'text-green-500', higherIsBetter: true },
  { key: 'conversionRate', label: 'Conversion Rate', format: 'percentage', icon: TrendingUp, color: 'text-indigo-500', higherIsBetter: true },
  { key: 'avgOrderValue', label: 'Avg Order Value', format: 'currency', icon: DollarSign, color: 'text-amber-500', higherIsBetter: true },
];

function formatMetricValue(value: number, format: 'number' | 'currency' | 'percentage'): string {
  switch (format) {
    case 'currency':
      return formatCurrency(value);
    case 'percentage':
      return `${value.toFixed(1)}%`;
    default:
      return value.toLocaleString();
  }
}

function WinnerBadge({ rank }: { rank: 1 | 2 | 3 }) {
  if (rank === 1) {
    return (
      <Badge className="bg-yellow-500 text-white ml-2">
        <Crown className="h-3 w-3 mr-1" />
        Winner
      </Badge>
    );
  }
  if (rank === 2) {
    return (
      <Badge variant="outline" className="border-slate-400 text-slate-600 ml-2">
        <Medal className="h-3 w-3 mr-1" />
        2nd
      </Badge>
    );
  }
  return null;
}

export function MenuComparison({ className }: MenuComparisonProps) {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;

  const [selectedMenuIds, setSelectedMenuIds] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });

  // Fetch menus for selector
  const { data: menus = [], isLoading: menusLoading } = useQuery({
    queryKey: ['menu-comparison-menus', tenantId],
    queryFn: async (): Promise<MenuOption[]> => {
      if (!tenantId) return [];

      const { data, error } = await supabase
        .from('disposable_menus')
        .select('id, name')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (error) {
        logger.warn('Failed to fetch menus for comparison selector', { error: error.message });
        return [];
      }

      return (data || []) as MenuOption[];
    },
    enabled: !!tenantId,
    staleTime: 60 * 1000,
  });

  // Fetch analytics for all selected menus
  const fetchMenuMetrics = useCallback(async (menuIdToFetch: string): Promise<MenuMetrics | null> => {
    const menu = menus.find(m => m.id === menuIdToFetch);
    if (!menu) return null;

    const fromDate = dateRange?.from ? startOfDay(dateRange.from).toISOString() : undefined;
    const toDate = dateRange?.to ? endOfDay(dateRange.to).toISOString() : undefined;

    // Fetch access logs
    let logsQuery = supabase
      .from('menu_access_logs')
      .select('id, menu_id, accessed_at, ip_address')
      .eq('menu_id', menuIdToFetch);

    if (fromDate) logsQuery = logsQuery.gte('accessed_at', fromDate);
    if (toDate) logsQuery = logsQuery.lte('accessed_at', toDate);

    const { data: accessLogs, error: logsError } = await logsQuery;

    if (logsError) {
      logger.warn('Failed to fetch access logs for menu comparison', { error: logsError.message, menuId: menuIdToFetch });
    }

    // Fetch orders for this menu
    let ordersQuery = supabase
      .from('menu_orders')
      .select('id, menu_id, total_amount, status, created_at, order_data')
      .eq('menu_id', menuIdToFetch)
      .eq('tenant_id', tenantId!);

    if (fromDate) ordersQuery = ordersQuery.gte('created_at', fromDate);
    if (toDate) ordersQuery = ordersQuery.lte('created_at', toDate);

    const { data: orders, error: ordersError } = await ordersQuery;

    if (ordersError) {
      logger.warn('Failed to fetch orders for menu comparison', { error: ordersError.message, menuId: menuIdToFetch });
    }

    const logs = (accessLogs || []) as AccessLogRow[];
    const orderList = (orders || []) as MenuOrderRow[];

    // Calculate metrics
    const views = logs.length;
    const uniqueVisitors = new Set(logs.map(l => l.ip_address || l.id)).size;
    const completedOrders = orderList.filter(o =>
      o.status === 'completed' || o.status === 'delivered' || o.status === 'pending'
    );
    const ordersCount = completedOrders.length;
    const revenue = completedOrders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0);
    const avgOrderValue = ordersCount > 0 ? revenue / ordersCount : 0;
    const conversionRate = views > 0 ? (ordersCount / views) * 100 : 0;

    // Popular products
    const productMap: Record<string, { name: string; orders: number; revenue: number }> = {};
    orderList.forEach(order => {
      const orderData = order.order_data as { items?: OrderItem[] } | null;
      const items = orderData?.items || [];
      items.forEach((item: OrderItem) => {
        const key = item.product_id || item.product_name;
        if (!productMap[key]) {
          productMap[key] = { name: item.product_name, orders: 0, revenue: 0 };
        }
        productMap[key].orders += item.quantity || 1;
        productMap[key].revenue += (item.price_per_unit || 0) * (item.quantity || 1);
      });
    });
    const topProducts = Object.values(productMap)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    return {
      menuId: menuIdToFetch,
      menuName: menu.name,
      views,
      uniqueVisitors,
      orders: ordersCount,
      revenue,
      conversionRate,
      avgOrderValue,
      topProducts,
    };
  }, [dateRange, tenantId, menus]);

  const { data: metricsData, isLoading: metricsLoading, refetch } = useQuery({
    queryKey: ['menu-comparison-metrics', selectedMenuIds, dateRange?.from?.toISOString(), dateRange?.to?.toISOString()],
    queryFn: async (): Promise<MenuMetrics[]> => {
      const results = await Promise.all(selectedMenuIds.map(fetchMenuMetrics));
      return results.filter((r): r is MenuMetrics => r !== null);
    },
    enabled: !!tenantId && selectedMenuIds.length >= 2,
    staleTime: 30 * 1000,
  });

  const addMenu = (menuId: string) => {
    if (menuId && !selectedMenuIds.includes(menuId) && selectedMenuIds.length < 3) {
      setSelectedMenuIds([...selectedMenuIds, menuId]);
    }
  };

  const removeMenu = (menuId: string) => {
    setSelectedMenuIds(selectedMenuIds.filter(id => id !== menuId));
  };

  // Find winner for each metric
  const getWinnerRanking = useCallback((metricKey: keyof Omit<MenuMetrics, 'menuId' | 'menuName' | 'topProducts'>, menuId: string): 1 | 2 | 3 | null => {
    if (!metricsData || metricsData.length < 2) return null;

    const metricDef = METRICS.find(m => m.key === metricKey);
    if (!metricDef) return null;

    const sorted = [...metricsData].sort((a, b) => {
      const diff = b[metricKey] - a[metricKey];
      return metricDef.higherIsBetter ? diff : -diff;
    });

    const index = sorted.findIndex(m => m.menuId === menuId);
    if (index === 0) return 1;
    if (index === 1) return 2;
    if (index === 2) return 3;
    return null;
  }, [metricsData]);

  // Calculate total wins
  const winCounts = useMemo(() => {
    if (!metricsData) return {};
    const counts: Record<string, number> = {};
    metricsData.forEach(m => { counts[m.menuId] = 0; });

    METRICS.forEach(metric => {
      const sorted = [...metricsData].sort((a, b) => {
        const diff = b[metric.key] - a[metric.key];
        return metric.higherIsBetter ? diff : -diff;
      });
      if (sorted.length > 0) {
        counts[sorted[0].menuId]++;
      }
    });

    return counts;
  }, [metricsData]);

  // Export data
  const exportData = useMemo(() => {
    if (!metricsData) return [];
    return METRICS.map(metric => {
      const row: Record<string, string | number> = { Metric: metric.label };
      metricsData.forEach(m => {
        row[m.menuName] = formatMetricValue(m[metric.key], metric.format);
      });
      return row;
    });
  }, [metricsData]);

  const availableMenus = menus.filter(m => !selectedMenuIds.includes(m.id));

  if (menusLoading) {
    return (
      <div className={cn('space-y-6', className)}>
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-10 w-64" />
        </div>
        <div className="grid gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header with Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <Trophy className="h-5 w-5 text-amber-500" />
          <h2 className="text-lg font-semibold">Menu Comparison</h2>
          {metricsLoading && (
            <Badge variant="outline" className="animate-pulse">
              <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
              Updating...
            </Badge>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 ml-auto">
          {/* Date Range Picker */}
          <AnalyticsDateRangePicker
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
          />

          {/* Refresh Button */}
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={selectedMenuIds.length < 2}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>

          {/* Export Button */}
          {metricsData && metricsData.length >= 2 && (
            <AnalyticsExportButton
              data={exportData}
              filename={`menu-comparison-${format(new Date(), 'yyyy-MM-dd')}`}
            />
          )}
        </div>
      </div>

      {/* Menu Selection */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Select Menus to Compare</CardTitle>
          <CardDescription>Choose 2-3 menus to compare their performance side by side</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-3">
            {/* Selected Menus */}
            {selectedMenuIds.map((menuId) => {
              const menu = menus.find(m => m.id === menuId);
              const wins = winCounts[menuId] || 0;
              return (
                <div
                  key={menuId}
                  className="flex items-center gap-2 px-3 py-2 bg-primary/5 border border-primary/20 rounded-lg"
                >
                  <span className="font-medium">{menu?.name || 'Unknown Menu'}</span>
                  {metricsData && metricsData.length >= 2 && wins > 0 && (
                    <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">
                      {wins} {wins === 1 ? 'win' : 'wins'}
                    </Badge>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => removeMenu(menuId)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}

            {/* Add Menu Selector */}
            {selectedMenuIds.length < 3 && availableMenus.length > 0 && (
              <Select onValueChange={addMenu}>
                <SelectTrigger className="w-48">
                  <Plus className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Add menu..." />
                </SelectTrigger>
                <SelectContent>
                  {availableMenus.map((menu) => (
                    <SelectItem key={menu.id} value={menu.id}>
                      {menu.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {selectedMenuIds.length < 2 && (
            <p className="text-sm text-muted-foreground mt-4">
              Select at least 2 menus to start comparing
            </p>
          )}
        </CardContent>
      </Card>

      {/* Comparison Results */}
      {selectedMenuIds.length >= 2 && metricsData && metricsData.length >= 2 && (
        <>
          {/* Metrics Comparison Table */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-indigo-500" />
                Performance Metrics
              </CardTitle>
              <CardDescription>
                Winners highlighted per metric — {metricsData.length} menus compared
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-48">Metric</TableHead>
                      {metricsData.map((m) => (
                        <TableHead key={m.menuId} className="text-center min-w-32">
                          <div className="font-semibold">{m.menuName}</div>
                          {winCounts[m.menuId] === METRICS.length && (
                            <Badge className="bg-yellow-500 text-white mt-1">
                              <Crown className="h-3 w-3 mr-1" />
                              Overall Winner
                            </Badge>
                          )}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {METRICS.map((metric) => {
                      const Icon = metric.icon;
                      return (
                        <TableRow key={metric.key}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Icon className={cn('h-4 w-4', metric.color)} />
                              <span className="font-medium">{metric.label}</span>
                            </div>
                          </TableCell>
                          {metricsData.map((m) => {
                            const rank = getWinnerRanking(metric.key, m.menuId);
                            const isWinner = rank === 1;
                            return (
                              <TableCell
                                key={m.menuId}
                                className={cn(
                                  'text-center font-medium',
                                  isWinner && 'bg-yellow-50 dark:bg-yellow-950/20'
                                )}
                              >
                                <div className="flex items-center justify-center">
                                  <span className={cn(isWinner && 'text-yellow-700 dark:text-yellow-400')}>
                                    {formatMetricValue(m[metric.key], metric.format)}
                                  </span>
                                  {rank && <WinnerBadge rank={rank} />}
                                </div>
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Top Products Comparison */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Package className="h-4 w-4 text-emerald-500" />
                Top Products by Menu
              </CardTitle>
              <CardDescription>
                Best selling products from each menu
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {metricsData.map((m) => (
                  <div key={m.menuId} className="space-y-3">
                    <h4 className="font-semibold text-sm border-b pb-2">{m.menuName}</h4>
                    {m.topProducts.length > 0 ? (
                      <div className="space-y-2">
                        {m.topProducts.map((product, idx) => (
                          <div
                            key={`${m.menuId}-${product.name}-${idx}`}
                            className="flex items-center justify-between text-sm"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-xs text-muted-foreground w-4">
                                #{idx + 1}
                              </span>
                              <span className="truncate">{product.name}</span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0 ml-2">
                              <span className="text-xs text-muted-foreground">
                                {product.orders} sold
                              </span>
                              <span className="font-medium text-emerald-600">
                                {formatCurrency(product.revenue)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No products sold yet</p>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Summary Insights */}
          <Card className="bg-gradient-to-r from-indigo-500/5 via-purple-500/5 to-pink-500/5 border-indigo-500/20">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-yellow-100 dark:bg-yellow-900/20 rounded-full">
                  <Trophy className="h-6 w-6 text-yellow-600" />
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Comparison Summary</h3>
                  <div className="space-y-1 text-sm text-muted-foreground">
                    {metricsData.map((m) => {
                      const wins = winCounts[m.menuId] || 0;
                      return (
                        <div key={m.menuId} className="flex items-center gap-2">
                          <span className="font-medium text-foreground">{m.menuName}:</span>
                          <span>
                            {wins === 0 ? 'No wins' : `${wins} ${wins === 1 ? 'win' : 'wins'} out of ${METRICS.length} metrics`}
                          </span>
                          {wins === METRICS.length && (
                            <Badge className="bg-yellow-500 text-white text-xs">
                              Best Overall
                            </Badge>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <p className="mt-3 text-sm">
                    Use this data to identify which menu format works best for your customers.
                    Consider factors like promotion timing, product selection, and target audience.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Empty State */}
      {menus.length === 0 && (
        <Card className="p-12">
          <div className="text-center text-muted-foreground">
            <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium">No menus available</p>
            <p className="text-sm mt-2">Create some menus first to compare their performance</p>
          </div>
        </Card>
      )}

      {menus.length > 0 && menus.length < 2 && (
        <Card className="p-12">
          <div className="text-center text-muted-foreground">
            <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium">Need more menus</p>
            <p className="text-sm mt-2">Create at least 2 menus to compare their performance</p>
          </div>
        </Card>
      )}
    </div>
  );
}
