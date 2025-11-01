/**
 * 📦 BIG PLUG CRM - Multi-Warehouse Inventory Management
 * Track bulk weight across multiple locations
 */

import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Package, Truck, TrendingUp, AlertTriangle, 
  Warehouse, MapPin, Plus, Move, DollarSign
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { useAccount } from '@/contexts/AccountContext';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export function BigPlugInventory() {
  const navigate = useNavigate();
  const { account } = useAccount();

  // Inventory Overview
  const { data: inventoryOverview } = useQuery({
    queryKey: ['big-plug-inventory-overview', account?.id],
    queryFn: async () => {
      if (!account?.id) return null;

      const { data: inventory } = await supabase
        .from('wholesale_inventory')
        .select('quantity_lbs, cost_per_lb, warehouse_location, product_name')
        .eq('account_id', account.id);

      if (!inventory) return null;

      const totalLbs = inventory.reduce((sum, i) => sum + Number(i.quantity_lbs || 0), 0);
      const totalValue = inventory.reduce((sum, i) => 
        sum + (Number(i.quantity_lbs || 0) * Number(i.cost_per_lb || 0)), 0);
      const avgCostPerLb = totalLbs > 0 ? totalValue / totalLbs : 0;

      // Group by warehouse
      const byWarehouse: Record<string, { lbs: number; value: number; items: any[] }> = {};
      inventory.forEach(item => {
        const wh = item.warehouse_location || 'Unknown';
        if (!byWarehouse[wh]) {
          byWarehouse[wh] = { lbs: 0, value: 0, items: [] };
        }
        const lbs = Number(item.quantity_lbs || 0);
        const value = lbs * Number(item.cost_per_lb || 0);
        byWarehouse[wh].lbs += lbs;
        byWarehouse[wh].value += value;
        byWarehouse[wh].items.push(item);
      });

      // On runners
      const { data: deliveries } = await supabase
        .from('wholesale_deliveries')
        .select('total_weight, status')
        .eq('account_id', account.id)
        .in('status', ['assigned', 'picked_up', 'in_transit']);

      const onRunners = deliveries?.reduce((sum, d) => sum + Number(d.total_weight || 0), 0) || 0;

      // Low stock alerts
      const lowStock = inventory
        .filter(i => {
          const lbs = Number(i.quantity_lbs || 0);
          return lbs < 30 && lbs > 0; // Alert if less than 30 lbs
        })
        .map(i => ({
          ...i,
          quantity_lbs: Number(i.quantity_lbs || 0),
        }))
        .sort((a, b) => a.quantity_lbs - b.quantity_lbs);

      return {
        totalLbs,
        totalValue,
        avgCostPerLb,
        byWarehouse,
        onRunners,
        lowStock,
      };
    },
    enabled: !!account?.id,
    refetchInterval: 30000,
  });

  // Top Movers (This Month)
  const { data: topMovers } = useQuery({
    queryKey: ['big-plug-top-movers', account?.id],
    queryFn: async () => {
      if (!account?.id) return [];

      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);

      const { data: orders } = await supabase
        .from('wholesale_orders')
        .select(`
          id,
          wholesale_order_items(product_name, quantity, unit_price)
        `)
        .eq('account_id', account.id)
        .gte('created_at', monthStart.toISOString());

      if (!orders) return [];

      // Aggregate by product
      const productStats: Record<string, { lbs: number; revenue: number; profit: number }> = {};

      orders.forEach(order => {
        const items = order.wholesale_order_items || [];
        items.forEach((item: any) => {
          const productName = item.product_name || 'Unknown';
          if (!productStats[productName]) {
            productStats[productName] = { lbs: 0, revenue: 0, profit: 0 };
          }
          
          // Estimate lbs from quantity (assuming quantity is in lbs for wholesale)
          const lbs = Number(item.quantity || 0);
          const revenue = lbs * Number(item.unit_price || 0);
          const cost = revenue * 0.64; // 64% cost basis
          const profit = revenue - cost;

          productStats[productName].lbs += lbs;
          productStats[productName].revenue += revenue;
          productStats[productName].profit += profit;
        });
      });

      return Object.entries(productStats)
        .map(([name, stats]) => ({ name, ...stats }))
        .sort((a, b) => b.lbs - a.lbs)
        .slice(0, 10);
    },
    enabled: !!account?.id,
  });

  if (!account) {
    return (
      <div className="container mx-auto p-6">
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">Please set up your account first</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">📦 Inventory</h1>
          <p className="text-muted-foreground">Multi-warehouse bulk inventory tracking</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Move className="h-4 w-4 mr-2" />
            Transfer Stock
          </Button>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add Stock
          </Button>
        </div>
      </div>

      {/* Overview */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card className="p-6">
          <div className="flex items-center justify-between mb-2">
            <Package className="h-5 w-5 text-blue-500" />
            <Badge variant="outline">Total Stock</Badge>
          </div>
          <div className="text-3xl font-bold">
            {inventoryOverview?.totalLbs.toFixed(1) || '0'} lbs
          </div>
          <div className="text-sm text-muted-foreground">
            {inventoryOverview && inventoryOverview.totalLbs > 0
              ? `${(inventoryOverview.totalLbs / 2.20462).toFixed(1)} kg`
              : ''
            }
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-2">
            <TrendingUp className="h-5 w-5 text-green-500" />
            <Badge variant="outline">Total Value</Badge>
          </div>
          <div className="text-3xl font-bold">
            ${Number(inventoryOverview?.totalValue || 0).toLocaleString()}
          </div>
          <div className="text-sm text-muted-foreground">
            at cost
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-2">
            <DollarSign className="h-5 w-5 text-purple-500" />
            <Badge variant="outline">Avg Cost/lb</Badge>
          </div>
          <div className="text-3xl font-bold">
            ${Number(inventoryOverview?.avgCostPerLb || 0).toFixed(0)}
          </div>
          <div className="text-sm text-muted-foreground">
            average
          </div>
        </Card>
      </div>

      {/* Warehouse Breakdown */}
      <Tabs defaultValue="warehouses" className="space-y-4">
        <TabsList>
          <TabsTrigger value="warehouses">Warehouses</TabsTrigger>
          <TabsTrigger value="in_transit">In Transit</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="warehouses" className="space-y-4">
          {inventoryOverview?.byWarehouse && Object.keys(inventoryOverview.byWarehouse).length > 0 ? (
            Object.entries(inventoryOverview.byWarehouse).map(([warehouse, stats]) => {
              const capacity = 500; // Estimate
              const capacityPercent = (stats.lbs / capacity) * 100;
              const statusColor = capacityPercent > 80 ? 'red' : capacityPercent > 60 ? 'yellow' : 'green';

              return (
                <Card key={warehouse} className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <Warehouse className="h-5 w-5 text-blue-500" />
                        <h3 className="text-xl font-semibold">{warehouse}</h3>
                        <Badge className={`bg-${statusColor}-500`}>GOOD</Badge>
                      </div>
                      <div className="text-sm text-muted-foreground mb-2">
                        Capacity: {capacity} lbs | Current: {stats.lbs.toFixed(1)} lbs ({capacityPercent.toFixed(0)}%) | Value: ${Number(stats.value || 0).toLocaleString()}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm">
                        <Move className="h-4 w-4 mr-2" />
                        Move Stock
                      </Button>
                      <Button variant="outline" size="sm">
                        View Details
                      </Button>
                    </div>
                  </div>

                  {/* Products in Warehouse */}
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Strain</TableHead>
                          <TableHead className="text-right">Weight</TableHead>
                          <TableHead className="text-right">Cost/lb</TableHead>
                          <TableHead className="text-right">Total Value</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {stats.items.map((item: any, index: number) => {
                          const lbs = Number(item.quantity_lbs || 0);
                          const cost = Number(item.cost_per_lb || 0);
                          const value = lbs * cost;
                          const stockStatus = lbs < 20 ? 'Very Low' : lbs < 30 ? 'Low' : 'Stock';

                          return (
                            <TableRow key={index}>
                              <TableCell className="font-medium">{item.product_name}</TableCell>
                              <TableCell className="text-right">{lbs.toFixed(1)} lbs</TableCell>
                              <TableCell className="text-right">${Number(cost || 0).toLocaleString()}</TableCell>
                              <TableCell className="text-right">${Number(value || 0).toLocaleString()}</TableCell>
                              <TableCell>
                                {stockStatus === 'Very Low' ? (
                                  <Badge variant="destructive">🔴 Very Low</Badge>
                                ) : stockStatus === 'Low' ? (
                                  <Badge className="bg-yellow-500">🟡 Low</Badge>
                                ) : (
                                  <Badge className="bg-green-500">🟢 Stock</Badge>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </Card>
              );
            })
          ) : (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">No inventory data yet</p>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="in_transit" className="space-y-4">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">🚗 On Runners (In Transit)</h3>
            {inventoryOverview && inventoryOverview.onRunners > 0 ? (
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span>Active Deliveries: 4</span>
                  <Badge variant="outline">
                    {inventoryOverview.onRunners.toFixed(1)} lbs
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span>Current:</span>
                  <span className="font-semibold">
                    {inventoryOverview.onRunners.toFixed(1)} lbs
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Value:</span>
                  <span className="font-semibold">
                    ${(Number(inventoryOverview.onRunners || 0) * Number(inventoryOverview.avgCostPerLb || 0)).toLocaleString()}
                  </span>
                </div>
                <div className="pt-4 border-t">
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => navigate('/admin/fleet-management')}
                  >
                    <Truck className="h-4 w-4 mr-2" />
                    Track Live
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground">No active deliveries</p>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          {/* Restock Alerts */}
          {inventoryOverview?.lowStock && inventoryOverview.lowStock.length > 0 && (
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Restock Alerts</h3>
              <div className="space-y-2">
                {inventoryOverview.lowStock.map((item: any, index: number) => (
                  <div
                    key={index}
                    className={`flex items-center justify-between p-3 rounded-lg ${
                      item.quantity_lbs < 20 
                        ? 'bg-red-50 dark:bg-red-950 border border-red-200'
                        : 'bg-yellow-50 dark:bg-yellow-950 border border-yellow-200'
                    }`}
                  >
                    <div>
                      <div className="font-semibold">{item.product_name}</div>
                      <div className="text-sm text-muted-foreground">
                        Only {item.quantity_lbs.toFixed(1)} lbs left
                        {item.warehouse_location && ` • ${item.warehouse_location}`}
                      </div>
                    </div>
                    <Badge variant={item.quantity_lbs < 20 ? 'destructive' : 'default'}>
                      {item.quantity_lbs < 20 ? '🔴 Urgent' : '🟡 Watch'}
                    </Badge>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Top Movers */}
          {topMovers && topMovers.length > 0 && (
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">📊 Top Movers (This Month)</h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Weight</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">Profit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topMovers.map((product, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">
                        {index + 1}. {product.name}
                      </TableCell>
                      <TableCell className="text-right">
                        {product.lbs.toFixed(1)} lbs
                      </TableCell>
                      <TableCell className="text-right">
                        ${Number(product.revenue || 0).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right text-emerald-600">
                        ${Number(product.profit || 0).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

