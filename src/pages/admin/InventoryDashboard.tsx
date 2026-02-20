import { useEffect, useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import {
  Package,
  DollarSign,
  AlertTriangle,
  PackageX,
  TrendingUp,
  RefreshCw,
  ShoppingCart,
  Loader2,
  History,
  Layers,
} from 'lucide-react';

import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import { cn } from '@/lib/utils';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { InventoryHistoryTimeline } from '@/components/admin/inventory/InventoryHistoryTimeline';
import { toast } from 'sonner';
import { TruncatedText } from '@/components/shared/TruncatedText';

interface InventoryStats {
  totalProducts: number;
  totalStockValue: number;
  lowStockCount: number;
  outOfStockCount: number;
  totalQuantity: number;
}

interface CategoryStock {
  category: string;
  quantity: number;
  value: number;
  productCount: number;
}

interface StockDistribution {
  name: string;
  value: number;
  color: string;
}

interface LowStockProduct {
  id: string;
  name: string;
  sku: string | null;
  stock_quantity: number;
  price: number;
  category: string | null;
  min_stock_level: number;
}

const STOCK_COLORS = {
  outOfStock: '#ef4444',
  critical: '#f97316',
  low: '#eab308',
  adequate: '#22c55e',
  overstocked: '#3b82f6',
};

export default function InventoryDashboard() {
  const navigate = useNavigate();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { tenant, loading: authLoading } = useTenantAdminAuth();
  const tenantId = tenant?.id;
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  // Realtime Subscription for Inventory Updates
  useEffect(() => {
    if (!tenantId) return;

    const channel = supabase
      .channel(`inventory-dashboard-updates-${tenantId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'products',
          filter: `tenant_id=eq.${tenantId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: queryKeys.inventory.stats(tenantId) });
          queryClient.invalidateQueries({ queryKey: queryKeys.inventory.categoryStock(tenantId) });
          queryClient.invalidateQueries({ queryKey: queryKeys.inventory.stockDistribution(tenantId) });
          queryClient.invalidateQueries({ queryKey: queryKeys.inventory.lowStockProducts(tenantId) });
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          logger.error('Inventory subscription error', { status, component: 'InventoryDashboard' });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, tenantId]);

  // Fetch inventory stats
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: queryKeys.inventory.stats(tenantId),
    queryFn: async (): Promise<InventoryStats> => {
      if (!tenantId) {
        return {
          totalProducts: 0,
          totalStockValue: 0,
          lowStockCount: 0,
          outOfStockCount: 0,
          totalQuantity: 0,
        };
      }

      const { data: products, error } = await (supabase as any)
        .from('products')
        .select('id, stock_quantity, price, min_stock_level, in_stock')
        .eq('tenant_id', tenantId);

      if (error) {
        logger.error('Failed to fetch inventory stats', { error, component: 'InventoryDashboard' });
        throw error;
      }

      const productsList = (products || []) as any[];
      const totalProducts = productsList.length;
      const totalQuantity = productsList.reduce((sum: number, p: any) => sum + (p.stock_quantity || 0), 0);
      const totalStockValue = productsList.reduce(
        (sum: number, p: any) => sum + (p.stock_quantity || 0) * (p.price || 0),
        0
      );
      const outOfStockCount = productsList.filter((p: any) => (p.stock_quantity || 0) === 0).length;
      const lowStockCount = productsList.filter((p: any) => {
        const qty = p.stock_quantity || 0;
        const minLevel = p.min_stock_level || 10;
        return qty > 0 && qty <= minLevel;
      }).length;

      return {
        totalProducts,
        totalStockValue,
        lowStockCount,
        outOfStockCount,
        totalQuantity,
      };
    },
    enabled: !!tenantId,
  });

  // Fetch category-wise stock breakdown
  const { data: categoryData = [], isLoading: categoryLoading } = useQuery({
    queryKey: queryKeys.inventory.categoryStock(tenantId),
    queryFn: async (): Promise<CategoryStock[]> => {
      if (!tenantId) return [];

      const { data: products, error } = await supabase
        .from('products')
        .select('category, stock_quantity, price')
        .eq('tenant_id', tenantId);

      if (error) {
        logger.error('Failed to fetch category stock', { error, component: 'InventoryDashboard' });
        throw error;
      }

      const categoryMap = new Map<string, CategoryStock>();

      products?.forEach((p) => {
        const category = p.category || 'Uncategorized';
        const existing = categoryMap.get(category) || {
          category,
          quantity: 0,
          value: 0,
          productCount: 0,
        };

        existing.quantity += p.stock_quantity || 0;
        existing.value += (p.stock_quantity || 0) * (p.price || 0);
        existing.productCount += 1;

        categoryMap.set(category, existing);
      });

      return Array.from(categoryMap.values()).sort((a, b) => b.value - a.value);
    },
    enabled: !!tenantId,
  });

  // Fetch stock level distribution
  const { data: stockDistribution = [], isLoading: distributionLoading } = useQuery({
    queryKey: queryKeys.inventory.stockDistribution(tenantId),
    queryFn: async (): Promise<StockDistribution[]> => {
      if (!tenantId) return [];

      const { data: products, error } = await (supabase as any)
        .from('products')
        .select('stock_quantity, min_stock_level')
        .eq('tenant_id', tenantId);

      if (error) {
        logger.error('Failed to fetch stock distribution', { error, component: 'InventoryDashboard' });
        throw error;
      }

      let outOfStock = 0;
      let critical = 0;
      let low = 0;
      let adequate = 0;
      let overstocked = 0;

      (products as any[])?.forEach((p: any) => {
        const qty = p.stock_quantity || 0;
        const minLevel = p.min_stock_level || 10;
        const maxLevel = minLevel * 5;

        if (qty === 0) {
          outOfStock++;
        } else if (qty <= minLevel * 0.5) {
          critical++;
        } else if (qty <= minLevel) {
          low++;
        } else if (qty <= maxLevel) {
          adequate++;
        } else {
          overstocked++;
        }
      });

      return [
        { name: 'Out of Stock', value: outOfStock, color: STOCK_COLORS.outOfStock },
        { name: 'Critical', value: critical, color: STOCK_COLORS.critical },
        { name: 'Low Stock', value: low, color: STOCK_COLORS.low },
        { name: 'Adequate', value: adequate, color: STOCK_COLORS.adequate },
        { name: 'Overstocked', value: overstocked, color: STOCK_COLORS.overstocked },
      ].filter((d) => d.value > 0);
    },
    enabled: !!tenantId,
  });

  // Fetch low stock products for alerts
  const { data: lowStockProducts = [], isLoading: lowStockLoading } = useQuery({
    queryKey: queryKeys.inventory.lowStockProducts(tenantId),
    queryFn: async (): Promise<LowStockProduct[]> => {
      if (!tenantId) return [];

      const { data, error } = await (supabase as any)
        .from('products')
        .select('id, name, sku, stock_quantity, price, category, min_stock_level')
        .eq('tenant_id', tenantId)
        .or('stock_quantity.eq.0,stock_quantity.lte.10')
        .order('stock_quantity', { ascending: true })
        .limit(20);

      if (error) {
        logger.error('Failed to fetch low stock products', { error, component: 'InventoryDashboard' });
        throw error;
      }

      return (data || []).map((p: any) => ({
        ...p,
        min_stock_level: p.min_stock_level || 10,
      })) as LowStockProduct[];
    },
    enabled: !!tenantId,
  });

  // Quick reorder mutation
  const reorderMutation = useMutation({
    mutationFn: async (productId: string) => {
      // Navigate to purchase order creation with the product pre-selected
      navigate(`/${tenantSlug}/admin/purchase-orders/new?productId=${productId}`);
    },
    onError: (error: Error) => {
      logger.error('Failed to initiate reorder', { error, component: 'InventoryDashboard' });
      toast.error('Failed to initiate reorder');
    },
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory.stats(tenantId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory.categoryStock(tenantId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory.stockDistribution(tenantId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory.lowStockProducts(tenantId) }),
    ]);
    setRefreshing(false);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(value);
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="container mx-auto py-12 px-4">
        <Card className="max-w-2xl mx-auto">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl mb-2">Access Denied</CardTitle>
            <CardDescription>
              You need to be logged in as a tenant admin to access this page.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button onClick={() => navigate('/saas/login')}>Go to Login</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const statCards = [
    {
      title: 'Total Products',
      value: stats?.totalProducts || 0,
      icon: Package,
      color: 'text-blue-500',
      bg: 'bg-blue-500/10',
    },
    {
      title: 'Total Stock Value',
      value: formatCurrency(stats?.totalStockValue || 0),
      icon: DollarSign,
      color: 'text-green-500',
      bg: 'bg-green-500/10',
    },
    {
      title: 'Low Stock',
      value: stats?.lowStockCount || 0,
      icon: AlertTriangle,
      color: 'text-yellow-500',
      bg: 'bg-yellow-500/10',
    },
    {
      title: 'Out of Stock',
      value: stats?.outOfStockCount || 0,
      icon: PackageX,
      color: 'text-red-500',
      bg: 'bg-red-500/10',
    },
  ];

  return (
    <div className="container mx-auto py-4 sm:py-6 space-y-6 pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-2 sm:px-0">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Inventory Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Overview of all inventory across your operation
          </p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex-1 sm:flex-none"
          >
            <RefreshCw className={cn('h-4 w-4 mr-2', refreshing && 'animate-spin')} />
            Refresh
          </Button>
          <Button
            className="flex-1 sm:flex-none"
            onClick={() => navigate(`/${tenantSlug}/admin/inventory`)}
          >
            <Package className="h-4 w-4 mr-2" />
            Manage Inventory
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {statsLoading
          ? [1, 2, 3, 4].map((i) => (
              <Card key={i} className="border-none shadow-sm">
                <CardHeader className="pb-2">
                  <Skeleton className="h-4 w-24" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-20" />
                </CardContent>
              </Card>
            ))
          : statCards.map((stat) => (
              <Card key={stat.title} className="border-none shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {stat.title}
                  </CardTitle>
                  <div className={cn('p-2 rounded-full', stat.bg)}>
                    <stat.icon className={cn('h-4 w-4', stat.color)} />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stat.value}</div>
                </CardContent>
              </Card>
            ))}
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="overview" className="flex-1 sm:flex-none">
            <TrendingUp className="h-4 w-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="alerts" className="flex-1 sm:flex-none">
            <AlertTriangle className="h-4 w-4 mr-2" />
            Low Stock Alerts
            {(stats?.lowStockCount || 0) + (stats?.outOfStockCount || 0) > 0 && (
              <Badge variant="destructive" className="ml-2">
                {(stats?.lowStockCount || 0) + (stats?.outOfStockCount || 0)}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="history" className="flex-1 sm:flex-none">
            <History className="h-4 w-4 mr-2" />
            Recent Changes
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Stock Level Distribution Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Layers className="h-5 w-5" />
                  Stock Level Distribution
                </CardTitle>
                <CardDescription>
                  Products grouped by stock level status
                </CardDescription>
              </CardHeader>
              <CardContent>
                {distributionLoading ? (
                  <div className="h-64 flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : stockDistribution.length === 0 ? (
                  <div className="h-64 flex items-center justify-center text-muted-foreground">
                    No products found
                  </div>
                ) : (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={stockDistribution}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={2}
                          dataKey="value"
                          label={({ name, value }) => `${name}: ${value}`}
                          labelLine={false}
                        >
                          {stockDistribution.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value: number, name: string) => [
                            `${value} ${value === 1 ? 'product' : 'products'}`,
                            name,
                          ]}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
                {/* Legend */}
                <div className="flex flex-wrap justify-center gap-4 mt-4">
                  {stockDistribution.map((item) => (
                    <div key={item.name} className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-sm text-muted-foreground">
                        {item.name} ({item.value})
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Category-wise Stock Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Stock by Category
                </CardTitle>
                <CardDescription>
                  Inventory value breakdown by product category
                </CardDescription>
              </CardHeader>
              <CardContent>
                {categoryLoading ? (
                  <div className="h-64 flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : categoryData.length === 0 ? (
                  <div className="h-64 flex items-center justify-center text-muted-foreground">
                    No category data available
                  </div>
                ) : (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={categoryData.slice(0, 6)} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis type="number" tickFormatter={(v) => formatCurrency(v)} />
                        <YAxis
                          type="category"
                          dataKey="category"
                          width={100}
                          tick={{ fontSize: 12 }}
                        />
                        <Tooltip
                          formatter={(value: number) => [formatCurrency(value), 'Value']}
                          labelFormatter={(label) => `Category: ${label}`}
                        />
                        <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
                {/* Category Stats */}
                {categoryData.length > 0 && (
                  <div className="mt-4 space-y-2">
                    {categoryData.slice(0, 5).map((cat) => (
                      <div
                        key={cat.category}
                        className="flex items-center justify-between text-sm"
                      >
                        <span className="text-muted-foreground">{cat.category}</span>
                        <div className="flex items-center gap-4">
                          <span>{cat.productCount} products</span>
                          <span className="font-medium">{cat.quantity} units</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Low Stock Alerts Tab */}
        <TabsContent value="alerts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
                Low Stock Alerts
              </CardTitle>
              <CardDescription>
                Products that need restocking - click to create a purchase order
              </CardDescription>
            </CardHeader>
            <CardContent>
              {lowStockLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="space-y-2">
                        <Skeleton className="h-5 w-48" />
                        <Skeleton className="h-4 w-24" />
                      </div>
                      <Skeleton className="h-9 w-24" />
                    </div>
                  ))}
                </div>
              ) : lowStockProducts.length === 0 ? (
                <div className="text-center py-12">
                  <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4 opacity-50" />
                  <p className="text-lg font-medium text-muted-foreground">
                    All products are well stocked!
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    No products require immediate attention
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {lowStockProducts.map((product) => {
                    const isOutOfStock = product.stock_quantity === 0;
                    const isCritical = product.stock_quantity <= product.min_stock_level * 0.5;

                    return (
                      <div
                        key={product.id}
                        className={cn(
                          'flex items-center justify-between p-4 border rounded-lg transition-colors',
                          isOutOfStock
                            ? 'border-red-200 bg-red-50 dark:bg-red-950/20'
                            : isCritical
                            ? 'border-orange-200 bg-orange-50 dark:bg-orange-950/20'
                            : 'border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20'
                        )}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <TruncatedText text={product.name} className="font-medium" />
                            {isOutOfStock ? (
                              <Badge variant="destructive">Out of Stock</Badge>
                            ) : isCritical ? (
                              <Badge className="bg-orange-500">Critical</Badge>
                            ) : (
                              <Badge className="bg-yellow-500">Low Stock</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                            {product.sku && <span>SKU: {product.sku}</span>}
                            <span>
                              Stock: {product.stock_quantity} / Min: {product.min_stock_level}
                            </span>
                            {product.category && <span>{product.category}</span>}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => reorderMutation.mutate(product.id)}
                          className="ml-4 shrink-0"
                        >
                          <ShoppingCart className="h-4 w-4 mr-2" />
                          Reorder
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Recent Changes Tab */}
        <TabsContent value="history" className="space-y-4">
          <InventoryHistoryTimeline className="border-none shadow-sm" />
        </TabsContent>
      </Tabs>
    </div>
  );
}
