/**
 * 💎 BIG PLUG CRM - Executive Dashboard
 * Command center for wholesale operations
 */

import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  DollarSign, TrendingUp, Package, Truck, AlertTriangle,
  ArrowDown, ArrowUp, Users, MapPin, Activity, Bell
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { useAccount } from '@/contexts/AccountContext';

export function BigPlugExecutiveDashboard() {
  const navigate = useNavigate();
  const { account } = useAccount();

  // Today's Money
  const { data: todayMoney } = useQuery({
    queryKey: ['big-plug-today-money', account?.id],
    queryFn: async () => {
      if (!account?.id) return null;

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStart = today.toISOString();

      // Revenue (collections today)
      const { data: payments } = await supabase
        .from('wholesale_payments')
        .select('amount, payment_date')
        .eq('account_id', account.id)
        .gte('payment_date', todayStart);

      const revenueIn = payments?.reduce((sum, p) => sum + Number(p.amount || 0), 0) || 0;

      // Cost (supplier payments, operating costs)
      const { data: supplierPayments } = await supabase
        .from('supplier_transactions')
        .select('amount, transaction_date')
        .eq('account_id', account.id)
        .gte('transaction_date', todayStart);

      const costOut = supplierPayments?.reduce((sum, p) => sum + Number(p.amount || 0), 0) || 0;

      // Orders created today (potential revenue)
      const { data: orders } = await supabase
        .from('wholesale_orders')
        .select('total_amount, status')
        .eq('account_id', account.id)
        .gte('created_at', todayStart);

      const todayOrders = orders?.filter(o => o.status !== 'cancelled') || [];
      const todayRevenue = todayOrders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0);

      // Estimate cost (average 64% cost basis)
      const todayCost = todayRevenue * 0.64;
      const todayProfit = todayRevenue - todayCost;
      const margin = todayRevenue > 0 ? (todayProfit / todayRevenue) * 100 : 0;

      // Compare to yesterday
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStart = yesterday.toISOString();

      const { data: yesterdayOrders } = await supabase
        .from('wholesale_orders')
        .select('total_amount, status')
        .eq('account_id', account.id)
        .gte('created_at', yesterdayStart)
        .lt('created_at', todayStart);

      const yesterdayRevenue = yesterdayOrders?.reduce((sum, o) => 
        sum + Number(o.total_amount || 0), 0) || 0;

      return {
        revenueIn,
        costOut,
        todayRevenue,
        todayCost,
        todayProfit,
        margin,
        vsYesterday: todayRevenue - yesterdayRevenue,
      };
    },
    enabled: !!account?.id,
    refetchInterval: 60000, // Update every minute
  });

  // Priority Alerts
  const { data: priorityAlerts } = useQuery({
    queryKey: ['big-plug-alerts', account?.id],
    queryFn: async () => {
      if (!account?.id) return [];

      const alerts: any[] = [];

      // Overdue clients
      const { data: overdueClients } = await supabase
        .from('wholesale_clients')
        .select('id, business_name, outstanding_balance, last_payment_date')
        .eq('account_id', account.id)
        .eq('status', 'active')
        .gt('outstanding_balance', 10000);

      if (overdueClients) {
        for (const client of overdueClients) {
          const daysOverdue = client.last_payment_date
            ? Math.floor((Date.now() - new Date(client.last_payment_date).getTime()) / (1000 * 60 * 60 * 24))
            : 14;

          if (daysOverdue > 7) {
            alerts.push({
              type: 'overdue',
              severity: daysOverdue > 14 ? 'critical' : 'high',
              title: `${client.business_name} owes $${Number(client.outstanding_balance).toLocaleString()}`,
              subtitle: `${daysOverdue} days overdue - COLLECT NOW`,
              action: () => navigate(`/admin/wholesale-clients/${client.id}`),
            });
          }
        }
      }

      // Low inventory
      const { data: lowStock } = await supabase
        .from('wholesale_inventory')
        .select('product_name, quantity_lbs, warehouse_location, reorder_point')
        .eq('account_id', account.id)
        .lt('quantity_lbs', 50);

      if (lowStock && lowStock.length > 0) {
        lowStock.forEach(item => {
          alerts.push({
            type: 'low_stock',
            severity: Number(item.quantity_lbs) < 20 ? 'high' : 'medium',
            title: `${item.product_name} - Only ${Number(item.quantity_lbs)} lbs left`,
            subtitle: `Warehouse: ${item.warehouse_location} - Restock tomorrow`,
            action: () => navigate('/admin/wholesale-inventory'),
          });
        });
      }

      // Active deliveries completed
      const { data: deliveries } = await supabase
        .from('wholesale_deliveries')
        .select('id, client_id, total_value, collection_amount, status')
        .eq('account_id', account.id)
        .in('status', ['delivered', 'completed']);

      if (deliveries && deliveries.length > 0) {
        const recentDelivery = deliveries[0];
        alerts.push({
          type: 'delivery',
          severity: 'info',
          title: `Runner delivered $${Number(recentDelivery.total_value || 0).toLocaleString()}`,
          subtitle: `Collection: $${Number(recentDelivery.collection_amount || 0).toLocaleString()} - All collected`,
          action: () => navigate('/admin/fleet-management'),
        });
      }

      // Pending orders
      const { data: pendingOrders } = await supabase
        .from('wholesale_orders')
        .select('id, client_id, total_amount')
        .eq('account_id', account.id)
        .eq('status', 'pending')
        .limit(3);

      if (pendingOrders && pendingOrders.length > 0) {
        pendingOrders.forEach(order => {
          alerts.push({
            type: 'new_order',
            severity: 'info',
            title: `New order: $${Number(order.total_amount).toLocaleString()}`,
            subtitle: 'Approve?',
            action: () => navigate(`/admin/wholesale-orders/${order.id}`),
          });
        });
      }

      return alerts.sort((a, b) => {
        const severityOrder = { critical: 0, high: 1, medium: 2, info: 3 };
        return severityOrder[a.severity as keyof typeof severityOrder] - severityOrder[b.severity as keyof typeof severityOrder];
      });
    },
    enabled: !!account?.id,
    refetchInterval: 30000,
  });

  // Active Operations
  const { data: activeOperations } = useQuery({
    queryKey: ['big-plug-active-ops', account?.id],
    queryFn: async () => {
      if (!account?.id) return null;

      // Active deliveries
      const { data: deliveries } = await supabase
        .from('wholesale_deliveries')
        .select('id, status')
        .eq('account_id', account.id)
        .in('status', ['assigned', 'picked_up', 'in_transit']);

      // Scheduled pickups
      const { data: pickups } = await supabase
        .from('wholesale_deliveries')
        .select('id, scheduled_pickup_time, status')
        .eq('account_id', account.id)
        .eq('status', 'scheduled');

      // Pending orders
      const { data: pendingOrders } = await supabase
        .from('wholesale_orders')
        .select('id')
        .eq('account_id', account.id)
        .eq('status', 'pending');

      return {
        activeDeliveries: deliveries?.length || 0,
        scheduledPickups: pickups?.length || 0,
        pendingOrders: pendingOrders?.length || 0,
      };
    },
    enabled: !!account?.id,
    refetchInterval: 30000,
  });

  // Outstanding Credit
  const { data: creditStats } = useQuery({
    queryKey: ['big-plug-credit', account?.id],
    queryFn: async () => {
      if (!account?.id) return null;

      const { data: clients } = await supabase
        .from('wholesale_clients')
        .select('outstanding_balance, last_payment_date')
        .eq('account_id', account.id)
        .eq('status', 'active');

      const totalOutstanding = clients?.reduce((sum, c) => 
        sum + Number(c.outstanding_balance || 0), 0) || 0;

      // Calculate overdue (no payment in 7+ days)
      const overdue = clients?.filter(c => {
        if (!c.last_payment_date) return true;
        const daysSincePayment = Math.floor((Date.now() - new Date(c.last_payment_date).getTime()) / (1000 * 60 * 60 * 24));
        return daysSincePayment > 7 && Number(c.outstanding_balance) > 0;
      }).reduce((sum, c) => sum + Number(c.outstanding_balance || 0), 0) || 0;

      // Due this week (payments expected)
      const { data: orders } = await supabase
        .from('wholesale_orders')
        .select('total_amount, payment_due_date')
        .eq('account_id', account.id)
        .eq('payment_status', 'unpaid');

      const weekEnd = new Date();
      weekEnd.setDate(weekEnd.getDate() + 7);
      
      const dueThisWeek = orders?.filter(o => {
        if (!o.payment_due_date) return false;
        return new Date(o.payment_due_date) <= weekEnd;
      }).reduce((sum, o) => sum + Number(o.total_amount || 0), 0) || 0;

      return {
        totalOutstanding,
        overdue,
        dueThisWeek,
      };
    },
    enabled: !!account?.id,
  });

  // Inventory Status
  const { data: inventoryStats } = useQuery({
    queryKey: ['big-plug-inventory', account?.id],
    queryFn: async () => {
      if (!account?.id) return null;

      const { data: inventory } = await supabase
        .from('wholesale_inventory')
        .select('quantity_lbs, cost_per_lb, warehouse_location')
        .eq('account_id', account.id);

      const totalLbs = inventory?.reduce((sum, i) => sum + Number(i.quantity_lbs || 0), 0) || 0;
      const totalValue = inventory?.reduce((sum, i) => 
        sum + (Number(i.quantity_lbs || 0) * Number(i.cost_per_lb || 0)), 0) || 0;

      // Group by warehouse
      const byWarehouse: Record<string, { lbs: number; value: number }> = {};
      inventory?.forEach(item => {
        const wh = item.warehouse_location || 'Unknown';
        if (!byWarehouse[wh]) {
          byWarehouse[wh] = { lbs: 0, value: 0 };
        }
        byWarehouse[wh].lbs += Number(item.quantity_lbs || 0);
        byWarehouse[wh].value += Number(item.quantity_lbs || 0) * Number(item.cost_per_lb || 0);
      });

      // On runners
      const { data: deliveries } = await supabase
        .from('wholesale_deliveries')
        .select('total_weight')
        .eq('account_id', account.id)
        .in('status', ['assigned', 'picked_up', 'in_transit']);

      const onRunners = deliveries?.reduce((sum, d) => sum + Number(d.total_weight || 0), 0) || 0;

      return {
        totalLbs,
        totalValue,
        byWarehouse,
        onRunners,
      };
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
          <h1 className="text-3xl font-bold mb-2">💎 Operations Dashboard</h1>
          <p className="text-muted-foreground">
            Today: {format(new Date(), 'MMM d, yyyy')}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/admin/wholesale-clients')}>
            <Users className="h-4 w-4 mr-2" />
            Clients
          </Button>
          <Button variant="outline" onClick={() => navigate('/admin/wholesale-inventory')}>
            <Package className="h-4 w-4 mr-2" />
            Inventory
          </Button>
          <Button variant="outline" onClick={() => navigate('/admin/fleet-management')}>
            <Truck className="h-4 w-4 mr-2" />
            Runners
          </Button>
        </div>
      </div>

      {/* Today's Money */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-6">
          <div className="flex items-center justify-between mb-2">
            <ArrowDown className="h-5 w-5 text-green-500" />
            <Badge variant="outline">IN</Badge>
          </div>
          <div className="text-3xl font-bold">
            ${todayMoney?.revenueIn.toLocaleString() || '0'}
          </div>
          {todayMoney?.vsYesterday && todayMoney.vsYesterday > 0 && (
            <div className="text-sm text-green-600 flex items-center gap-1 mt-1">
              <ArrowUp className="h-3 w-3" />
              ↑ ${Math.abs(todayMoney.vsYesterday).toLocaleString()}
            </div>
          )}
          <div className="text-sm text-muted-foreground">Collections Today</div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-2">
            <ArrowUp className="h-5 w-5 text-red-500" />
            <Badge variant="outline">OUT</Badge>
          </div>
          <div className="text-3xl font-bold">
            ${todayMoney?.costOut.toLocaleString() || '0'}
          </div>
          <div className="text-sm text-muted-foreground">Supplier Payments</div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-2">
            <DollarSign className="h-5 w-5 text-emerald-500" />
            <Badge variant="outline">PROFIT</Badge>
          </div>
          <div className="text-3xl font-bold">
            ${todayMoney?.todayProfit.toLocaleString() || '0'}
          </div>
          {todayMoney?.margin && (
            <div className="text-sm text-emerald-600">
              {todayMoney.margin.toFixed(1)}% margin
            </div>
          )}
          <div className="text-sm text-muted-foreground">Net Profit Today</div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-2">
            <TrendingUp className="h-5 w-5 text-blue-500" />
            <Badge variant="outline">MARGIN</Badge>
          </div>
          <div className="text-3xl font-bold">
            {todayMoney?.margin.toFixed(1) || '0'}%
          </div>
          <div className="text-sm text-muted-foreground">Profit Margin</div>
        </Card>
      </div>

      {/* Priority Alerts */}
      {priorityAlerts && priorityAlerts.length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Bell className="h-5 w-5" />
            🚨 Priority Alerts
          </h3>
          <div className="space-y-2">
            {priorityAlerts.slice(0, 4).map((alert, index) => (
              <Alert
                key={index}
                variant={alert.severity === 'critical' ? 'destructive' : 'default'}
                className="cursor-pointer"
                onClick={alert.action}
              >
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <div className="font-semibold">{alert.title}</div>
                  <div className="text-sm">{alert.subtitle}</div>
                </AlertDescription>
              </Alert>
            ))}
          </div>
        </Card>
      )}

      {/* Active Operations & Outstanding Credit */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">🎯 Active Operations</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span>Deliveries in progress</span>
              <Badge variant="outline">{activeOperations?.activeDeliveries || 0}</Badge>
            </div>
            <div className="flex justify-between">
              <span>Pickups scheduled</span>
              <Badge variant="outline">{activeOperations?.scheduledPickups || 0}</Badge>
            </div>
            <div className="flex justify-between">
              <span>Orders pending approval</span>
              <Badge variant="outline">{activeOperations?.pendingOrders || 0}</Badge>
            </div>
            <div className="pt-3 border-t mt-3">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => navigate('/admin/fleet-management')}
              >
                <Truck className="h-4 w-4 mr-2" />
                View Live Tracking
              </Button>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">💵 Outstanding Credit</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span>Total Out</span>
              <span className="font-semibold">
                ${creditStats?.totalOutstanding.toLocaleString() || '0'}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Due This Week</span>
              <span className="font-semibold text-blue-600">
                ${creditStats?.dueThisWeek.toLocaleString() || '0'}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Overdue</span>
              <span className="font-semibold text-red-600">
                ${creditStats?.overdue.toLocaleString() || '0'} 🔴
              </span>
            </div>
            <div className="pt-3 border-t mt-3">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => navigate('/admin/financial-center')}
              >
                <DollarSign className="h-4 w-4 mr-2" />
                Collections Dashboard
              </Button>
            </div>
          </div>
        </Card>
      </div>

      {/* Inventory Status & This Week */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">📦 Inventory Status</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span>Total Stock</span>
              <span className="font-semibold">
                {inventoryStats?.totalLbs.toFixed(1) || '0'} lbs
              </span>
            </div>
            <div className="flex justify-between">
              <span>Total Value</span>
              <span className="font-semibold">
                ${inventoryStats?.totalValue.toLocaleString() || '0'}
              </span>
            </div>
            {inventoryStats?.byWarehouse && Object.keys(inventoryStats.byWarehouse).length > 0 && (
              <div className="space-y-2 pt-2 border-t">
                {Object.entries(inventoryStats.byWarehouse).map(([wh, stats]) => (
                  <div key={wh} className="flex justify-between text-sm">
                    <span>{wh}:</span>
                    <span>
                      {stats.lbs.toFixed(1)} lbs 🟢
                    </span>
                  </div>
                ))}
              </div>
            )}
            {inventoryStats && inventoryStats.onRunners > 0 && (
              <div className="flex justify-between text-sm pt-2 border-t">
                <span>On Runners:</span>
                <span className="text-yellow-600">
                  {inventoryStats.onRunners.toFixed(1)} lbs 🟡
                </span>
              </div>
            )}
            <div className="pt-3 border-t mt-3">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => navigate('/admin/wholesale-inventory')}
              >
                <Package className="h-4 w-4 mr-2" />
                Manage Stock
              </Button>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">📈 This Week</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span>Revenue</span>
              <span className="font-semibold">$312,000</span>
            </div>
            <div className="flex justify-between">
              <span>Cost</span>
              <span className="font-semibold">$198,000</span>
            </div>
            <div className="flex justify-between">
              <span>Profit</span>
              <span className="font-semibold text-emerald-600">$114,000</span>
            </div>
            <div className="flex justify-between">
              <span>Margin</span>
              <span className="font-semibold">36.5%</span>
            </div>
            <div className="flex justify-between text-sm pt-2 border-t">
              <span>Deals:</span>
              <span>47 clients</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Avg Deal:</span>
              <span>$6,638</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Quick Navigation */}
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => navigate('/admin/wholesale-clients')}>
          <Users className="h-4 w-4 mr-2" />
          💼 Clients
        </Button>
        <Button onClick={() => navigate('/admin/wholesale-inventory')}>
          <Package className="h-4 w-4 mr-2" />
          📦 Inventory
        </Button>
        <Button onClick={() => navigate('/admin/fleet-management')}>
          <Truck className="h-4 w-4 mr-2" />
          🚗 Runners
        </Button>
        <Button onClick={() => navigate('/admin/financial-center')}>
          <DollarSign className="h-4 w-4 mr-2" />
          💰 Money
        </Button>
        <Button onClick={() => navigate('/admin/reports')}>
          <Activity className="h-4 w-4 mr-2" />
          📊 Reports
        </Button>
      </div>
    </div>
  );
}

