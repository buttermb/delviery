import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  DollarSign, 
  TrendingUp, 
  AlertCircle, 
  Package, 
  Truck,
  Users,
  MapPin
} from "lucide-react";
import { QuickCollectionsWidget } from "@/components/admin/QuickCollectionsWidget";
import { DataSetupBanner } from "@/components/admin/DataSetupBanner";
import { QuickActionsMenu } from "@/components/admin/QuickActionsMenu";
import { CollectionsDashboard } from "@/components/admin/CollectionsDashboard";
import { InventoryAlerts } from "@/components/admin/InventoryAlerts";
import { TerritoryMapView } from "@/components/admin/TerritoryMapView";

export default function WholesaleDashboard() {
  // Fetch today's metrics
  const { data: metrics } = useQuery({
    queryKey: ["wholesale-metrics"],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      
      const { data: orders } = await supabase
        .from("wholesale_orders")
        .select("total_amount, created_at")
        .gte("created_at", today);

      const todayRevenue = orders?.reduce((sum: number, o: any) => sum + Number(o.total_amount), 0) || 0;
      const todayCost = todayRevenue * 0.64; // Estimate 64% cost basis
      const todayProfit = todayRevenue - todayCost;
      const todayMargin = todayRevenue > 0 ? (todayProfit / todayRevenue) * 100 : 0;

      return {
        revenue: todayRevenue,
        cost: todayCost,
        profit: todayProfit,
        margin: todayMargin,
        dealCount: orders?.length || 0
      };
    },
    refetchInterval: 60000 // Refresh every minute
  });

  // Fetch priority alerts
  const { data: alerts } = useQuery({
    queryKey: ["wholesale-alerts"],
    queryFn: async () => {
      // Fetch overdue clients (balance > $10k)
      const { data: overdueClients } = await supabase
        .from("wholesale_clients")
        .select("business_name, outstanding_balance")
        .gt("outstanding_balance", 10000)
        .eq("status", "active")
        .order("outstanding_balance", { ascending: false })
        .limit(5);

      // Fetch low stock items
      const { data: lowStock } = await supabase
        .from("wholesale_inventory")
        .select("product_name, quantity_lbs, warehouse_location, reorder_point")
        .lt("quantity_lbs", 50)
        .order("quantity_lbs", { ascending: true })
        .limit(3);

      // Fetch active deliveries
      const { data: activeDeliveries } = await supabase
        .from("wholesale_deliveries")
        .select("id, status")
        .in("status", ["assigned", "picked_up", "in_transit"]);

      return {
        overdueClients: overdueClients || [],
        lowStock: (lowStock || []).map(item => ({
          quantity_lbs: item.quantity_lbs,
          products: { name: item.product_name },
          warehouses: { name: item.warehouse_location }
        })),
        activeDeliveries: activeDeliveries || []
      };
    },
    refetchInterval: 30000
  });

  // Fetch active operations
  const { data: operations } = useQuery({
    queryKey: ["active-operations"],
    queryFn: async () => {
      const { data: pendingOrders } = await supabase
        .from("wholesale_orders")
        .select("id")
        .eq("status", "pending");

      const { data: activeDeliveries } = await supabase
        .from("wholesale_deliveries")
        .select("id")
        .in("status", ["assigned", "picked_up", "in_transit"]);

      const { data: clients } = await supabase
        .from("wholesale_clients")
        .select("outstanding_balance");

      const totalOutstanding = clients?.reduce((sum, c) => sum + Number(c.outstanding_balance), 0) || 0;
      const overdueAmount = clients?.filter(c => Number(c.outstanding_balance) > 10000)
        .reduce((sum, c) => sum + Number(c.outstanding_balance), 0) || 0;

      return {
        activeDeliveries: activeDeliveries?.length || 0,
        pendingOrders: pendingOrders?.length || 0,
        totalOutstanding,
        overdueAmount
      };
    }
  });

  // Fetch inventory
  const { data: inventory } = useQuery({
    queryKey: ["total-inventory"],
    queryFn: async () => {
      const { data: inventoryItems } = await supabase
        .from("wholesale_inventory")
        .select("quantity_lbs");

      const totalLbs = inventoryItems?.reduce((sum, item) => sum + Number(item.quantity_lbs), 0) || 0;
      const totalValue = totalLbs * 3000; // Estimate $3000/lb average

      return { 
        totalLbs, 
        totalValue 
      };
    }
  });

  return (
    <div className="space-y-6 p-6">
      {/* Data Setup Banner */}
      <DataSetupBanner />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">💎 Operations Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
      </div>

      {/* Today's Money - Top Priority */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-3">💰 TODAY'S MONEY</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-6 border-emerald-500/20 bg-card">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">📥 IN</span>
              <DollarSign className="h-4 w-4 text-emerald-500" />
            </div>
            <div className="text-2xl font-bold font-mono text-foreground">
              ${metrics?.revenue.toLocaleString() || '0'}
            </div>
            <p className="text-xs text-emerald-500 mt-1">↑ Revenue</p>
          </Card>

          <Card className="p-6 bg-card">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">📤 OUT</span>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="text-2xl font-bold font-mono text-foreground">
              ${metrics?.cost.toLocaleString() || '0'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Cost Basis</p>
          </Card>

          <Card className="p-6 border-emerald-500/20 bg-card">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">💵 PROFIT</span>
              <DollarSign className="h-4 w-4 text-emerald-500" />
            </div>
            <div className="text-2xl font-bold font-mono text-emerald-500">
              ${metrics?.profit.toLocaleString() || '0'}
            </div>
            <p className="text-xs text-emerald-500 mt-1">↑ {metrics?.dealCount || 0} deals</p>
          </Card>

          <Card className="p-6 bg-card">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">📊 MARGIN</span>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="text-2xl font-bold font-mono text-foreground">
              {metrics?.margin.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">Profit Margin</p>
          </Card>
        </div>
      </div>

      {/* Priority Alerts */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-destructive" />
          🚨 PRIORITY ALERTS
        </h2>
        <div className="space-y-3">
          {alerts?.overdueClients.map((client: any) => (
            <div key={client.business_name} className="flex items-center justify-between p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
              <div className="flex items-center gap-3">
                <Badge variant="destructive">🔴 OVERDUE</Badge>
                <span className="font-medium text-foreground">{client.business_name}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono font-bold text-destructive">${Number(client.outstanding_balance).toLocaleString()}</span>
                <Button size="sm" variant="destructive">COLLECT NOW</Button>
              </div>
            </div>
          ))}

          {alerts?.lowStock.map((item: any, i: number) => (
            <div key={i} className="flex items-center justify-between p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
              <div className="flex items-center gap-3">
                <Badge variant="outline" className="border-yellow-500 text-yellow-600">🟡 LOW STOCK</Badge>
                <span className="text-foreground">{item.products?.name} at {item.warehouses?.name}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-yellow-600">{Number(item.quantity_lbs).toFixed(1)} lbs left</span>
                <Button size="sm" variant="outline">Restock</Button>
              </div>
            </div>
          ))}

          {alerts?.activeDeliveries && alerts.activeDeliveries.length > 0 && (
            <div className="flex items-center justify-between p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
              <div className="flex items-center gap-3">
                <Badge variant="outline" className="border-emerald-500 text-emerald-600">🟢 ACTIVE</Badge>
                <span className="text-foreground">{alerts.activeDeliveries.length} deliveries in progress</span>
              </div>
              <Button size="sm" variant="outline">Track Live</Button>
            </div>
          )}
        </div>
      </Card>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-3">
            <Truck className="h-5 w-5 text-emerald-500" />
            <h3 className="font-semibold text-foreground">🎯 Active Operations</h3>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Deliveries in progress:</span>
              <span className="font-mono font-semibold text-foreground">{operations?.activeDeliveries || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Orders pending:</span>
              <span className="font-mono font-semibold text-foreground">{operations?.pendingOrders || 0}</span>
            </div>
          </div>
          <Button className="w-full mt-4" variant="outline" size="sm" onClick={() => window.location.href = '/admin/fleet-management'}>View Tracking</Button>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-3 mb-3">
            <DollarSign className="h-5 w-5 text-destructive" />
            <h3 className="font-semibold text-foreground">💵 Outstanding Credit</h3>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Out:</span>
              <span className="font-mono font-semibold text-foreground">${operations?.totalOutstanding.toLocaleString() || '0'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Overdue:</span>
              <span className="font-mono font-semibold text-destructive">${operations?.overdueAmount.toLocaleString() || '0'}</span>
            </div>
          </div>
          <Button className="w-full mt-4" variant="outline" size="sm" onClick={() => window.location.href = '/admin/financial-center'}>Collections</Button>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-3 mb-3">
            <Package className="h-5 w-5 text-emerald-500" />
            <h3 className="font-semibold text-foreground">📦 Inventory Status</h3>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Stock:</span>
              <span className="font-mono font-semibold text-foreground">{inventory?.totalLbs.toFixed(0) || '0'} lbs</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Value:</span>
              <span className="font-mono font-semibold text-foreground">${inventory?.totalValue.toLocaleString() || '0'}</span>
            </div>
          </div>
          <Button className="w-full mt-4" variant="outline" size="sm" onClick={() => window.location.href = '/admin/wholesale-inventory'}>Manage Stock</Button>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-3 mb-3">
            <Users className="h-5 w-5 text-emerald-500" />
            <h3 className="font-semibold text-foreground">💼 Quick Actions</h3>
          </div>
          <div className="space-y-2">
            <Button className="w-full" size="sm" variant="default" onClick={() => window.location.href = '/admin/wholesale-clients/new-order'}>📦 New Order</Button>
            <Button className="w-full" size="sm" variant="outline" onClick={() => window.location.href = '/admin/financial-center'}>💼 View Clients</Button>
            <Button className="w-full" size="sm" variant="outline" onClick={() => window.location.href = '/admin/fleet-management'}>🚗 Assign Runner</Button>
          </div>
        </Card>
      </div>
      {/* Key sections */}
      <TerritoryMapView />
      
      <QuickActionsMenu />
      {/* Collections & Operations */}
      <QuickCollectionsWidget />
      <CollectionsDashboard />
      <InventoryAlerts />
    </div>
  );
}
