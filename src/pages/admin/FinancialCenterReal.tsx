import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DollarSign, TrendingUp, ArrowUpRight, ArrowDownRight, AlertCircle, Loader2, BarChart, Receipt, Tag, CreditCard } from "lucide-react";
import { useWholesaleOrders, useWholesaleClients, useWholesalePayments } from "@/hooks/useWholesaleData";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import { format, isToday, startOfMonth, endOfMonth } from "date-fns";
import { useNavigate } from "react-router-dom";
import { useState, useMemo } from "react";
import { PaymentDialog } from "@/components/admin/PaymentDialog";
import { useTenantNavigation } from "@/lib/navigation/tenantNavigation";
import { useExpenseSummary } from "@/hooks/useFinancialData";
import { TruncatedText } from "@/components/shared/TruncatedText";

export default function FinancialCenterReal() {
  const navigate = useNavigate();
  const { navigateToAdmin } = useTenantNavigation();
  const { tenantSlug } = useTenantAdminAuth();
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<{ id: string; business_name: string; outstanding_balance: number } | null>(null);
  const { data: orders = [], isLoading: ordersLoading } = useWholesaleOrders();
  const { data: clients = [], isLoading: clientsLoading } = useWholesaleClients();
  const { data: payments = [], isLoading: paymentsLoading } = useWholesalePayments();
  const { data: expenseSummary } = useExpenseSummary();

  const now = new Date();

  const {
    todayOrders,
    todayRevenue,
    todayCost,
    todayProfit,
    todayMargin,
    todayCollections,
    totalOutstanding,
    overdueClients,
    monthRevenue,
    monthCost,
    monthGrossProfit,
    monthMargin,
    monthDeals,
    avgDealSize,
    clientProfits,
  } = useMemo(() => {
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);

    // Today's snapshot
    const todayOrders = orders.filter(o =>
      o.created_at && isToday(new Date(o.created_at))
    );
    const todayRevenue = todayOrders.reduce((sum, o) => sum + Number(o.total_amount), 0);
    const todayCost = todayOrders.reduce((sum, o) => sum + Number(o.total_amount * 0.65), 0);
    const todayProfit = todayRevenue - todayCost;
    const todayMargin = todayRevenue > 0 ? Math.round((todayProfit / todayRevenue) * 100) : 0;

    // Cash flow
    const todayCollections = payments
      .filter(p => p.created_at && isToday(new Date(p.created_at)))
      .reduce((sum, p) => sum + Number(p.amount), 0);

    const totalOutstanding = clients.reduce((sum, c) => sum + Number(c.outstanding_balance), 0);

    // Overdue clients - simplified since we don't have due_date field
    const overdueClients = clients
      .filter(c => Number(c.outstanding_balance) > 0)
      .map(c => ({
        client: c.business_name,
        amount: Number(c.outstanding_balance),
        days: 0 // We don't track this currently
      }))
      .sort((a, b) => b.amount - a.amount);

    // Monthly performance
    const monthOrders = orders.filter(o => {
      if (!o.created_at) return false;
      const orderDate = new Date(o.created_at);
      return orderDate >= monthStart && orderDate <= monthEnd;
    });

    const monthRevenue = monthOrders.reduce((sum, o) => sum + Number(o.total_amount), 0);
    const monthCost = monthOrders.reduce((sum, o) => sum + Number(o.total_amount * 0.65), 0);
    const monthGrossProfit = monthRevenue - monthCost;
    const monthMargin = monthRevenue > 0 ? ((monthGrossProfit / monthRevenue) * 100).toFixed(1) : "0";
    const monthDeals = new Set(monthOrders.map(o => o.client_id)).size;
    const avgDealSize = monthDeals > 0 ? Math.round(monthRevenue / monthDeals) : 0;

    // Build order lookup map to avoid O(n*m) nested loop
    const ordersByClient = new Map<string, typeof monthOrders>();
    monthOrders.forEach(o => {
      const existing = ordersByClient.get(o.client_id) ?? [];
      existing.push(o);
      ordersByClient.set(o.client_id, existing);
    });

    // Top clients by profit — O(n) via lookup map instead of O(n*m)
    const clientProfits = clients
      .map(c => {
        const clientOrders = ordersByClient.get(c.id) ?? [];
        const revenue = clientOrders.reduce((sum, o) => sum + Number(o.total_amount), 0);
        const cost = clientOrders.reduce((sum, o) => sum + Number(o.total_amount * 0.65), 0);
        const profit = revenue - cost;
        const warning = Number(c.outstanding_balance) > 10000
          ? `owes $${(Number(c.outstanding_balance) / 1000).toFixed(0)}k`
          : "";

        return {
          name: c.business_name,
          profit,
          volume: 0, // We don't track weight currently
          warning
        };
      })
      .filter(c => c.profit > 0)
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 3);

    return {
      todayOrders,
      todayRevenue,
      todayCost,
      todayProfit,
      todayMargin,
      todayCollections,
      totalOutstanding,
      overdueClients,
      monthRevenue,
      monthCost,
      monthGrossProfit,
      monthMargin,
      monthDeals,
      avgDealSize,
      clientProfits,
    };
  // `now`, `monthStart`, `monthEnd` are derived from `new Date()` inside the memo.
  // Adding `now` would defeat memoization since it changes every render.
  // Recomputation is correctly driven by data changes (orders/clients/payments).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders, clients, payments]);

  // Loading check AFTER all hooks to comply with Rules of Hooks
  if (ordersLoading || clientsLoading || paymentsLoading) {
    return (
      <div className="flex items-center justify-center h-dvh">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container py-8">
      <h1 className="text-2xl font-bold mb-4">Financial Center</h1>

      {/* Today's Snapshot */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card className="bg-blue-50 text-blue-900">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Today's Revenue</div>
              <div className="text-lg font-semibold">${todayRevenue.toFixed(2)}</div>
            </div>
            <DollarSign className="h-5 w-5" />
          </div>
        </Card>

        <Card className="bg-green-50 text-green-900">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Today's Profit</div>
              <div className="text-lg font-semibold">${todayProfit.toFixed(2)}</div>
            </div>
            <TrendingUp className="h-5 w-5" />
          </div>
        </Card>

        <Card className="bg-yellow-50 text-yellow-900">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Today's Margin</div>
              <div className="text-lg font-semibold">{todayMargin}%</div>
            </div>
            <ArrowUpRight className="h-5 w-5" />
          </div>
        </Card>

        <Card className="bg-purple-50 text-purple-900">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Today's Collections</div>
              <div className="text-lg font-semibold">${todayCollections.toFixed(2)}</div>
            </div>
            <Receipt className="h-5 w-5" />
          </div>
        </Card>
      </section>

      {/* Monthly Performance */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card className="bg-blue-50 text-blue-900">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Month Revenue</div>
              <div className="text-lg font-semibold">${monthRevenue.toFixed(2)}</div>
            </div>
            <DollarSign className="h-5 w-5" />
          </div>
        </Card>

        <Card className="bg-green-50 text-green-900">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Month Gross Profit</div>
              <div className="text-lg font-semibold">${monthGrossProfit.toFixed(2)}</div>
            </div>
            <TrendingUp className="h-5 w-5" />
          </div>
        </Card>

        <Card className="bg-yellow-50 text-yellow-900">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Month Margin</div>
              <div className="text-lg font-semibold">{monthMargin}%</div>
            </div>
            <ArrowUpRight className="h-5 w-5" />
          </div>
        </Card>

        <Card className="bg-purple-50 text-purple-900">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Avg Deal Size</div>
              <div className="text-lg font-semibold">${avgDealSize.toFixed(2)}</div>
            </div>
            <BarChart className="h-5 w-5" />
          </div>
        </Card>
      </section>

      {/* Receivables */}
      <section className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold">Receivables</h2>
          <Button size="sm" onClick={() => navigateToAdmin(`/clients`)}>
            View All
          </Button>
        </div>

        <Card className="bg-red-50 text-red-900">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Total Outstanding</div>
              <div className="text-lg font-semibold">${totalOutstanding.toFixed(2)}</div>
            </div>
            <AlertCircle className="h-5 w-5" />
          </div>
        </Card>
      </section>

      {/* Overdue Invoices */}
      <section className="mb-6">
        <h2 className="text-lg font-semibold mb-2">Overdue Invoices</h2>
        {overdueClients.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {overdueClients.map((invoice, index) => (
              <Card key={index} className="bg-orange-50 text-orange-900">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-sm font-medium">Client</div>
                    <div className="text-lg font-semibold">{invoice.client}</div>
                    <div className="text-sm">Amount: ${invoice.amount.toFixed(2)}</div>
                    <div className="text-xs">Days Overdue: {invoice.days}</div>
                  </div>
                  <AlertCircle className="h-5 w-5" />
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="text-center p-4">No overdue invoices</Card>
        )}
      </section>

      {/* Top Clients by Profit */}
      <section className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold">Top Clients by Profit</h2>
          <Button size="sm" onClick={() => navigateToAdmin(`/clients`)}>
            View All
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {clientProfits.map((client, index) => (
            <Card key={index} className="bg-green-50 text-green-900">
              <div className="flex flex-col">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">Client</div>
                  <Tag className="h-4 w-4" />
                </div>
                <div className="text-lg font-semibold">
                  <TruncatedText text={client.name} maxWidthClass="max-w-[200px]" />
                </div>
                <div className="text-sm">Profit: ${client.profit.toFixed(2)}</div>
                {client.warning && (
                  <Badge variant="destructive" className="mt-2">
                    <AlertCircle className="h-4 w-4 mr-1" />
                    {client.warning}
                  </Badge>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-3"
                  onClick={() => {
                    const clientData = clients.find(c => c.business_name === client.name);
                    if (clientData) {
                      setSelectedClient({
                        id: clientData.id,
                        business_name: clientData.business_name,
                        outstanding_balance: clientData.outstanding_balance
                      });
                      setPaymentDialogOpen(true);
                    }
                  }}
                >
                  Record Payment
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* Expenses Summary */}
      {expenseSummary && (
        <section className="mb-6">
          <h2 className="text-lg font-semibold mb-2">Expenses Summary</h2>
          <Card className="bg-muted/50">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="text-sm font-medium">Total Expenses</div>
                <div className="text-lg font-semibold">${expenseSummary.totalExpenses.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-sm font-medium">Expenses This Month</div>
                <div className="text-lg font-semibold">${expenseSummary.thisMonthExpenses.toFixed(2)}</div>
              </div>
            </div>
          </Card>
        </section>
      )}

      {selectedClient && (
        <PaymentDialog
          open={paymentDialogOpen}
          onOpenChange={setPaymentDialogOpen}
          clientId={selectedClient.id}
          clientName={selectedClient.business_name}
          outstandingBalance={selectedClient.outstanding_balance}
        />
      )}
    </div>
  );
}
