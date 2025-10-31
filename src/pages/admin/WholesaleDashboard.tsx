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

export default function WholesaleDashboard() {
  // Fetch today's metrics
  const { data: metrics } = useQuery({
    queryKey: ["wholesale-metrics"],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      
      const { data: orders } = await supabase
        .from("orders")
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
      // Mock data for now - will be real once types refresh
      const overdueClients = [
        { business_name: "Big Mike's Operation", outstanding_balance: 38000 },
        { business_name: "South Bronx Connect", outstanding_balance: 12000 }
      ];

      const lowStock = [
        { quantity_lbs: 11, products: { name: "Sundae Driver" }, warehouses: { name: "Warehouse A" } }
      ];

      const activeDeliveries = [
        { id: "1", status: "in_transit" },
        { id: "2", status: "picked_up" }
      ];

      return {
        overdueClients,
        lowStock,
        activeDeliveries
      };
    },
    refetchInterval: 30000
  });

  // Fetch active operations
  const { data: operations } = useQuery({
    queryKey: ["active-operations"],
    queryFn: async () => {
      const { data: orders } = await supabase
        .from("orders")
        .select("id, status")
        .eq("status", "pending");

      return {
        activeDeliveries: 4,
        pendingOrders: orders?.length || 0,
        totalOutstanding: 245000,
        overdueAmount: 58000
      };
    }
  });

  // Fetch inventory
  const { data: inventory } = useQuery({
    queryKey: ["total-inventory"],
    queryFn: async () => {
      return { 
        totalLbs: 284, 
        totalValue: 852000 
      };
    }
  });

  return (
    <div className="space-y-6 p-6">
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
          <Button className="w-full mt-4" variant="outline" size="sm">View Tracking</Button>
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
          <Button className="w-full mt-4" variant="outline" size="sm">Collections</Button>
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
          <Button className="w-full mt-4" variant="outline" size="sm">Manage Stock</Button>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-3 mb-3">
            <Users className="h-5 w-5 text-emerald-500" />
            <h3 className="font-semibold text-foreground">💼 Quick Actions</h3>
          </div>
          <div className="space-y-2">
            <Button className="w-full" size="sm" variant="default">📦 New Order</Button>
            <Button className="w-full" size="sm" variant="outline">💼 View Clients</Button>
            <Button className="w-full" size="sm" variant="outline">🚗 Assign Runner</Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
