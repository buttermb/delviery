import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTenantNavigation } from "@/lib/navigation/tenantNavigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Package, Plus, ArrowRightLeft, TrendingUp, Truck } from "lucide-react";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import { useWholesaleInventory, useWholesaleDeliveries } from "@/hooks/useWholesaleData";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { EnhancedEmptyState } from "@/components/shared/EnhancedEmptyState";
import { EnhancedLoadingState } from "@/components/EnhancedLoadingState";
import { ResponsiveTable, ResponsiveColumn } from '@/components/shared/ResponsiveTable';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { queryKeys } from '@/lib/queryKeys';

interface InventoryDisplayItem {
  id: string;
  strain: string;
  weight_lbs: number;
  cost_per_lb: number;
  value: number;
  status: string;
}

export default function WholesaleInventory() {
  const { navigateToAdmin } = useTenantNavigation();
  const { tenant } = useTenantAdminAuth();
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>("all");

  // Fetch real data
  const { data: inventory = [], isLoading: inventoryLoading, isError: isInventoryError, error: inventoryError, refetch: refetchInventory } = useWholesaleInventory(tenant?.id);
  const { data: deliveries = [], isLoading: deliveriesLoading, isError: isDeliveriesError, error: deliveriesError, refetch: refetchDeliveries } = useWholesaleDeliveries();

  const isLoading = inventoryLoading || deliveriesLoading;

  // Process Inventory Data
  const totalStockLbs = inventory.reduce((sum, item) => sum + (Number(item.quantity_lbs) || 0), 0);
  const totalStockKg = totalStockLbs * 0.453592;
  const totalValue = inventory.reduce((sum, item) => sum + ((Number(item.quantity_lbs) || 0) * (Number(item.cost_per_lb) || 0)), 0);
  const avgCostPerLb = totalStockLbs > 0 ? totalValue / totalStockLbs : 0;

  const overview = {
    total_stock_lbs: totalStockLbs,
    total_stock_kg: totalStockKg,
    total_value: totalValue,
    avg_cost_per_lb: avgCostPerLb
  };

  // Group by Category
  interface WarehouseGroup {
    id: string;
    name: string;
    location: string;
    current_stock_lbs: number;
    value: number;
    status: string;
    inventory: InventoryDisplayItem[];
  }

  const warehouseMap = new Map<string, WarehouseGroup>();

  inventory.forEach(item => {
    const category = item.category || "Uncategorized";
    if (!warehouseMap.has(category)) {
      warehouseMap.set(category, {
        id: category,
        name: category,
        location: category,
        current_stock_lbs: 0,
        value: 0,
        status: "good",
        inventory: []
      });
    }

    const group = warehouseMap.get(category)!;
    const qty = Number(item.quantity_lbs) || 0;
    const cost = Number(item.cost_per_lb) || 0;

    group.current_stock_lbs += qty;
    group.value += qty * cost;

    let status = "good";
    if (qty < 10) status = "very_low";
    else if (qty < 25) status = "low";

    group.inventory.push({
      id: item.id || `inv-${item.product_name}-${category}`,
      strain: item.product_name,
      weight_lbs: qty,
      cost_per_lb: cost,
      value: qty * cost,
      status,
    });
  });

  const warehouses = Array.from(warehouseMap.values());

  // Process Active Deliveries — uses joined order/runner data from useWholesaleDeliveries
  const activeDeliveries = deliveries
    .filter(d => ['pending', 'in_transit'].includes(d.status))
    .slice(0, 5)
    .map(d => ({
      id: d.id,
      runner: d.runner?.full_name || "Unassigned",
      destination: d.order?.delivery_address || "Address pending",
      orderNumber: d.order?.order_number || "N/A",
      status: d.status,
    }));

  // Fetch Top Movers from wholesale_order_items (last 30 days)
  const { data: topMovers = [], isError: isTopMoversError, error: topMoversError, refetch: refetchTopMovers } = useQuery({
    queryKey: queryKeys.wholesaleInventory.topMovers(tenant?.id),
    queryFn: async () => {
      if (!tenant?.id) return [];

      // Get orders from last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // Fetch order items with product names
      const { data: items, error } = await supabase
        .from('wholesale_order_items')
        .select(`
          product_name,
          quantity,
          unit_price,
          subtotal,
          order_id,
          wholesale_orders!inner(tenant_id, status, created_at)
        `)
        .eq('wholesale_orders.tenant_id', tenant.id)
        .gte('wholesale_orders.created_at', thirtyDaysAgo.toISOString())
        .in('wholesale_orders.status', ['delivered', 'in_transit', 'assigned', 'pending']);

      if (error) {
        logger.error('Failed to fetch top movers', { error, component: 'WholesaleInventory' });
        return [];
      }

      if (!items || items.length === 0) {
        return [];
      }

      // Aggregate by product name
      const productMap = new Map<string, { quantity: number; revenue: number }>();
      items.forEach(item => {
        const existing = productMap.get(item.product_name) || { quantity: 0, revenue: 0 };
        existing.quantity += item.quantity ?? 0;
        existing.revenue += Number(item.subtotal) || 0;
        productMap.set(item.product_name, existing);
      });

      // Convert to array and sort by quantity
      const aggregated = Array.from(productMap.entries())
        .map(([name, data]) => ({
          strain: name,
          lbs_moved: data.quantity,
          revenue: data.revenue,
          profit: Math.round(data.revenue * 0.32) // Estimate ~32% profit margin
        }))
        .sort((a, b) => b.lbs_moved - a.lbs_moved)
        .slice(0, 5);

      return aggregated;
    },
    enabled: !!tenant?.id,
    staleTime: 60_000,
    gcTime: 300_000,
    retry: 2,
  });

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      good: "bg-primary/10 text-primary border-primary/20",
      low: "bg-orange-500/10 dark:bg-orange-950/50 text-orange-600 dark:text-orange-400 border-orange-500/20 dark:border-orange-700",
      very_low: "bg-destructive/10 text-destructive border-destructive/20"
    };
    return colors[status] || "";
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      good: "In Stock",
      low: "Low",
      very_low: "Very Low"
    };
    return labels[status] || status;
  };

  const columns = useMemo<ResponsiveColumn<InventoryDisplayItem>[]>(() => [
    {
      header: "Strain",
      accessorKey: "strain",
      className: "font-medium"
    },
    {
      header: "Weight (lbs)",
      accessorKey: "weight_lbs",
    },
    {
      header: "Cost / lb",
      cell: (item) => formatCurrency(item.cost_per_lb)
    },
    {
      header: "Total Value",
      cell: (item) => formatCurrency(item.value)
    },
    {
      header: "Status",
      cell: (item) => (
        <Badge variant="outline" className={getStatusColor(item.status)}>
          {getStatusLabel(item.status)}
        </Badge>
      )
    }
  ], []);

  const renderMobileCard = (item: InventoryDisplayItem) => (
    <div className="flex flex-col gap-2">
      <div className="flex justify-between items-start">
        <span className="font-medium">{item.strain}</span>
        <Badge variant="outline" className={getStatusColor(item.status)}>
          {getStatusLabel(item.status)}
        </Badge>
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="flex flex-col">
          <span className="text-muted-foreground">Weight</span>
          <span>{item.weight_lbs} lbs</span>
        </div>
        <div className="flex flex-col text-right">
          <span className="text-muted-foreground">Value</span>
          <span>{formatCurrency(item.value)}</span>
        </div>
      </div>
    </div>
  );

  if (isLoading) {
    return <EnhancedLoadingState variant="dashboard" />;
  }

  const isError = isInventoryError || isDeliveriesError || isTopMoversError;
  if (isError) {
    const errorMessage = inventoryError?.message || deliveriesError?.message || topMoversError?.message || 'An unexpected error occurred';
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <p className="text-destructive font-medium">Failed to load data</p>
        <p className="text-sm text-muted-foreground mt-1">{errorMessage}</p>
        <Button variant="outline" size="sm" className="mt-4" onClick={() => {
          if (isInventoryError) refetchInventory();
          if (isDeliveriesError) refetchDeliveries();
          if (isTopMoversError) refetchTopMovers();
        }}>
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Inventory Management</h1>
          <p className="text-sm text-muted-foreground mt-1">Wholesale scale inventory tracking</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="gap-2 min-w-[100px]"
            onClick={() => navigateToAdmin('inventory-management')}
          >
            <ArrowRightLeft className="h-4 w-4" />
            Move Stock
          </Button>
          <Button
            className="bg-emerald-500 hover:bg-emerald-600 gap-2 min-w-[100px]"
            onClick={() => navigateToAdmin('inventory-management')}
          >
            <Plus className="h-4 w-4" />
            Add Stock
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 space-y-2">
          <div className="text-sm font-medium text-muted-foreground">Total Stock (lbs)</div>
          <div className="text-2xl font-bold">{overview.total_stock_lbs.toLocaleString()} lbs</div>
          <div className="text-xs text-muted-foreground">{overview.total_stock_kg.toFixed(1)} kg</div>
        </Card>
        <Card className="p-4 space-y-2">
          <div className="text-sm font-medium text-muted-foreground">Total Value</div>
          <div className="text-2xl font-bold">{formatCurrency(overview.total_value)}</div>
          <div className="text-xs text-emerald-500 flex items-center">
            <TrendingUp className="h-3 w-3 mr-1" />
            Asset Value
          </div>
        </Card>
        <Card className="p-4 space-y-2">
          <div className="text-sm font-medium text-muted-foreground">Avg Cost / lb</div>
          <div className="text-2xl font-bold">{formatCurrency(overview.avg_cost_per_lb)}</div>
          <div className="text-xs text-muted-foreground">Across all strains</div>
        </Card>
        <Card className="p-4 space-y-2">
          <div className="text-sm font-medium text-muted-foreground">Active Deliveries</div>
          <div className="text-2xl font-bold">{activeDeliveries.length}</div>
          <div className="text-xs text-blue-500 flex items-center">
            <Truck className="h-3 w-3 mr-1" />
            En Route
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Inventory List */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            <Button
              variant={selectedWarehouse === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedWarehouse("all")}
            >
              All Warehouses
            </Button>
            {warehouses.map(w => (
              <Button
                key={w.id}
                variant={selectedWarehouse === w.id ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedWarehouse(w.id)}
              >
                {w.name}
              </Button>
            ))}
          </div>

          {warehouses
            .filter(w => selectedWarehouse === "all" || w.id === selectedWarehouse)
            .map(warehouse => (
              <Card key={warehouse.id} className="overflow-hidden">
                <div className="p-4 border-b bg-muted/50 flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold flex items-center gap-2">
                      <Package className="h-4 w-4" />
                      {warehouse.name}
                    </h3>
                    <p className="text-xs text-muted-foreground">{warehouse.location}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium">{warehouse.current_stock_lbs.toLocaleString()} lbs</div>
                    <div className="text-xs text-muted-foreground">{formatCurrency(warehouse.value)} value</div>
                  </div>
                </div>
                <ResponsiveTable
                  columns={columns}
                  data={warehouse.inventory}
                  keyExtractor={(item) => item.id || item.strain}
                  mobileRenderer={renderMobileCard}
                  emptyState={{
                    title: "No inventory",
                    description: "No inventory in this warehouse.",
                    icon: Package
                  }}
                  className="border-0 rounded-none border-t"
                />
              </Card>
            ))}

          {warehouses.length === 0 && (
            <div className="flex justify-center py-8">
              <EnhancedEmptyState
                type="no_products"
                title="No Inventory Found"
                description="Your warehouses are empty. Start by adding stock to your inventory."
                icon={Package}
                primaryAction={{
                  label: "Add Stock",
                  onClick: () => navigateToAdmin('inventory-management'),
                  icon: Plus
                }}
              />
            </div>
          )}
        </div>

        {/* Sidebar Stats */}
        <div className="space-y-6">
          {/* Active Deliveries */}
          <Card>
            <div className="p-4 border-b">
              <h3 className="font-semibold flex items-center gap-2">
                <Truck className="h-4 w-4" />
                Active Deliveries
              </h3>
            </div>
            <div className="p-4 space-y-4">
              {activeDeliveries.length > 0 ? (
                activeDeliveries.map(delivery => (
                  <div key={delivery.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div>
                      <div className="font-medium text-sm">{delivery.runner}</div>
                      <div className="text-xs text-muted-foreground truncate max-w-[180px]">{delivery.destination}</div>
                    </div>
                    <div className="text-right">
                      <Badge variant="outline" className={delivery.status === 'in_transit'
                        ? "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800"
                        : "bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800"
                      }>
                        {delivery.status === 'in_transit' ? 'In Transit' : 'Pending'}
                      </Badge>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-4 text-muted-foreground text-sm">
                  No active deliveries
                </div>
              )}
            </div>
          </Card>

          {/* Top Movers */}
          <Card>
            <div className="p-4 border-b">
              <h3 className="font-semibold flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Top Movers (30 Days)
              </h3>
            </div>
            <div className="p-4 space-y-4">
              {topMovers.length > 0 ? (
                topMovers.map((item) => {
                  const maxMoved = topMovers[0]?.lbs_moved || 1;
                  return (
                    <div key={item.strain} className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{item.strain}</span>
                        <span className="text-emerald-500 font-medium">{formatCurrency(item.profit)} profit</span>
                      </div>
                      <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-emerald-500 h-full rounded-full"
                          style={{ width: `${(item.lbs_moved / maxMoved) * 100}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{item.lbs_moved} lbs moved</span>
                        <span>{formatCurrency(item.revenue)} rev</span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-4 text-muted-foreground text-sm">
                  No sales data in the last 30 days
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Analytics */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Inventory Analytics
        </h2>

        <div className="mb-6">
          <h3 className="font-semibold mb-3">Top Movers (This Month)</h3>
          <div className="space-y-3">
            {topMovers.length > 0 ? (
              topMovers.map((item, idx) => (
                <div key={item.strain} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div>
                    <div className="font-medium">{idx + 1}. {item.strain} - {item.lbs_moved} lbs moved</div>
                    <div className="text-sm text-muted-foreground">
                      {formatCurrency(item.revenue)} revenue, {formatCurrency(item.profit)} profit
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-sm text-muted-foreground p-3">
                No sales activity this month
              </div>
            )}
          </div>
        </div>

        <div>
          <h3 className="font-semibold mb-3">Restock Alerts</h3>
          <div className="space-y-2">
            {inventory
              .filter(item => (Number(item.quantity_lbs) || 0) < 25)
              .sort((a, b) => (Number(a.quantity_lbs) || 0) - (Number(b.quantity_lbs) || 0))
              .slice(0, 5)
              .map((item) => {
                const qty = Number(item.quantity_lbs) || 0;
                const isVeryLow = qty < 10;
                return (
                  <div key={item.id || item.product_name} className="flex items-center gap-2 text-sm">
                    <span className={isVeryLow ? "text-destructive" : "text-yellow-500"}>
                      {isVeryLow ? "!" : "*"}
                    </span>
                    <span>
                      {item.product_name}: {qty} lbs left
                      {isVeryLow ? " (restock urgently)" : " (consider restocking)"}
                    </span>
                  </div>
                );
              })}
            {inventory.filter(item => (Number(item.quantity_lbs) || 0) < 25).length === 0 && (
              <div className="text-sm text-muted-foreground">
                All inventory levels are healthy
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-2 mt-4">
          <Button
            className="bg-emerald-500 hover:bg-emerald-600 gap-2 min-w-[100px]"
            size="sm"
            onClick={() => navigateToAdmin('wholesale-orders')}
          >
            Generate Restock Order
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 min-w-[100px]"
            onClick={() => navigateToAdmin('suppliers')}
          >
            Contact Supplier
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 min-w-[100px]"
            onClick={() => navigateToAdmin('reports')}
          >
            View Trends
          </Button>
        </div>
      </Card>
    </div>
  );
}
