import { useQuery } from "@tanstack/react-query";
import { FileText, Clock, TrendingUp, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import { formatCurrency } from "@/lib/utils/formatCurrency";
import { queryKeys } from "@/lib/queryKeys";
import { differenceInDays } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

interface AgingBucket {
  label: string;
  days: string;
  count: number;
  total: number;
  color: string;
}

/**
 * Task 305: Invoice Aging Report
 * Shows invoices by age buckets: current, 1-30, 31-60, 61-90, 90+ days
 */
export function InvoiceAgingReport() {
  const { tenant } = useTenantAdminAuth();

  const { data: invoices, isLoading } = useQuery({
    queryKey: [...queryKeys.crm.invoices.lists(), "aging"],
    queryFn: async () => {
      if (!tenant?.id) return [];

      const { data, error } = await supabase
        .from("crm_invoices")
        .select("id, due_date, total, amount_paid, status")
        .eq("account_id", tenant.id)
        .in("status", ["sent", "overdue", "partially_paid"]);

      if (error) throw error;
      return data || [];
    },
    enabled: !!tenant?.id,
  });

  const buckets: AgingBucket[] = [
    { label: "Current", days: "0", count: 0, total: 0, color: "emerald" },
    { label: "1-30 Days", days: "1-30", count: 0, total: 0, color: "blue" },
    { label: "31-60 Days", days: "31-60", count: 0, total: 0, color: "yellow" },
    { label: "61-90 Days", days: "61-90", count: 0, total: 0, color: "orange" },
    { label: "90+ Days", days: "90+", count: 0, total: 0, color: "red" },
  ];

  if (invoices) {
    invoices.forEach((inv) => {
      const daysOverdue = differenceInDays(new Date(), new Date(inv.due_date));
      const outstanding = inv.total - (inv.amount_paid || 0);

      if (daysOverdue <= 0) {
        buckets[0].count++;
        buckets[0].total += outstanding;
      } else if (daysOverdue <= 30) {
        buckets[1].count++;
        buckets[1].total += outstanding;
      } else if (daysOverdue <= 60) {
        buckets[2].count++;
        buckets[2].total += outstanding;
      } else if (daysOverdue <= 90) {
        buckets[3].count++;
        buckets[3].total += outstanding;
      } else {
        buckets[4].count++;
        buckets[4].total += outstanding;
      }
    });
  }

  const totalOutstanding = buckets.reduce((sum, bucket) => sum + bucket.total, 0);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-primary" />
          Invoice Aging Report
        </CardTitle>
        <CardDescription>Outstanding invoices by age</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Summary */}
          <div className="p-4 rounded-lg bg-muted/30 border">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-muted-foreground">Total Outstanding</div>
                <div className="text-2xl font-bold">{formatCurrency(totalOutstanding)}</div>
              </div>
              <TrendingUp className="h-8 w-8 text-muted-foreground" />
            </div>
          </div>

          {/* Buckets */}
          <div className="space-y-2">
            {buckets.map((bucket) => {
              const percentage = totalOutstanding > 0 ? (bucket.total / totalOutstanding) * 100 : 0;
              const isOld = bucket.days.includes("90+") || bucket.days.includes("61-90");

              return (
                <div
                  key={bucket.label}
                  className="p-3 rounded-lg border hover:shadow-sm transition-shadow"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{bucket.label}</span>
                      {isOld && bucket.count > 0 && (
                        <Badge variant="outline" className="text-orange-600 border-orange-600">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Action needed
                        </Badge>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">{bucket.count} invoices</div>
                  </div>
                  <div className="flex items-center justify-between mb-1">
                    <div className="text-lg font-semibold">{formatCurrency(bucket.total)}</div>
                    <div className="text-sm text-muted-foreground">{percentage.toFixed(1)}%</div>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all bg-${bucket.color}-500`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {totalOutstanding === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No outstanding invoices</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
