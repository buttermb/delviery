import { useQuery } from "@tanstack/react-query";
import { FileText, DollarSign, Clock, TrendingUp, AlertCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import { formatCurrency } from "@/lib/utils/formatCurrency";
import { queryKeys } from "@/lib/queryKeys";
import { differenceInDays, startOfMonth, endOfMonth } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

/**
 * Task 310: Invoice Dashboard Widget
 * Shows: outstanding total, overdue total, paid this month, average days to pay
 */
export function InvoiceDashboardWidget() {
  const { tenant } = useTenantAdminAuth();

  const { data: metrics, isLoading } = useQuery({
    queryKey: [...queryKeys.crm.invoices.lists(), "dashboard-metrics"],
    queryFn: async () => {
      if (!tenant?.id) return null;

      const now = new Date();
      const monthStart = startOfMonth(now);
      const monthEnd = endOfMonth(now);

      // Fetch all invoices
      const { data: invoices, error } = await supabase
        .from("crm_invoices")
        .select("id, status, total, amount_paid, due_date, invoice_date, paid_at")
        .eq("account_id", tenant.id);

      if (error) throw error;
      if (!invoices) return null;

      // Calculate metrics
      let outstandingTotal = 0;
      let overdueTotal = 0;
      let paidThisMonth = 0;
      let totalDaysToPay = 0;
      let paidInvoiceCount = 0;

      invoices.forEach((inv) => {
        const outstanding = inv.total - (inv.amount_paid || 0);

        // Outstanding invoices
        if (inv.status !== "paid" && inv.status !== "cancelled") {
          outstandingTotal += outstanding;

          // Overdue invoices
          if (new Date(inv.due_date) < now) {
            overdueTotal += outstanding;
          }
        }

        // Paid this month
        if (inv.paid_at) {
          const paidDate = new Date(inv.paid_at);
          if (paidDate >= monthStart && paidDate <= monthEnd) {
            paidThisMonth += inv.total;
          }

          // Average days to pay
          const invoiceDate = new Date(inv.invoice_date);
          const daysToPay = differenceInDays(paidDate, invoiceDate);
          if (daysToPay >= 0) {
            totalDaysToPay += daysToPay;
            paidInvoiceCount++;
          }
        }
      });

      const avgDaysToPay = paidInvoiceCount > 0 ? Math.round(totalDaysToPay / paidInvoiceCount) : 0;

      return {
        outstandingTotal,
        overdueTotal,
        paidThisMonth,
        avgDaysToPay,
        overdueCount: invoices.filter(
          (inv) => inv.status !== "paid" && inv.status !== "cancelled" && new Date(inv.due_date) < now
        ).length,
      };
    },
    enabled: !!tenant?.id,
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-4 rounded" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-7 w-24 mb-1" />
              <Skeleton className="h-3 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!metrics) return null;

  const stats = [
    {
      title: "Outstanding",
      value: formatCurrency(metrics.outstandingTotal),
      description: "Total unpaid invoices",
      icon: FileText,
      color: "text-blue-600",
      bgColor: "bg-blue-100 dark:bg-blue-900/20",
    },
    {
      title: "Overdue",
      value: formatCurrency(metrics.overdueTotal),
      description: `${metrics.overdueCount} invoices past due`,
      icon: AlertCircle,
      color: "text-red-600",
      bgColor: "bg-red-100 dark:bg-red-900/20",
      badge: metrics.overdueCount > 0 ? metrics.overdueCount.toString() : undefined,
    },
    {
      title: "Paid This Month",
      value: formatCurrency(metrics.paidThisMonth),
      description: "Current month revenue",
      icon: DollarSign,
      color: "text-emerald-600",
      bgColor: "bg-emerald-100 dark:bg-emerald-900/20",
    },
    {
      title: "Avg Days to Pay",
      value: metrics.avgDaysToPay.toString(),
      description: "Average payment time",
      icon: Clock,
      color: "text-purple-600",
      bgColor: "bg-purple-100 dark:bg-purple-900/20",
      suffix: " days",
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                <Icon className={`h-4 w-4 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <div className="text-2xl font-bold">
                  {stat.value}
                  {stat.suffix}
                </div>
                {stat.badge && (
                  <Badge variant="destructive" className="h-5">
                    {stat.badge}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">{stat.description}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
