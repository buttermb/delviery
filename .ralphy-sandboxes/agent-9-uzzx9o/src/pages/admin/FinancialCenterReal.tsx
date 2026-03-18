import { useState, useMemo } from "react";
import { isToday, startOfMonth, endOfMonth } from "date-fns";
import { motion } from "framer-motion";
import { DollarSign, TrendingUp, ArrowUpRight, AlertCircle, Loader2, BarChart, Receipt, CreditCard, Wallet, Calendar, ArrowRight, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PaymentDialog } from "@/components/admin/PaymentDialog";
import { useWholesaleOrders, useWholesaleClients, useWholesalePayments } from "@/hooks/useWholesaleData";
import { useTenantNavigation } from "@/lib/navigation/tenantNavigation";
import { useExpenseSummary } from "@/hooks/useFinancialData";
import { cn } from "@/lib/utils";

const MotionCard = motion(Card);

export default function FinancialCenterReal() {
  const { navigateToAdmin } = useTenantNavigation();
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<{ id: string; business_name: string; outstanding_balance: number } | null>(null);
  const { data: orders = [], isLoading: ordersLoading } = useWholesaleOrders();
  const { data: clients = [], isLoading: clientsLoading } = useWholesaleClients();
  const { data: payments = [], isLoading: paymentsLoading } = useWholesalePayments();
  const { data: expenseSummary } = useExpenseSummary();

  const now = new Date();

  const {
    todayOrders: _todayOrders,
    todayRevenue,
    todayCost: _todayCost,
    todayProfit,
    todayMargin,
    todayCollections,
    totalOutstanding,
    overdueClients,
    monthRevenue,
    monthCost: _monthCost,
    monthGrossProfit,
    monthMargin,
    monthDeals: _monthDeals,
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
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground animate-pulse">Gathering financial intelligence...</p>
        </div>
      </div>
    );
  }

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    show: {
      y: 0,
      opacity: 1,
      transition: { type: "spring" as const, stiffness: 300, damping: 24 }
    }
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="max-w-7xl mx-auto space-y-8 p-4 sm:p-6 lg:p-8 pb-24"
    >
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-transparent flex items-center gap-3">
          <Wallet className="w-8 h-8 text-primary" />
          Financial Center
        </h1>
        <p className="text-muted-foreground">Monitor real-time cash flow, profitability, and outstanding balances.</p>
      </div>

      {/* Today's Pulse */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <div className="h-6 w-1 rounded-full bg-blue-500" />
          <h2 className="text-xl font-semibold tracking-tight">Today's Pulse</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MotionCard variants={itemVariants} className="overflow-hidden relative group border-blue-500/20 bg-gradient-to-br from-card to-blue-50/50 dark:to-blue-950/20 shadow-sm hover:shadow-md transition-all duration-300">
            <div className="absolute right-0 top-0 w-24 h-24 bg-blue-500/10 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110" />
            <div className="p-6 relative z-10 flex flex-col justify-between h-full">
              <div className="flex items-start justify-between mb-4">
                <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                  <DollarSign className="h-5 w-5" />
                </div>
              </div>
              <div>
                <div className="text-3xl font-bold tracking-tight tabular-nums">${todayRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                <div className="text-sm font-medium text-muted-foreground mt-1">Today's Revenue</div>
              </div>
            </div>
          </MotionCard>

          <MotionCard variants={itemVariants} className="overflow-hidden relative group border-emerald-500/20 bg-gradient-to-br from-card to-emerald-50/50 dark:to-emerald-950/20 shadow-sm hover:shadow-md transition-all duration-300">
            <div className="absolute right-0 top-0 w-24 h-24 bg-emerald-500/10 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110" />
            <div className="p-6 relative z-10 flex flex-col justify-between h-full">
              <div className="flex items-start justify-between mb-4">
                <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <TrendingUp className="h-5 w-5" />
                </div>
              </div>
              <div>
                <div className="text-3xl font-bold tracking-tight tabular-nums">${todayProfit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                <div className="text-sm font-medium text-muted-foreground mt-1">Today's Profit</div>
              </div>
            </div>
          </MotionCard>

          <MotionCard variants={itemVariants} className="overflow-hidden relative group border-amber-500/20 bg-gradient-to-br from-card to-amber-50/50 dark:to-amber-950/20 shadow-sm hover:shadow-md transition-all duration-300">
            <div className="absolute right-0 top-0 w-24 h-24 bg-amber-500/10 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110" />
            <div className="p-6 relative z-10 flex flex-col justify-between h-full">
              <div className="flex items-start justify-between mb-4">
                <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <ArrowUpRight className="h-5 w-5" />
                </div>
              </div>
              <div>
                <div className="text-3xl font-bold tracking-tight tabular-nums">{todayMargin}%</div>
                <div className="text-sm font-medium text-muted-foreground mt-1">Gross Margin</div>
              </div>
            </div>
          </MotionCard>

          <MotionCard variants={itemVariants} className="overflow-hidden relative group border-purple-500/20 bg-gradient-to-br from-card to-purple-50/50 dark:to-purple-950/20 shadow-sm hover:shadow-md transition-all duration-300">
            <div className="absolute right-0 top-0 w-24 h-24 bg-purple-500/10 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110" />
            <div className="p-6 relative z-10 flex flex-col justify-between h-full">
              <div className="flex items-start justify-between mb-4">
                <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
                  <Receipt className="h-5 w-5" />
                </div>
              </div>
              <div>
                <div className="text-3xl font-bold tracking-tight tabular-nums">${todayCollections.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                <div className="text-sm font-medium text-muted-foreground mt-1">Cash Collected</div>
              </div>
            </div>
          </MotionCard>
        </div>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {/* Monthly Performance */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="h-6 w-1 rounded-full bg-indigo-500" />
            <h2 className="text-xl font-semibold tracking-tight">Monthly Closeout</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <MotionCard variants={itemVariants} className="p-6 border-none shadow-md bg-card ring-1 ring-border/50 flex flex-col gap-1 hover:ring-border transition-all">
              <div className="text-sm font-medium text-muted-foreground flex items-center gap-2 mb-2">
                <Calendar className="w-4 h-4 text-indigo-500" /> MTD Revenue
              </div>
              <div className="text-2xl font-bold font-mono tracking-tight">${monthRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </MotionCard>

            <MotionCard variants={itemVariants} className="p-6 border-none shadow-md bg-card ring-1 ring-border/50 flex flex-col gap-1 hover:ring-border transition-all">
              <div className="text-sm font-medium text-muted-foreground flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-emerald-500" /> Gross Profit
              </div>
              <div className="text-2xl font-bold font-mono tracking-tight text-emerald-600 dark:text-emerald-400">${monthGrossProfit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </MotionCard>

            <MotionCard variants={itemVariants} className="p-6 border-none shadow-md bg-card ring-1 ring-border/50 flex flex-col gap-1 hover:ring-border transition-all">
              <div className="text-sm font-medium text-muted-foreground flex items-center gap-2 mb-2">
                <BarChart className="w-4 h-4 text-amber-500" /> Average Margin
              </div>
              <div className="text-2xl font-bold font-mono tracking-tight">{monthMargin}%</div>
            </MotionCard>

            <MotionCard variants={itemVariants} className="p-6 border-none shadow-md bg-card ring-1 ring-border/50 flex flex-col gap-1 hover:ring-border transition-all cursor-pointer group" onClick={() => navigateToAdmin(`/orders`)}>
              <div className="text-sm font-medium text-muted-foreground flex items-center justify-between mb-2">
                <span className="flex items-center gap-2"><CreditCard className="w-4 h-4 text-blue-500" /> Avg Deal Size</span>
                <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity translate-x-[-10px] group-hover:translate-x-0" />
              </div>
              <div className="text-2xl font-bold font-mono tracking-tight">${avgDealSize.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </MotionCard>
          </div>
        </section>

        {/* Receivables & Overhead */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="h-6 w-1 rounded-full bg-rose-500" />
            <h2 className="text-xl font-semibold tracking-tight">Liabilities & Cash Flow</h2>
          </div>

          <div className="grid grid-cols-1 gap-4 h-[calc(100%-2.5rem)]">
            <MotionCard variants={itemVariants} className="p-6 border-red-500/20 bg-gradient-to-br from-card to-red-50/50 dark:to-red-950/20 shadow-md flex justify-between items-center group cursor-pointer" onClick={() => navigateToAdmin(`/clients`)}>
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-xl bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 mt-1">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground mb-1">Total Outstanding A/R</div>
                  <div className="text-4xl font-bold tracking-tight text-red-600 dark:text-red-400 tabular-nums">
                    ${totalOutstanding.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="rounded-full shrink-0 group-hover:bg-red-500/10 text-red-600 dark:text-red-400 transition-transform group-hover:translate-x-1">
                <ArrowRight className="w-5 h-5" />
              </Button>
            </MotionCard>

            {expenseSummary && (
              <MotionCard variants={itemVariants} className="p-6 border-none shadow-md bg-muted/30 grid grid-cols-2 gap-6 divide-x">
                <div>
                  <div className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                    <DollarSign className="w-4 h-4" /> YTD Expenses
                  </div>
                  <div className="text-2xl font-semibold tracking-tight font-mono">${(Number(expenseSummary.totalExpenses) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                </div>
                <div className="pl-6">
                  <div className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                    <Calendar className="w-4 h-4" /> MTD Expenses
                  </div>
                  <div className="text-2xl font-semibold tracking-tight font-mono">${(Number(expenseSummary.thisMonthExpenses) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                </div>
              </MotionCard>
            )}
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-4">
        {/* Overdue Clients List */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-6 w-1 rounded-full bg-orange-500" />
              <h2 className="text-xl font-semibold tracking-tight">Action Required</h2>
            </div>
          </div>

          <MotionCard variants={itemVariants} className="shadow-md overflow-hidden bg-card border-none ring-1 ring-border/50">
            {overdueClients.length > 0 ? (
              <div className="divide-y divide-border/50">
                {overdueClients.slice(0, 5).map((invoice, index) => (
                  <div key={index} className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors group cursor-pointer" onClick={() => navigateToAdmin(`/clients`)}>
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="h-10 w-10 shrink-0 bg-primary/10 text-primary font-bold rounded-full flex items-center justify-center text-sm uppercase">
                        {invoice.client.slice(0, 2)}
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-sm truncate">{invoice.client}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">Net 30 — {invoice.days}d overdue</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 shrink-0 pl-4">
                      <div className="text-right">
                        <div className="font-mono font-bold text-orange-600 dark:text-orange-400">
                          ${invoice.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                      </div>
                      <AlertCircle className="w-4 h-4 text-orange-500 opacity-50 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-12 flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 bg-green-500/10 text-green-500 rounded-full flex items-center justify-center mb-4">
                  <TrendingUp className="w-8 h-8" />
                </div>
                <h3 className="font-semibold text-lg">All caught up!</h3>
                <p className="text-muted-foreground text-sm max-w-[250px] mt-1">No overdue invoices found. Your cash flow is looking healthy.</p>
              </div>
            )}
            {overdueClients.length > 5 && (
              <div className="bg-muted/20 p-3 text-center border-t border-border/50">
                <Button variant="link" size="sm" onClick={() => navigateToAdmin(`/clients`)} className="text-muted-foreground hover:text-foreground">
                  View all {overdueClients.length} overdue accounts
                </Button>
              </div>
            )}
          </MotionCard>
        </section>

        {/* Top Clients by Profit */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-6 w-1 rounded-full bg-emerald-500" />
              <h2 className="text-xl font-semibold tracking-tight">Top Value Drivers</h2>
            </div>
            <Button variant="outline" size="sm" onClick={() => navigateToAdmin(`/clients`)} className="text-xs h-8">
              View CRM
            </Button>
          </div>

          <MotionCard variants={itemVariants} className="shadow-md overflow-hidden bg-card border-none ring-1 ring-border/50">
            {clientProfits.length > 0 ? (
              <div className="divide-y divide-border/50">
                {clientProfits.map((client, index) => {
                  // Calculate relative bar width (max 100%) against top client
                  const maxProfit = clientProfits[0].profit;
                  const barWidth = Math.max(5, Math.min(100, (client.profit / maxProfit) * 100));

                  return (
                    <div key={index} className="px-4 py-5 hover:bg-muted/30 transition-colors">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className={cn("w-6 h-6 rounded flex items-center justify-center text-xs font-bold",
                            index === 0 ? "bg-yellow-500 text-white" :
                              index === 1 ? "bg-slate-300 text-slate-800" :
                                "bg-amber-700 text-white"
                          )}>
                            {index + 1}
                          </div>
                          <div>
                            <div className="font-semibold text-sm line-clamp-1" title={client.name}>{client.name}</div>
                            {client.warning && (
                              <div className="flex items-center gap-1 text-[10px] text-red-500 mt-0.5 font-medium">
                                <AlertCircle className="w-3 h-3" /> {client.warning}
                              </div>
                            )}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="secondary"
                          className="h-7 text-xs px-3 font-semibold shrink-0 ml-4 hover:bg-emerald-500 hover:text-white transition-colors border-emerald-500/20"
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
                          <DollarSign className="w-3 h-3 mr-1" /> Pay
                        </Button>
                      </div>

                      {/* Profit Progress Bar visualization */}
                      <div className="flex items-center gap-3 w-full pl-9">
                        <div className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 w-[60px] shrink-0 text-right">
                          ${client.profit.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </div>
                        <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${barWidth}%` }}
                            transition={{ duration: 1, ease: "easeOut", delay: 0.2 + (index * 0.1) }}
                            className={cn("h-full rounded-full",
                              index === 0 ? "bg-emerald-500" :
                                index === 1 ? "bg-emerald-400" :
                                  "bg-emerald-300 dark:bg-emerald-600"
                            )}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-12 text-center text-muted-foreground flex flex-col items-center">
                <Users className="w-12 h-12 opacity-20 mb-3" />
                <p>Not enough data to calculate top clients yet.</p>
              </div>
            )}
          </MotionCard>
        </section>
      </div>

      {selectedClient && (
        <PaymentDialog
          open={paymentDialogOpen}
          onOpenChange={setPaymentDialogOpen}
          clientId={selectedClient.id}
          clientName={selectedClient.business_name}
          outstandingBalance={selectedClient.outstanding_balance}
        />
      )}
    </motion.div>
  );
}
