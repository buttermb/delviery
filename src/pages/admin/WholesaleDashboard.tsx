/**
 * 💎 ENHANCED WHOLESALE DASHBOARD
 * Comprehensive operations command center with real-time metrics
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useAccount } from "@/contexts/AccountContext";
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown,
  AlertCircle, 
  Package, 
  Truck,
  Users,
  MapPin,
  Activity,
  ArrowUp,
  ArrowDown,
  Calendar,
  Clock,
  Zap,
  Target
} from "lucide-react";
import { format, startOfWeek, endOfWeek, subDays, isToday, isYesterday } from "date-fns";
import { QuickCollectionsWidget } from "@/components/admin/QuickCollectionsWidget";
import { DataSetupBanner } from "@/components/admin/DataSetupBanner";
import { QuickActionsMenu } from "@/components/admin/QuickActionsMenu";
import { CollectionsDashboard } from "@/components/admin/CollectionsDashboard";
import { InventoryAlerts } from "@/components/admin/InventoryAlerts";
import { TerritoryMapView } from "@/components/admin/TerritoryMapView";
import { SmartAlertsDashboard } from "@/components/admin/SmartAlertsDashboard";
import { Progress } from "@/components/ui/progress";
import { useAccount } from "@/contexts/AccountContext";

export default function WholesaleDashboard() {
  const navigate = useNavigate();
  const { account } = useAccount();
  
  // Enhanced Today's Metrics with comparisons
  const { data: metrics } = useQuery({
    queryKey: ["wholesale-metrics-enhanced", account?.id],
    queryFn: async () => {
      if (!account?.id) return null;

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStart = today.toISOString();
      
      const yesterday = subDays(today, 1);
      const yesterdayStart = yesterday.toISOString();

      const weekStart = startOfWeek(today);
      const weekEnd = endOfWeek(today);

      // Today's orders
      const { data: todayOrders } = await supabase
        .from("wholesale_orders")
        .select("total_amount, status, created_at")
        .eq("account_id", account.id)
        .gte("created_at", todayStart);

      const todayRevenue = todayOrders?.reduce((sum: number, o: any) => 
        sum + Number(o.total_amount || 0), 0) || 0;
      const todayCost = todayRevenue * 0.64;
      const todayProfit = todayRevenue - todayCost;
      const todayMargin = todayRevenue > 0 ? (todayProfit / todayRevenue) * 100 : 0;

      // Yesterday's orders for comparison
      const { data: yesterdayOrders } = await supabase
        .from("wholesale_orders")
        .select("total_amount, status")
        .eq("account_id", account.id)
        .gte("created_at", yesterdayStart)
        .lt("created_at", todayStart);

      const yesterdayRevenue = yesterdayOrders?.reduce((sum: number, o: any) => 
        sum + Number(o.total_amount || 0), 0) || 0;
      const yesterdayCost = yesterdayRevenue * 0.64;
      const yesterdayProfit = yesterdayRevenue - yesterdayCost;

      // This week's orders
      const { data: weekOrders } = await supabase
        .from("wholesale_orders")
        .select("total_amount, status")
        .eq("account_id", account.id)
        .gte("created_at", weekStart.toISOString())
        .lte("created_at", weekEnd.toISOString());

      const weekRevenue = weekOrders?.reduce((sum: number, o: any) => 
        sum + Number(o.total_amount || 0), 0) || 0;

      // Today's collections
      const { data: todayPayments } = await supabase
        .from("wholesale_payments")
        .select("amount")
        .eq("account_id", account.id)
        .gte("payment_date", todayStart);

      const collectionsToday = todayPayments?.reduce((sum: number, p: any) => 
        sum + Number(p.amount || 0), 0) || 0;

      return {
        revenue: todayRevenue,
        cost: todayCost,
        profit: todayProfit,
        margin: todayMargin,
        dealCount: todayOrders?.length || 0,
        collectionsToday,
        vsYesterday: {
          revenue: todayRevenue - yesterdayRevenue,
          profit: todayProfit - yesterdayProfit,
          margin: todayMargin - (yesterdayRevenue > 0 ? (yesterdayProfit / yesterdayRevenue) * 100 : 0),
        },
        weekRevenue,
        weekProgress: (todayRevenue / Math.max(weekRevenue, 1)) * 100,
      };
    },
    enabled: !!account?.id,
    refetchInterval: 60000
  });

  // Enhanced Priority Alerts
  const { data: alerts } = useQuery({
    queryKey: ["wholesale-alerts-enhanced", account?.id],
    queryFn: async () => {
      if (!account?.id) return null;

      // Overdue clients with detailed info
      const { data: overdueClients } = await supabase
        .from("wholesale_clients")
        .select("id, business_name, outstanding_balance, last_payment_date, phone")
        .eq("account_id", account.id)
        .eq("status", "active")
        .gt("outstanding_balance", 10000)
        .order("outstanding_balance", { ascending: false })
        .limit(5);

      // Calculate days overdue
      const overdueClientsWithDays = (overdueClients || []).map(client => {
        const lastPayment = client.last_payment_date 
          ? new Date(client.last_payment_date)
          : null;
        const daysOverdue = lastPayment
          ? Math.floor((Date.now() - lastPayment.getTime()) / (1000 * 60 * 60 * 24))
          : 14;
        return { ...client, daysOverdue };
      });

      // Low stock with urgency
      const { data: lowStock } = await supabase
        .from("wholesale_inventory")
        .select("product_name, quantity_lbs, warehouse_location, reorder_point")
        .eq("account_id", account.id)
        .lt("quantity_lbs", 50)
        .order("quantity_lbs", { ascending: true })
        .limit(5);

      // Active deliveries with details
      const { data: activeDeliveries } = await supabase
        .from("wholesale_deliveries")
        .select(`
          id,
          status,
          total_value,
          collection_amount,
          orders:wholesale_orders(
            client_id,
            wholesale_clients(business_name)
          )
        `)
        .eq("account_id", account.id)
        .in("status", ["assigned", "picked_up", "in_transit"])
        .order("created_at", { ascending: false })
        .limit(5);

      // Pending orders needing approval
      const { data: pendingOrders } = await supabase
        .from("wholesale_orders")
        .select(`
          id,
          total_amount,
          wholesale_clients(business_name)
        `)
        .eq("account_id", account.id)
        .eq("status", "pending")
        .limit(3);

      return {
        overdueClients: overdueClientsWithDays,
        lowStock: lowStock || [],
        activeDeliveries: activeDeliveries || [],
        pendingOrders: pendingOrders || [],
      };
    },
    enabled: !!account?.id,
    refetchInterval: 30000
  });

  // Enhanced Active Operations
  const { data: operations } = useQuery({
    queryKey: ["active-operations-enhanced", account?.id],
    queryFn: async () => {
      if (!account?.id) return null;

      const { data: pendingOrders } = await supabase
        .from("wholesale_orders")
        .select("id, total_amount")
        .eq("account_id", account.id)
        .eq("status", "pending");

      const { data: activeDeliveries } = await supabase
        .from("wholesale_deliveries")
        .select("id, total_value, collection_amount")
        .eq("account_id", account.id)
        .in("status", ["assigned", "picked_up", "in_transit"]);

      const { data: clients } = await supabase
        .from("wholesale_clients")
        .select("outstanding_balance, last_payment_date")
        .eq("account_id", account.id)
        .eq("status", "active");

      const totalOutstanding = clients?.reduce((sum, c) => sum + Number(c.outstanding_balance || 0), 0) || 0;
      
      const overdueAmount = clients?.filter(c => {
        if (!c.last_payment_date) return Number(c.outstanding_balance || 0) > 0;
        const daysSincePayment = Math.floor((Date.now() - new Date(c.last_payment_date).getTime()) / (1000 * 60 * 60 * 24));
        return daysSincePayment > 7 && Number(c.outstanding_balance || 0) > 0;
      }).reduce((sum, c) => sum + Number(c.outstanding_balance || 0), 0) || 0;

      const activeDeliveryValue = activeDeliveries?.reduce((sum, d) => 
        sum + Number(d.total_value || 0), 0) || 0;

      const activeCollections = activeDeliveries?.reduce((sum, d) => 
        sum + Number(d.collection_amount || 0), 0) || 0;

      return {
        activeDeliveries: activeDeliveries?.length || 0,
        pendingOrders: pendingOrders?.length || 0,
        totalOutstanding,
        overdueAmount,
        activeDeliveryValue,
        activeCollections,
        pendingOrderValue: pendingOrders?.reduce((sum, o) => sum + Number(o.total_amount || 0), 0) || 0,
      };
    },
    enabled: !!account?.id,
    refetchInterval: 30000
  });

  // Enhanced Inventory Stats
  const { data: inventory } = useQuery({
    queryKey: ["total-inventory-enhanced", account?.id],
    queryFn: async () => {
      if (!account?.id) return null;

      const { data: inventoryItems } = await supabase
        .from("wholesale_inventory")
        .select("quantity_lbs, cost_per_lb, warehouse_location")
        .eq("account_id", account.id);

      const totalLbs = inventoryItems?.reduce((sum, item) => 
        sum + Number(item.quantity_lbs || 0), 0) || 0;
      
      const totalValue = inventoryItems?.reduce((sum, item) => 
        sum + (Number(item.quantity_lbs || 0) * Number(item.cost_per_lb || 3000)), 0) || 0;

      // Group by warehouse
      const byWarehouse: Record<string, { lbs: number; value: number }> = {};
      inventoryItems?.forEach(item => {
        const wh = item.warehouse_location || 'Unknown';
        if (!byWarehouse[wh]) {
          byWarehouse[wh] = { lbs: 0, value: 0 };
        }
        byWarehouse[wh].lbs += Number(item.quantity_lbs || 0);
        byWarehouse[wh].value += Number(item.quantity_lbs || 0) * Number(item.cost_per_lb || 3000);
      });

      // On runners
      const { data: deliveries } = await supabase
        .from("wholesale_deliveries")
        .select("total_weight")
        .eq("account_id", account.id)
        .in("status", ["assigned", "picked_up", "in_transit"]);

      const onRunners = deliveries?.reduce((sum, d) => sum + Number(d.total_weight || 0), 0) || 0;

      return { 
        totalLbs, 
        totalValue,
        byWarehouse,
        onRunners,
        avgCostPerLb: totalLbs > 0 ? totalValue / totalLbs : 0,
      };
    },
    enabled: !!account?.id,
    refetchInterval: 30000
  });

  // Recent Activity
  const { data: recentActivity } = useQuery({
    queryKey: ["recent-activity", account?.id],
    queryFn: async () => {
      if (!account?.id) return [];

      const { data: orders } = await supabase
        .from("wholesale_orders")
        .select(`
          id,
          order_number,
          total_amount,
          status,
          created_at,
          wholesale_clients(business_name)
        `)
        .eq("account_id", account.id)
        .order("created_at", { ascending: false })
        .limit(5);

      return orders || [];
    },
    enabled: !!account?.id,
    refetchInterval: 60000
  });

  if (!account) {
    return (
      <div className="space-y-6 p-6">
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">Please set up your account first</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <DataSetupBanner />

      {/* Enhanced Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-foreground mb-2 flex items-center gap-3">
            💎 Operations Dashboard
            <Badge variant="outline" className="text-sm">
              <Activity className="h-3 w-3 mr-1" />
              Live
            </Badge>
          </h1>
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            {format(new Date(), 'EEEE, MMMM d, yyyy')}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/admin/big-plug-order')}>
            <Package className="h-4 w-4 mr-2" />
            New Order
          </Button>
          <Button onClick={() => navigate('/admin/big-plug-clients')}>
            <Users className="h-4 w-4 mr-2" />
            View Clients
          </Button>
        </div>
      </div>

      {/* Enhanced Today's Money - Top Priority */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
            💰 TODAY'S MONEY
          </h2>
          <Badge variant="outline" className="text-xs">
            <Clock className="h-3 w-3 mr-1" />
            Updates every minute
          </Badge>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Revenue In */}
          <Card className="p-6 border-2 border-emerald-500/30 bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-950/20 dark:to-background">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 bg-emerald-500/10 rounded-lg">
                <ArrowDown className="h-5 w-5 text-emerald-500" />
              </div>
              <Badge variant="outline" className="border-emerald-500 text-emerald-600">📥 IN</Badge>
            </div>
            <div className="text-3xl font-bold font-mono text-foreground mb-1">
              ${metrics?.collectionsToday.toLocaleString() || '0'}
            </div>
            <div className="flex items-center gap-2 text-sm">
              {metrics?.vsYesterday.revenue && metrics.vsYesterday.revenue !== 0 && (
                <>
                  {metrics.vsYesterday.revenue > 0 ? (
                    <ArrowUp className="h-3 w-3 text-emerald-500" />
                  ) : (
                    <ArrowDown className="h-3 w-3 text-red-500" />
                  )}
                  <span className={metrics.vsYesterday.revenue > 0 ? 'text-emerald-500' : 'text-red-500'}>
                    ${Math.abs(metrics.vsYesterday.revenue).toLocaleString()} vs yesterday
                  </span>
                </>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-2">Collections Today</p>
          </Card>

          {/* Revenue Out */}
          <Card className="p-6 border-2 border-red-500/30 bg-gradient-to-br from-red-50 to-white dark:from-red-950/20 dark:to-background">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 bg-red-500/10 rounded-lg">
                <ArrowUp className="h-5 w-5 text-red-500" />
              </div>
              <Badge variant="outline" className="border-red-500 text-red-600">📤 OUT</Badge>
            </div>
            <div className="text-3xl font-bold font-mono text-foreground mb-1">
              ${metrics?.cost.toLocaleString() || '0'}
            </div>
            <p className="text-xs text-muted-foreground mt-2">Cost Basis (64%)</p>
          </Card>

          {/* Profit */}
          <Card className="p-6 border-2 border-emerald-500/30 bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-950/20 dark:to-background">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 bg-emerald-500/10 rounded-lg">
                <DollarSign className="h-5 w-5 text-emerald-500" />
              </div>
              <Badge variant="outline" className="border-emerald-500 text-emerald-600">💵 PROFIT</Badge>
            </div>
            <div className="text-3xl font-bold font-mono text-emerald-600 mb-1">
              ${metrics?.profit.toLocaleString() || '0'}
            </div>
            <div className="flex items-center gap-2 text-sm">
              {metrics?.vsYesterday.profit && metrics.vsYesterday.profit !== 0 && (
                <>
                  {metrics.vsYesterday.profit > 0 ? (
                    <ArrowUp className="h-3 w-3 text-emerald-500" />
                  ) : (
                    <ArrowDown className="h-3 w-3 text-red-500" />
                  )}
                  <span className={metrics.vsYesterday.profit > 0 ? 'text-emerald-500' : 'text-red-500'}>
                    {((metrics.vsYesterday.profit / Math.max(metrics.profit - metrics.vsYesterday.profit, 1)) * 100).toFixed(1)}%
                  </span>
                </>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-2">{metrics?.dealCount || 0} deals today</p>
          </Card>

          {/* Margin */}
          <Card className="p-6 border-2 border-blue-500/30 bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/20 dark:to-background">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <TrendingUp className="h-5 w-5 text-blue-500" />
              </div>
              <Badge variant="outline" className="border-blue-500 text-blue-600">📊 MARGIN</Badge>
            </div>
            <div className="text-3xl font-bold font-mono text-foreground mb-2">
              {metrics?.margin.toFixed(1) || '0'}%
            </div>
            <Progress value={metrics?.margin || 0} className="h-2" />
            <p className="text-xs text-muted-foreground mt-2">Profit Margin</p>
          </Card>
        </div>
      </div>

      {/* Week Progress */}
      {metrics && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold flex items-center gap-2">
              <Target className="h-4 w-4" />
              Week Progress
            </h3>
            <Badge variant="outline">
              ${metrics.weekRevenue.toLocaleString()} / Week Target
            </Badge>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">This Week Revenue</span>
              <span className="font-semibold">${metrics.weekRevenue.toLocaleString()}</span>
            </div>
            <Progress value={Math.min(metrics.weekProgress, 100)} className="h-3" />
          </div>
        </Card>
      )}

      {/* Enhanced Priority Alerts */}
      <Card className="p-6 border-2 border-orange-500/20">
        <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-destructive" />
          🚨 PRIORITY ALERTS
        </h2>
        <div className="space-y-3">
          {alerts?.overdueClients && alerts.overdueClients.length > 0 && alerts.overdueClients.map((client: any) => (
            <div key={client.id} className="flex items-center justify-between p-4 bg-gradient-to-r from-red-50 to-red-100/50 dark:from-red-950/30 dark:to-red-900/20 border-2 border-red-500/30 rounded-lg hover:shadow-md transition-shadow">
              <div className="flex items-center gap-4 flex-1">
                <Badge variant="destructive" className="text-xs px-3 py-1">
                  🔴 {client.daysOverdue} days overdue
                </Badge>
                <div>
                  <div className="font-semibold text-foreground">{client.business_name}</div>
                  <div className="text-sm text-muted-foreground">
                    ${Number(client.outstanding_balance).toLocaleString()} outstanding
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono font-bold text-destructive text-lg">
                  ${Number(client.outstanding_balance).toLocaleString()}
                </span>
                <Button 
                  size="sm" 
                  variant="destructive"
                  onClick={() => navigate(`/admin/big-plug-clients?client=${client.id}`)}
                >
                  COLLECT NOW
                </Button>
              </div>
            </div>
          ))}

          {alerts?.lowStock && alerts.lowStock.length > 0 && alerts.lowStock.slice(0, 3).map((item: any, i: number) => (
            <div key={i} className="flex items-center justify-between p-4 bg-gradient-to-r from-yellow-50 to-yellow-100/50 dark:from-yellow-950/30 dark:to-yellow-900/20 border-2 border-yellow-500/30 rounded-lg hover:shadow-md transition-shadow">
              <div className="flex items-center gap-4 flex-1">
                <Badge variant="outline" className="border-yellow-500 text-yellow-600 text-xs px-3 py-1">
                  🟡 LOW STOCK
                </Badge>
                <div>
                  <div className="font-semibold text-foreground">{item.product_name}</div>
                  <div className="text-sm text-muted-foreground">
                    {item.warehouse_location} • Only {Number(item.quantity_lbs).toFixed(1)} lbs left
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-yellow-600 font-semibold">
                  {Number(item.quantity_lbs).toFixed(1)} lbs
                </span>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => navigate('/admin/big-plug-inventory')}
                >
                  Restock
                </Button>
              </div>
            </div>
          ))}

          {alerts?.pendingOrders && alerts.pendingOrders.length > 0 && alerts.pendingOrders.map((order: any) => (
            <div key={order.id} className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-blue-100/50 dark:from-blue-950/30 dark:to-blue-900/20 border-2 border-blue-500/30 rounded-lg hover:shadow-md transition-shadow">
              <div className="flex items-center gap-4 flex-1">
                <Badge variant="outline" className="border-blue-500 text-blue-600 text-xs px-3 py-1">
                  🔵 NEW ORDER
                </Badge>
                <div>
                  <div className="font-semibold text-foreground">
                    {order.wholesale_clients?.business_name || 'New Client'}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    ${Number(order.total_amount).toLocaleString()} • Needs approval
                  </div>
                </div>
              </div>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => navigate(`/admin/wholesale-clients/new-order?order=${order.id}`)}
              >
                Review
              </Button>
            </div>
          ))}

          {alerts?.activeDeliveries && alerts.activeDeliveries.length > 0 && (
            <div className="flex items-center justify-between p-4 bg-gradient-to-r from-emerald-50 to-emerald-100/50 dark:from-emerald-950/30 dark:to-emerald-900/20 border-2 border-emerald-500/30 rounded-lg hover:shadow-md transition-shadow">
              <div className="flex items-center gap-4 flex-1">
                <Badge variant="outline" className="border-emerald-500 text-emerald-600 text-xs px-3 py-1">
                  🟢 ACTIVE
                </Badge>
                <div>
                  <div className="font-semibold text-foreground">
                    {alerts.activeDeliveries.length} deliveries in progress
                  </div>
                  <div className="text-sm text-muted-foreground">
                    ${alerts.activeDeliveries.reduce((sum: number, d: any) => sum + Number(d.total_value || 0), 0).toLocaleString()} in transit
                  </div>
                </div>
              </div>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => navigate('/admin/fleet-management')}
              >
                Track Live
              </Button>
            </div>
          )}

          {(!alerts?.overdueClients || alerts.overdueClients.length === 0) &&
           (!alerts?.lowStock || alerts.lowStock.length === 0) &&
           (!alerts?.pendingOrders || alerts.pendingOrders.length === 0) &&
           (!alerts?.activeDeliveries || alerts.activeDeliveries.length === 0) && (
            <div className="text-center py-8 text-muted-foreground">
              <Zap className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>All clear! No priority alerts at this time.</p>
            </div>
          )}
        </div>
      </Card>

      {/* Enhanced Quick Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Active Operations */}
        <Card className="p-6 hover:shadow-lg transition-shadow border-l-4 border-l-emerald-500">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-emerald-500/10 rounded-lg">
              <Truck className="h-5 w-5 text-emerald-500" />
            </div>
            <h3 className="font-semibold text-foreground">🎯 Active Operations</h3>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Deliveries:</span>
              <span className="font-mono font-bold text-lg text-foreground">
                {operations?.activeDeliveries || 0}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Pending Orders:</span>
              <span className="font-mono font-bold text-lg text-foreground">
                {operations?.pendingOrders || 0}
              </span>
            </div>
            {operations && operations.activeDeliveryValue > 0 && (
              <div className="pt-2 border-t">
                <div className="text-xs text-muted-foreground mb-1">In Transit Value</div>
                <div className="font-semibold text-emerald-600">
                  ${operations.activeDeliveryValue.toLocaleString()}
                </div>
              </div>
            )}
            <Button 
              className="w-full mt-4" 
              variant="outline" 
              size="sm"
              onClick={() => navigate('/admin/fleet-management')}
            >
              View Tracking
            </Button>
          </div>
        </Card>

        {/* Outstanding Credit */}
        <Card className="p-6 hover:shadow-lg transition-shadow border-l-4 border-l-red-500">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-red-500/10 rounded-lg">
              <DollarSign className="h-5 w-5 text-red-500" />
            </div>
            <h3 className="font-semibold text-foreground">💵 Outstanding Credit</h3>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Total Out:</span>
              <span className="font-mono font-bold text-lg text-foreground">
                ${operations?.totalOutstanding.toLocaleString() || '0'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Overdue:</span>
              <span className="font-mono font-bold text-lg text-red-600">
                ${operations?.overdueAmount.toLocaleString() || '0'}
              </span>
            </div>
            {operations && operations.totalOutstanding > 0 && (
              <div className="pt-2 border-t">
                <Progress 
                  value={(operations.overdueAmount / operations.totalOutstanding) * 100} 
                  className="h-2"
                />
                <div className="text-xs text-muted-foreground mt-1">
                  {((operations.overdueAmount / operations.totalOutstanding) * 100).toFixed(1)}% overdue
                </div>
              </div>
            )}
            <Button 
              className="w-full mt-4" 
              variant="outline" 
              size="sm"
              onClick={() => navigate('/admin/big-plug-financial')}
            >
              Collections Dashboard
            </Button>
          </div>
        </Card>

        {/* Inventory Status */}
        <Card className="p-6 hover:shadow-lg transition-shadow border-l-4 border-l-blue-500">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <Package className="h-5 w-5 text-blue-500" />
            </div>
            <h3 className="font-semibold text-foreground">📦 Inventory Status</h3>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Total Stock:</span>
              <span className="font-mono font-bold text-lg text-foreground">
                {inventory?.totalLbs.toFixed(1) || '0'} lbs
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Value:</span>
              <span className="font-mono font-bold text-lg text-foreground">
                ${inventory?.totalValue.toLocaleString() || '0'}
              </span>
            </div>
            {inventory && inventory.onRunners > 0 && (
              <div className="pt-2 border-t">
                <div className="text-xs text-muted-foreground mb-1">On Runners</div>
                <div className="font-semibold text-yellow-600">
                  {inventory.onRunners.toFixed(1)} lbs 🟡
                </div>
              </div>
            )}
            {inventory?.byWarehouse && Object.keys(inventory.byWarehouse).length > 0 && (
              <div className="pt-2 border-t space-y-1">
                {Object.entries(inventory.byWarehouse).slice(0, 2).map(([wh, stats]) => (
                  <div key={wh} className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{wh}:</span>
                    <span className="font-semibold">{stats.lbs.toFixed(1)} lbs</span>
                  </div>
                ))}
              </div>
            )}
            <Button 
              className="w-full mt-4" 
              variant="outline" 
              size="sm"
              onClick={() => navigate('/admin/big-plug-inventory')}
            >
              Manage Stock
            </Button>
          </div>
        </Card>

        {/* Quick Actions */}
        <Card className="p-6 hover:shadow-lg transition-shadow border-l-4 border-l-purple-500">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-purple-500/10 rounded-lg">
              <Zap className="h-5 w-5 text-purple-500" />
            </div>
            <h3 className="font-semibold text-foreground">⚡ Quick Actions</h3>
          </div>
          <div className="space-y-2">
            <Button 
              className="w-full" 
              size="sm" 
              onClick={() => navigate('/admin/big-plug-order')}
            >
              <Package className="h-4 w-4 mr-2" />
              New Order
            </Button>
            <Button 
              className="w-full" 
              size="sm" 
              variant="outline"
              onClick={() => navigate('/admin/big-plug-clients')}
            >
              <Users className="h-4 w-4 mr-2" />
              View Clients
            </Button>
            <Button 
              className="w-full" 
              size="sm" 
              variant="outline"
              onClick={() => navigate('/admin/fleet-management')}
            >
              <Truck className="h-4 w-4 mr-2" />
              Assign Runner
            </Button>
          </div>
        </Card>
      </div>

      {/* Recent Activity */}
      {recentActivity && recentActivity.length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Recent Activity
          </h3>
          <div className="space-y-2">
            {recentActivity.map((order: any) => (
              <div 
                key={order.id}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Badge variant="outline">
                    {order.status}
                  </Badge>
                  <div>
                    <div className="font-medium">
                      Order #{order.order_number || order.id.slice(0, 8)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {order.wholesale_clients?.business_name || 'Client'} • {format(new Date(order.created_at), 'MMM d, h:mm a')}
                    </div>
                  </div>
                </div>
                <div className="font-semibold">
                  ${Number(order.total_amount).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Additional Widgets */}
      <TerritoryMapView />
      <QuickActionsMenu />
      <QuickCollectionsWidget />
      <CollectionsDashboard />
      <InventoryAlerts />
    </div>
  );
}
