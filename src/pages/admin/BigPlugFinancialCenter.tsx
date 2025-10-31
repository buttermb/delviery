/**
 * 💰 BIG PLUG CRM - Financial Command Center
 * Credit out/in tracking, collections, supplier payments
 */

import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  DollarSign, ArrowDown, ArrowUp, AlertTriangle, 
  TrendingUp, Phone, MessageSquare, Calendar
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format, differenceInDays, addDays } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { useAccount } from '@/contexts/AccountContext';
import { useState } from 'react';

export function BigPlugFinancialCenter() {
  const navigate = useNavigate();
  const { account } = useAccount();
  const [timeRange, setTimeRange] = useState<'today' | 'week' | 'month' | 'custom'>('today');

  // Today's Snapshot
  const { data: todaySnapshot } = useQuery({
    queryKey: ['big-plug-today-finance', account?.id],
    queryFn: async () => {
      if (!account?.id) return null;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Revenue (collections)
      const { data: payments } = await supabase
        .from('wholesale_payments')
        .select('amount')
        .eq('account_id', account.id)
        .gte('payment_date', today.toISOString());

      const revenue = payments?.reduce((sum, p) => sum + Number(p.amount || 0), 0) || 0;

      // Cost (supplier payments, operating)
      const { data: supplierPayments } = await supabase
        .from('supplier_transactions')
        .select('amount')
        .eq('account_id', account.id)
        .gte('transaction_date', today.toISOString());

      const cost = supplierPayments?.reduce((sum, p) => sum + Number(p.amount || 0), 0) || 0;

      // Net profit
      const profit = revenue - cost;
      const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

      // Orders created today
      const { data: orders } = await supabase
        .from('wholesale_orders')
        .select('id, status')
        .eq('account_id', account.id)
        .gte('created_at', today.toISOString());

      return {
        revenue,
        cost,
        profit,
        margin,
        dealCount: orders?.length || 0,
      };
    },
    enabled: !!account?.id,
    refetchInterval: 60000,
  });

  // Credit Out (Who Owes You)
  const { data: creditOut } = useQuery({
    queryKey: ['big-plug-credit-out', account?.id],
    queryFn: async () => {
      if (!account?.id) return null;

      const { data: clients } = await supabase
        .from('wholesale_clients')
        .select(`
          id,
          business_name,
          outstanding_balance,
          last_payment_date,
          phone,
          wholesale_orders(id, total_amount, created_at, payment_status, payment_due_date)
        `)
        .eq('account_id', account.id)
        .eq('status', 'active')
        .gt('outstanding_balance', 0)
        .order('outstanding_balance', { ascending: false });

      if (!clients) return null;

      const now = new Date();
      const weekEnd = addDays(now, 7);

      const overdue: any[] = [];
      const dueThisWeek: any[] = [];
      const future: any[] = [];

      for (const client of clients) {
        const balance = Number(client.outstanding_balance || 0);
        const daysOverdue = client.last_payment_date
          ? differenceInDays(now, new Date(client.last_payment_date))
          : 14;

        // Find oldest unpaid order
        const unpaidOrders = client.wholesale_orders?.filter((o: any) => 
          o.payment_status === 'unpaid' || o.payment_status === 'partial'
        ) || [];

        if (unpaidOrders.length > 0) {
          const oldestOrder = unpaidOrders.sort((a: any, b: any) => 
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          )[0];

          const dueDate = oldestOrder.payment_due_date 
            ? new Date(oldestOrder.payment_due_date)
            : addDays(new Date(oldestOrder.created_at), 7);

          if (dueDate < now) {
            overdue.push({
              ...client,
              amount: balance,
              daysOverdue: Math.max(daysOverdue, differenceInDays(now, dueDate)),
              oldestOrder,
            });
          } else if (dueDate <= weekEnd) {
            dueThisWeek.push({
              ...client,
              amount: balance,
              daysUntilDue: differenceInDays(dueDate, now),
              oldestOrder,
            });
          } else {
            future.push({
              ...client,
              amount: balance,
              dueDate,
            });
          }
        } else {
          // No orders, just balance
          if (daysOverdue > 7) {
            overdue.push({ ...client, amount: balance, daysOverdue });
          } else {
            future.push({ ...client, amount: balance });
          }
        }
      }

      const totalOutstanding = clients.reduce((sum, c) => 
        sum + Number(c.outstanding_balance || 0), 0);
      const totalOverdue = overdue.reduce((sum, c) => sum + c.amount, 0);
      const totalDueThisWeek = dueThisWeek.reduce((sum, c) => sum + c.amount, 0);
      const totalFuture = future.reduce((sum, c) => sum + c.amount, 0);

      return {
        totalOutstanding,
        overdue: overdue.sort((a, b) => b.daysOverdue - a.daysOverdue),
        dueThisWeek: dueThisWeek.sort((a, b) => a.daysUntilDue - b.daysUntilDue),
        future,
        totalOverdue,
        totalDueThisWeek,
        totalFuture,
      };
    },
    enabled: !!account?.id,
  });

  // Credit In (You Owe Suppliers)
  const { data: creditIn } = useQuery({
    queryKey: ['big-plug-credit-in', account?.id],
    queryFn: async () => {
      if (!account?.id) return null;

      // Get supplier relationships
      const { data: suppliers } = await supabase
        .from('wholesale_clients')
        .select('id, business_name, outstanding_balance, credit_limit, phone')
        .eq('account_id', account.id)
        .eq('client_type', 'supplier')
        .eq('status', 'active');

      if (!suppliers) return null;

      // Get unpaid purchase orders
      const { data: purchaseOrders } = await supabase
        .from('wholesale_orders')
        .select('id, total_amount, created_at, payment_due_date, client_id')
        .eq('account_id', account.id)
        .in('payment_status', ['unpaid', 'partial']);

      const supplierDebts: any[] = [];

      suppliers.forEach(supplier => {
        const supplierOrders = purchaseOrders?.filter((o: any) => 
          o.client_id === supplier.id
        ) || [];

        const totalOwed = supplierOrders.reduce((sum, o) => 
          sum + Number(o.total_amount || 0), 0);

        if (totalOwed > 0) {
          supplierDebts.push({
            supplier,
            amount: totalOwed,
            orders: supplierOrders,
            creditLimit: Number(supplier.credit_limit || 0),
            creditUsed: totalOwed,
            creditAvailable: Number(supplier.credit_limit || 0) - totalOwed,
          });
        }
      });

      const totalPayable = supplierDebts.reduce((sum, d) => sum + d.amount, 0);
      const totalCreditAvailable = supplierDebts.reduce((sum, d) => sum + d.creditAvailable, 0);
      const totalCreditLimit = supplierDebts.reduce((sum, d) => sum + d.creditLimit, 0);

      return {
        suppliers: supplierDebts,
        totalPayable,
        totalCreditAvailable,
        totalCreditLimit,
      };
    },
    enabled: !!account?.id,
  });

  // This Month Performance
  const { data: monthPerformance } = useQuery({
    queryKey: ['big-plug-month-performance', account?.id],
    queryFn: async () => {
      if (!account?.id) return null;

      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);

      // Revenue
      const { data: payments } = await supabase
        .from('wholesale_payments')
        .select('amount')
        .eq('account_id', account.id)
        .gte('payment_date', monthStart.toISOString());

      const revenue = payments?.reduce((sum, p) => sum + Number(p.amount || 0), 0) || 0;

      // Cost (estimate 64% cost basis)
      const { data: orders } = await supabase
        .from('wholesale_orders')
        .select('total_amount')
        .eq('account_id', account.id)
        .gte('created_at', monthStart.toISOString());

      const totalOrderValue = orders?.reduce((sum, o) => 
        sum + Number(o.total_amount || 0), 0) || 0;
      const cost = totalOrderValue * 0.64;

      const grossProfit = revenue - cost;
      const operatingCost = 42000; // Estimate
      const netProfit = grossProfit - operatingCost;

      // Volume (estimate)
      const volumeLbs = totalOrderValue / 3000; // Avg $3k/lb

      // Deal count
      const dealCount = orders?.length || 0;
      const avgDeal = dealCount > 0 ? totalOrderValue / dealCount : 0;

      return {
        revenue,
        cost,
        grossProfit,
        operatingCost,
        netProfit,
        margin: revenue > 0 ? (netProfit / revenue) * 100 : 0,
        volumeLbs,
        dealCount,
        avgDeal,
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
          <h1 className="text-3xl font-bold mb-2">💰 Financial Overview</h1>
          <p className="text-muted-foreground">
            {format(new Date(), 'MMM d, yyyy')}
          </p>
        </div>
        <div className="flex gap-2">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as any)}
            className="px-3 py-2 border rounded-md"
          >
            <option value="today">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="custom">Custom Range</option>
          </select>
        </div>
      </div>

      {/* Today's Snapshot */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card className="p-6">
          <div className="flex items-center justify-between mb-2">
            <DollarSign className="h-5 w-5 text-green-500" />
            <Badge variant="outline">Revenue</Badge>
          </div>
          <div className="text-3xl font-bold">
            ${todaySnapshot?.revenue.toLocaleString() || '0'}
          </div>
          <div className="text-sm text-muted-foreground">
            {todaySnapshot?.dealCount || 0} deals
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-2">
            <ArrowUp className="h-5 w-5 text-red-500" />
            <Badge variant="outline">Cost</Badge>
          </div>
          <div className="text-3xl font-bold">
            ${todaySnapshot?.cost.toLocaleString() || '0'}
          </div>
          <div className="text-sm text-muted-foreground">COGS</div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-2">
            <TrendingUp className="h-5 w-5 text-emerald-500" />
            <Badge variant="outline">Net Profit</Badge>
          </div>
          <div className="text-3xl font-bold">
            ${todaySnapshot?.profit.toLocaleString() || '0'}
          </div>
          <div className="text-sm text-emerald-600">
            {todaySnapshot?.margin.toFixed(1) || '0'}% margin
          </div>
        </Card>
      </div>

      {/* Cash Flow */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">💵 Cash Flow</h3>
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <ArrowDown className="h-4 w-4 text-green-500" />
              <span className="font-medium">INCOMING</span>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Collections Today:</span>
                <span className="font-semibold">
                  ${todaySnapshot?.revenue.toLocaleString() || '0'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Expected This Week:</span>
                <span className="font-semibold text-blue-600">
                  ${creditOut?.totalDueThisWeek.toLocaleString() || '0'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Outstanding:</span>
                <span className="font-semibold">
                  ${creditOut?.totalOutstanding.toLocaleString() || '0'}
                </span>
              </div>
            </div>
            <Button variant="outline" className="w-full mt-4" onClick={() => navigate('/admin/financial-center?tab=collections')}>
              View Collections
            </Button>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-3">
              <ArrowUp className="h-4 w-4 text-red-500" />
              <span className="font-medium">OUTGOING</span>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Supplier Payments:</span>
                <span className="font-semibold">
                  ${todaySnapshot?.cost.toLocaleString() || '0'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Payroll:</span>
                <span className="font-semibold">$15,000</span>
              </div>
              <div className="flex justify-between">
                <span>Operating:</span>
                <span className="font-semibold">$8,000</span>
              </div>
            </div>
            <Button variant="outline" className="w-full mt-4" onClick={() => navigate('/admin/financial-center?tab=payables')}>
              View Payables
            </Button>
          </div>
        </div>
      </Card>

      {/* Credit Out (Who Owes You) */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-red-500" />
          🔴 Credit Out (Who Owes You)
        </h3>
        <div className="mb-4">
          <div className="text-2xl font-bold mb-1">
            Total Outstanding: ${creditOut?.totalOutstanding.toLocaleString() || '0'}
          </div>
        </div>

        <Tabs defaultValue="overdue" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overdue">
              OVERDUE (${creditOut?.totalOverdue.toLocaleString() || '0'})
            </TabsTrigger>
            <TabsTrigger value="due_week">
              DUE THIS WEEK (${creditOut?.totalDueThisWeek.toLocaleString() || '0'})
            </TabsTrigger>
            <TabsTrigger value="future">
              FUTURE (${creditOut?.totalFuture.toLocaleString() || '0'})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overdue" className="space-y-2">
            {creditOut?.overdue.length === 0 ? (
              <p className="text-muted-foreground">No overdue accounts</p>
            ) : (
              creditOut?.overdue.map((client: any) => (
                <div
                  key={client.id}
                  className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-950 rounded-lg border border-red-200"
                >
                  <div className="flex-1">
                    <div className="font-semibold">{client.business_name}</div>
                    <div className="text-sm text-muted-foreground">
                      ${client.amount.toLocaleString()} • {client.daysOverdue} days overdue
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => navigate(`/admin/wholesale-clients/${client.id}`)}
                    >
                      <Phone className="h-4 w-4 mr-1" />
                      Collect
                    </Button>
                  </div>
                </div>
              ))
            )}
          </TabsContent>

          <TabsContent value="due_week" className="space-y-2">
            {creditOut?.dueThisWeek.length === 0 ? (
              <p className="text-muted-foreground">No payments due this week</p>
            ) : (
              creditOut?.dueThisWeek.map((client: any) => (
                <div
                  key={client.id}
                  className="flex items-center justify-between p-3 bg-yellow-50 dark:bg-yellow-950 rounded-lg border border-yellow-200"
                >
                  <div className="flex-1">
                    <div className="font-semibold">{client.business_name}</div>
                    <div className="text-sm text-muted-foreground">
                      ${client.amount.toLocaleString()} • Due in {client.daysUntilDue} days
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => navigate(`/admin/wholesale-clients/${client.id}`)}
                  >
                    View
                  </Button>
                </div>
              ))
            )}
          </TabsContent>

          <TabsContent value="future" className="space-y-2">
            {creditOut?.future.length === 0 ? (
              <p className="text-muted-foreground">No future payments</p>
            ) : (
              creditOut?.future.slice(0, 5).map((client: any) => (
                <div
                  key={client.id}
                  className="flex items-center justify-between p-3 bg-muted rounded-lg"
                >
                  <div className="flex-1">
                    <div className="font-semibold">{client.business_name}</div>
                    <div className="text-sm text-muted-foreground">
                      ${client.amount.toLocaleString()}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => navigate(`/admin/wholesale-clients/${client.id}`)}
                  >
                    View
                  </Button>
                </div>
              ))
            )}
          </TabsContent>
        </Tabs>

        <div className="mt-4 pt-4 border-t">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => navigate('/admin/financial-center?tab=collections')}
          >
            Collections Dashboard
          </Button>
        </div>
      </Card>

      {/* Credit In (You Owe Suppliers) */}
      {creditIn && creditIn.totalPayable > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">🔵 Credit In (You Owe)</h3>
          <div className="mb-4">
            <div className="text-2xl font-bold mb-1">
              Total Payable: ${creditIn.totalPayable.toLocaleString()}
            </div>
            <div className="text-sm text-muted-foreground">
              Available Credit: ${creditIn.totalCreditAvailable.toLocaleString()} / ${creditIn.totalCreditLimit.toLocaleString()}
            </div>
          </div>

          <div className="space-y-2">
            {creditIn.suppliers.map((debt: any) => (
              <div
                key={debt.supplier.id}
                className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200"
              >
                <div className="flex-1">
                  <div className="font-semibold">{debt.supplier.business_name}</div>
                  <div className="text-sm text-muted-foreground">
                    ${debt.amount.toLocaleString()} • Credit: {debt.creditAvailable > 0 ? `${(debt.creditAvailable / debt.creditLimit * 100).toFixed(0)}%` : '0%'} available
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigate(`/admin/financial-center?supplier=${debt.supplier.id}`)}
                >
                  Schedule Payment
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* This Month Performance */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">📈 This Month Performance</h3>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <div className="flex justify-between">
              <span>Revenue:</span>
              <span className="font-semibold">
                ${monthPerformance?.revenue.toLocaleString() || '0'}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Cost:</span>
              <span className="font-semibold">
                ${monthPerformance?.cost.toLocaleString() || '0'}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Gross Profit:</span>
              <span className="font-semibold text-emerald-600">
                ${monthPerformance?.grossProfit.toLocaleString() || '0'}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Operating Costs:</span>
              <span className="font-semibold">
                ${monthPerformance?.operatingCost.toLocaleString() || '0'}
              </span>
            </div>
            <div className="flex justify-between pt-2 border-t">
              <span className="font-semibold">NET PROFIT:</span>
              <span className="font-bold text-lg text-emerald-600">
                ${monthPerformance?.netProfit.toLocaleString() || '0'}
              </span>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span>Margin:</span>
              <span className="font-semibold">
                {monthPerformance?.margin.toFixed(1) || '0'}%
              </span>
            </div>
            <div className="flex justify-between">
              <span>Volume:</span>
              <span className="font-semibold">
                {monthPerformance?.volumeLbs.toFixed(1) || '0'} lbs
              </span>
            </div>
            <div className="flex justify-between">
              <span>Deals:</span>
              <span className="font-semibold">
                {monthPerformance?.dealCount} clients
              </span>
            </div>
            <div className="flex justify-between">
              <span>Avg Deal:</span>
              <span className="font-semibold">
                ${monthPerformance?.avgDeal.toLocaleString() || '0'}
              </span>
            </div>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t">
          <Button variant="outline" className="w-full">
            Detailed Reports
          </Button>
        </div>
      </Card>
    </div>
  );
}

