import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DollarSign, TrendingUp, ArrowUpRight, ArrowDownRight, AlertCircle, Loader2 } from "lucide-react";
import { useWholesaleOrders, useWholesaleClients, useWholesalePayments } from "@/hooks/useWholesaleData";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import { format, isToday, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { PaymentDialog } from "@/components/admin/PaymentDialog";
import { useTenantNavigation } from "@/lib/navigation/tenantNavigation";

export default function FinancialCenterReal() {
  const navigate = useNavigate();
  const { navigateToAdmin } = useTenantNavigation();
  const { tenant } = useTenantAdminAuth();
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const { data: orders = [], isLoading: ordersLoading } = useWholesaleOrders();
  const { data: clients = [], isLoading: clientsLoading } = useWholesaleClients();
  const { data: payments = [], isLoading: paymentsLoading } = useWholesalePayments();

  if (ordersLoading || clientsLoading || paymentsLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const now = new Date();
  const weekStart = startOfWeek(now);
  const weekEnd = endOfWeek(now);
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

  // Top clients by profit
  const clientProfits = clients
    .map(c => {
      const clientOrders = monthOrders.filter(o => o.client_id === c.id);
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

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">💰 Financial Command Center</h1>
        <p className="text-sm text-muted-foreground mt-1">{format(now, "MMMM d, yyyy")}</p>
      </div>

      {/* Today's Snapshot */}
      <div>
        <h2 className="text-lg font-semibold mb-3">📊 Today's Snapshot</h2>
        <div className="grid grid-cols-3 gap-4">
          <Card className="p-4">
            <div className="text-sm text-muted-foreground mb-1">Revenue</div>
            <div className="text-3xl font-bold text-emerald-500">
              ${todayRevenue.toLocaleString()}
            </div>
            <div className="text-xs text-muted-foreground mt-1">{todayOrders.length} deals</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-muted-foreground mb-1">Cost</div>
            <div className="text-3xl font-bold">${todayCost.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground mt-1">COGS</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-muted-foreground mb-1">Net Profit</div>
            <div className="text-3xl font-bold text-emerald-500">
              ${todayProfit.toLocaleString()}
            </div>
            <div className="text-xs text-emerald-500 mt-1">{todayMargin}% margin</div>
          </Card>
        </div>
      </div>

      {/* Cash Flow */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Cash Flow
        </h2>
        <div className="grid grid-cols-2 gap-6">
          {/* Incoming */}
          <div>
            <h3 className="font-semibold mb-3 flex items-center gap-2 text-emerald-500">
              <ArrowUpRight className="h-4 w-4" />
              Incoming
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Collections Today:</span>
                <span className="font-mono font-semibold">${todayCollections.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Expected This Week:</span>
                <span className="font-mono font-semibold">TBD</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Outstanding:</span>
                <span className="font-mono font-semibold">${totalOutstanding.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Outgoing */}
          <div>
            <h3 className="font-semibold mb-3 flex items-center gap-2 text-muted-foreground">
              <ArrowDownRight className="h-4 w-4" />
              Outgoing
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Operating Costs:</span>
                <span className="font-mono">Track in accounting</span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Credit Out (Who Owes You) */}
      <Card className="p-6 border-l-4 border-l-yellow-500">
        <h2 className="text-lg font-semibold mb-4">🔴 Credit Out (Who Owes You)</h2>

        <div className="mb-4">
          <div className="text-3xl font-bold font-mono mb-1">
            ${totalOutstanding.toLocaleString()}
          </div>
          <div className="text-sm text-muted-foreground">Total Outstanding</div>
        </div>

        {overdueClients.length > 0 && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 mb-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertCircle className="h-5 w-5 text-destructive" />
              <span className="font-semibold text-destructive">OVERDUE (🚨 Priority)</span>
              <span className="font-mono font-bold ml-auto">
                ${overdueClients.reduce((sum, c) => sum + c.amount, 0).toLocaleString()}
              </span>
            </div>
            <div className="space-y-2">
              {overdueClients.slice(0, 5).map((client, idx) => {
                const clientData = clients.find(c => c.business_name === client.client);
                return (
                  <div key={idx} className="flex items-center justify-between text-sm">
                    <span>• {client.client}: ${client.amount.toLocaleString()} ({client.days} days)</span>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => {
                        if (clientData) {
                          setSelectedClient(clientData);
                          setPaymentDialogOpen(true);
                        }
                      }}
                    >
                      Collect
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <Button
            className="bg-emerald-500 hover:bg-emerald-600"
            onClick={() => navigateToAdmin('wholesale-clients')}
          >
            Collections Dashboard
          </Button>
          <Button
            variant="outline"
            onClick={() => navigateToAdmin('wholesale-clients')}
          >
            Send Reminders
          </Button>
        </div>
      </Card>

      {/* Monthly Performance */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          This Month Performance
        </h2>

        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Revenue:</span>
              <div className="text-right">
                <div className="font-mono font-bold">${monthRevenue.toLocaleString()}</div>
              </div>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Cost:</span>
              <span className="font-mono">${monthCost.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Gross Profit:</span>
              <div className="text-right">
                <div className="font-mono font-bold text-emerald-500">
                  ${monthGrossProfit.toLocaleString()}
                </div>
                <div className="text-xs text-muted-foreground">
                  {monthMargin}% margin
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Volume:</span>
              <span className="font-mono font-bold">Tracked</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Deals:</span>
              <span className="font-mono font-bold">{monthDeals} clients</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Avg Deal Size:</span>
              <span className="font-mono font-bold">${avgDealSize.toLocaleString()}</span>
            </div>

            {clientProfits.length > 0 && (
              <div className="pt-3 border-t">
                <div className="text-sm font-semibold mb-2">Top Clients by Profit:</div>
                <div className="space-y-2">
                  {clientProfits.map((client, idx) => (
                    <div key={idx} className="text-sm">
                      <div className="flex justify-between">
                        <span>{idx + 1}. {client.name}</span>
                        <span className="font-mono font-semibold text-emerald-500">
                          ${(client.profit / 1000).toFixed(1)}k
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {client.warning && <span className="text-destructive">🔴 {client.warning}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>

      {selectedClient && (
        <PaymentDialog
          clientId={selectedClient.id}
          clientName={selectedClient.business_name}
          outstandingBalance={Number(selectedClient.outstanding_balance || 0)}
          open={paymentDialogOpen}
          onOpenChange={setPaymentDialogOpen}
        />
      )}
    </div>
  );
}
