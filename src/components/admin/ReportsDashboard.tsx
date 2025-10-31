import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown, DollarSign, Package, Users, Truck } from "lucide-react";
import { useWholesaleClients, useWholesaleOrders, useWholesalePayments, useWholesaleInventory } from "@/hooks/useWholesaleData";
import { format, startOfWeek, startOfMonth, subDays } from "date-fns";

export function ReportsDashboard() {
  const { data: clients = [] } = useWholesaleClients();
  const { data: orders = [] } = useWholesaleOrders();
  const { data: payments = [] } = useWholesalePayments();
  const { data: inventory = [] } = useWholesaleInventory();

  // Date ranges
  const today = new Date();
  const weekStart = startOfWeek(today);
  const monthStart = startOfMonth(today);
  const last30Days = subDays(today, 30);

  // Calculate metrics
  const thisWeekOrders = orders.filter(o => new Date(o.created_at) >= weekStart);
  const thisMonthOrders = orders.filter(o => new Date(o.created_at) >= monthStart);
  const last30DaysOrders = orders.filter(o => new Date(o.created_at) >= last30Days);

  const thisWeekRevenue = thisWeekOrders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0);
  const thisMonthRevenue = thisMonthOrders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0);
  const last30DaysRevenue = last30DaysOrders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0);

  const thisWeekPayments = payments.filter(p => new Date(p.created_at) >= weekStart);
  const thisMonthPayments = payments.filter(p => new Date(p.created_at) >= monthStart);

  const thisWeekCollected = thisWeekPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const thisMonthCollected = thisMonthPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);

  const totalOutstanding = clients.reduce((sum, c) => sum + Number(c.outstanding_balance || 0), 0);
  const totalInventoryValue = inventory.reduce((sum, i) => sum + (Number(i.quantity_lbs || 0) * 3000), 0);

  // Top clients by revenue
  const clientRevenue = clients.map(client => {
    const clientOrders = orders.filter(o => o.client_id === client.id);
    const revenue = clientOrders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0);
    return { ...client, revenue };
  }).sort((a, b) => b.revenue - a.revenue).slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-foreground">📊 Business Reports</h2>
        <Button variant="outline">Export PDF</Button>
      </div>

      {/* Time Period Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-5">
          <div className="text-sm text-muted-foreground mb-2">This Week</div>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Revenue:</span>
              <span className="text-lg font-bold font-mono">${(thisWeekRevenue / 1000).toFixed(0)}k</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Collected:</span>
              <span className="text-lg font-bold font-mono text-emerald-500">${(thisWeekCollected / 1000).toFixed(0)}k</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Orders:</span>
              <span className="text-lg font-bold font-mono">{thisWeekOrders.length}</span>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="text-sm text-muted-foreground mb-2">This Month</div>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Revenue:</span>
              <span className="text-lg font-bold font-mono">${(thisMonthRevenue / 1000).toFixed(0)}k</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Collected:</span>
              <span className="text-lg font-bold font-mono text-emerald-500">${(thisMonthCollected / 1000).toFixed(0)}k</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Orders:</span>
              <span className="text-lg font-bold font-mono">{thisMonthOrders.length}</span>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="text-sm text-muted-foreground mb-2">Last 30 Days</div>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Revenue:</span>
              <span className="text-lg font-bold font-mono">${(last30DaysRevenue / 1000).toFixed(0)}k</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Avg/Day:</span>
              <span className="text-lg font-bold font-mono">${((last30DaysRevenue / 30) / 1000).toFixed(1)}k</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Orders:</span>
              <span className="text-lg font-bold font-mono">{last30DaysOrders.length}</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Outstanding Credit</span>
            <DollarSign className="h-5 w-5 text-yellow-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-yellow-500">
            ${(totalOutstanding / 1000).toFixed(0)}k
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {clients.filter(c => Number(c.outstanding_balance) > 0).length} clients owe
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Inventory Value</span>
            <Package className="h-5 w-5 text-blue-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-blue-500">
            ${(totalInventoryValue / 1000).toFixed(0)}k
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {inventory.reduce((sum, i) => sum + Number(i.quantity_lbs || 0), 0).toFixed(0)} lbs on hand
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Active Clients</span>
            <Users className="h-5 w-5 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-500">
            {clients.length}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {clients.filter(c => Number(c.credit_limit) > 0).length} with credit
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Avg Order Size</span>
            <TrendingUp className="h-5 w-5 text-purple-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-purple-500">
            ${orders.length > 0 ? ((orders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0) / orders.length) / 1000).toFixed(1) : 0}k
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {orders.length} total orders
          </div>
        </Card>
      </div>

      {/* Top Clients */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4 text-foreground">💎 Top Clients by Revenue</h3>
        <div className="space-y-3">
          {clientRevenue.map((client, idx) => (
            <div key={client.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
                  {idx + 1}
                </div>
                <div>
                  <div className="font-semibold text-foreground">{client.business_name}</div>
                  <div className="text-xs text-muted-foreground">
                    Credit: ${Number(client.credit_limit).toLocaleString()} | 
                    Outstanding: ${Number(client.outstanding_balance).toLocaleString()}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold font-mono text-emerald-500">
                  ${(client.revenue / 1000).toFixed(1)}k
                </div>
                <div className="text-xs text-muted-foreground">revenue</div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
