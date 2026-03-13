import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils/formatCurrency";
import { differenceInDays, startOfMonth, endOfMonth } from "date-fns";
import { FileText, TrendingUp, AlertTriangle, DollarSign, Clock } from "lucide-react";

interface Invoice {
  id: string;
  total_amount: number;
  paid_amount: number;
  due_date: string;
  payment_date?: string;
  status: string;
}

interface InvoiceDashboardWidgetProps {
  invoices: Invoice[];
}

/**
 * Task 310: Create invoice dashboard widget
 * Widget showing: outstanding total, overdue total, paid this month, average days to pay
 */
export function InvoiceDashboardWidget({ invoices }: InvoiceDashboardWidgetProps) {
  const calculateMetrics = () => {
    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);

    let outstandingTotal = 0;
    let overdueTotal = 0;
    let paidThisMonthTotal = 0;
    let paidThisMonthCount = 0;
    let totalDaysToPay = 0;
    let overdueCount = 0;

    invoices.forEach((invoice) => {
      const outstanding = invoice.total_amount - invoice.paid_amount;

      // Outstanding total
      if (outstanding > 0 && invoice.status !== "void") {
        outstandingTotal += outstanding;

        // Overdue total
        const daysOverdue = differenceInDays(now, new Date(invoice.due_date));
        if (daysOverdue > 0) {
          overdueTotal += outstanding;
          overdueCount++;
        }
      }

      // Paid this month
      if (invoice.payment_date) {
        const paymentDate = new Date(invoice.payment_date);
        if (paymentDate >= monthStart && paymentDate <= monthEnd) {
          paidThisMonthTotal += invoice.total_amount;
          paidThisMonthCount++;

          // Calculate days to pay
          const daysToPay = differenceInDays(paymentDate, new Date(invoice.due_date));
          totalDaysToPay += daysToPay;
        }
      }
    });

    const avgDaysToPay = paidThisMonthCount > 0 ? Math.round(totalDaysToPay / paidThisMonthCount) : 0;

    return {
      outstandingTotal,
      overdueTotal,
      overdueCount,
      paidThisMonthTotal,
      paidThisMonthCount,
      avgDaysToPay,
    };
  };

  const metrics = calculateMetrics();

  const stats = [
    {
      label: "Outstanding",
      value: formatCurrency(metrics.outstandingTotal),
      icon: FileText,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      label: "Overdue",
      value: formatCurrency(metrics.overdueTotal),
      count: metrics.overdueCount,
      icon: AlertTriangle,
      color: "text-red-600",
      bgColor: "bg-red-50",
    },
    {
      label: "Paid This Month",
      value: formatCurrency(metrics.paidThisMonthTotal),
      count: metrics.paidThisMonthCount,
      icon: DollarSign,
      color: "text-emerald-600",
      bgColor: "bg-emerald-50",
    },
    {
      label: "Avg. Days to Pay",
      value: `${metrics.avgDaysToPay}`,
      icon: Clock,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-emerald-600" />
          Invoice Overview
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <div
                key={index}
                className="flex flex-col gap-2 p-4 rounded-lg border hover:shadow-sm transition-shadow"
              >
                <div className={`w-10 h-10 rounded-lg ${stat.bgColor} flex items-center justify-center`}>
                  <Icon className={`h-5 w-5 ${stat.color}`} />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">{stat.label}</div>
                  <div className={`text-xl font-bold ${stat.color}`}>
                    {stat.value}
                  </div>
                  {stat.count !== undefined && (
                    <div className="text-xs text-muted-foreground mt-1">
                      {stat.count} invoice{stat.count !== 1 ? "s" : ""}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {metrics.overdueCount > 0 && (
          <Badge variant="destructive" className="w-full justify-center mt-4">
            {metrics.overdueCount} overdue invoice{metrics.overdueCount !== 1 ? "s" : ""}
          </Badge>
        )}
      </CardContent>
    </Card>
  );
}
