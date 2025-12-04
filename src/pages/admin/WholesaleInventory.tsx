import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTenantNavigation } from "@/lib/navigation/tenantNavigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Package, Plus, ArrowRightLeft, TrendingUp, Clock, Truck } from "lucide-react";
import { showInfoToast } from "@/utils/toastHelpers";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import { useWholesaleInventory, useWholesaleDeliveries, useWholesaleOrders } from "@/hooks/useWholesaleData";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";

export default function WholesaleInventory() {
  const navigate = useNavigate();
  const { navigateToAdmin } = useTenantNavigation();
  const { tenant } = useTenantAdminAuth();
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>("all");

  // Fetch real data
  const { data: inventory = [], isLoading: inventoryLoading } = useWholesaleInventory(tenant?.id);
  const { data: deliveries = [], isLoading: deliveriesLoading } = useWholesaleDeliveries();
  const { data: orders = [], isLoading: ordersLoading } = useWholesaleOrders();

  const isLoading = inventoryLoading || deliveriesLoading || ordersLoading;

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

  // Group by Warehouse
  const warehouseMap = new Map();

  inventory.forEach(item => {
    const location = (item as any).warehouse_location || "Unassigned";
    if (!warehouseMap.has(location)) {
      warehouseMap.set(location, {
        id: location,
        name: location,
        location: location,
        capacity_lbs: 1000, // Placeholder as we don't have capacity in DB yet
        current_stock_lbs: 0,
        value: 0,
        status: "good",
        inventory: []
      });
    }

    const warehouse = warehouseMap.get(location);
    warehouse.current_stock_lbs += Number(item.quantity_lbs) || 0;
    warehouse.value += (Number(item.quantity_lbs) || 0) * (Number(item.cost_per_lb) || 0);

    // Determine status based on quantity (simplified logic)
    let status = "good";
    if ((Number(item.quantity_lbs) || 0) < 10) status = "very_low";
    else if ((Number(item.quantity_lbs) || 0) < 25) status = "low";

    warehouse.inventory.push({
      strain: item.product_name,
      weight_lbs: Number(item.quantity_lbs) || 0,
      cost_per_lb: Number(item.cost_per_lb) || 0,
      value: (Number(item.quantity_lbs) || 0) * (Number(item.cost_per_lb) || 0),
      status: status
    });
  });

  const warehouses = Array.from(warehouseMap.values());

  // Process Active Deliveries
  const activeDeliveries = deliveries
    .filter(d => ['pending', 'in_transit'].includes(d.status))
    .slice(0, 5)
    .map(d => ({
      id: d.id,
      runner: d.runner?.full_name || "Unassigned",
      weight_lbs: 0, // We'd need to sum order items to get weight
      destination: "Client Location", // We'd need client address
      eta: "TBD"
    }));

  // Fetch Top Movers from wholesale_order_items (last 30 days)
  const { data: topMovers = [] } = useQuery({
    queryKey: ['wholesale-top-movers', tenant?.id],
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
        existing.quantity += item.quantity || 0;
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
      good: "🟢 Stock",
      low: "🟡 Low",
      very_low: "🔴 Very Low"
    };
    return labels[status] || status;
  };

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-64 mb-2" />
            <Skeleton className="h-4 w-48" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32 w-full" />)}
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">📦 Inventory Management</h1>
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
          <div className="text-2xl font-bold">${overview.total_value.toLocaleString()}</div>
          <div className="text-xs text-emerald-500 flex items-center">
            <TrendingUp className="h-3 w-3 mr-1" />
            Asset Value
          </div>
        </Card>
        <Card className="p-4 space-y-2">
          <div className="text-sm font-medium text-muted-foreground">Avg Cost / lb</div>
          <div className="text-2xl font-bold">${overview.avg_cost_per_lb.toLocaleString()}</div>
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
                    <div className="text-sm font-medium">{warehouse.current_stock_lbs} / {warehouse.capacity_lbs} lbs</div>
                    <div className="text-xs text-muted-foreground">${warehouse.value.toLocaleString()} value</div>
                  </div>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Strain</TableHead>
                      <TableHead>Weight (lbs)</TableHead>
                      <TableHead>Cost / lb</TableHead>
                      <TableHead>Total Value</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {warehouse.inventory.length > 0 ? (
                      warehouse.inventory.map((item: any, idx: number) => (
                        <TableRow key={idx}>
                          <TableCell className="font-medium">{item.strain}</TableCell>
                          <TableCell>{item.weight_lbs}</TableCell>
                          <TableCell>${item.cost_per_lb.toLocaleString()}</TableCell>
                          <TableCell>${item.value.toLocaleString()}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={getStatusColor(item.status)}>
                              {getStatusLabel(item.status)}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-4 text-muted-foreground">
                          No inventory in this warehouse
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </Card>
            ))}

          {warehouses.length === 0 && (
            <Card className="p-8 text-center text-muted-foreground">
              No inventory data found. Add stock to get started.
            </Card>
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
                      <div className="text-xs text-muted-foreground">{delivery.destination}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-2 py-1 rounded">
                        {delivery.eta}
                      </div>
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
              {topMovers.map((item, idx) => (
                <div key={idx} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{item.strain}</span>
                    <span className="text-emerald-500 font-medium">${item.profit.toLocaleString()} profit</span>
                  </div>
                  <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-emerald-500 h-full rounded-full"
                      style={{ width: `${(item.lbs_moved / 150) * 100}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{item.lbs_moved} lbs moved</span>
                    <span>${item.revenue.toLocaleString()} rev</span>
                  </div>
                </div>
              ))}
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
            {topMovers.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div>
                  <div className="font-medium">{idx + 1}. {item.strain} - {item.lbs_moved} lbs moved</div>
                  <div className="text-sm text-muted-foreground">
                    ${(item.revenue / 1000).toFixed(0)}k revenue, ${(item.profit / 1000).toFixed(0)}k profit
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3 className="font-semibold mb-3">Restock Alerts</h3>
          <div className="space-y-2">
            {inventory
              .filter(item => (Number(item.quantity_lbs) || 0) < 25)
              .sort((a, b) => (Number(a.quantity_lbs) || 0) - (Number(b.quantity_lbs) || 0))
              .slice(0, 5)
              .map((item, idx) => {
                const qty = Number(item.quantity_lbs) || 0;
                const isVeryLow = qty < 10;
                return (
                  <div key={idx} className="flex items-center gap-2 text-sm">
                    <span className={isVeryLow ? "text-destructive" : "text-yellow-500"}>
                      {isVeryLow ? "🔴" : "🟡"}
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
