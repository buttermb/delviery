import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils/formatCurrency";
import { differenceInDays } from "date-fns";
import { FileText, Download } from "lucide-react";
import { toast } from "sonner";

interface AgingBucket {
  label: string;
  range: string;
  count: number;
  total: number;
  color: string;
}

interface InvoiceAgingReportProps {
  invoices: Array<{
    id: string;
    invoice_number: string;
    total_amount: number;
    paid_amount: number;
    due_date: string;
    status: string;
  }>;
}

/**
 * Task 305: Create invoice aging report
 * Report showing invoices by age: current, 1-30, 31-60, 61-90, 90+ days
 */
export function InvoiceAgingReport({ invoices }: InvoiceAgingReportProps) {
  const calculateAgingBuckets = (): AgingBucket[] => {
    const buckets: AgingBucket[] = [
      { label: "Current", range: "0 days", count: 0, total: 0, color: "text-emerald-600" },
      { label: "1-30 Days", range: "1-30 days", count: 0, total: 0, color: "text-blue-600" },
      { label: "31-60 Days", range: "31-60 days", count: 0, total: 0, color: "text-yellow-600" },
      { label: "61-90 Days", range: "61-90 days", count: 0, total: 0, color: "text-orange-600" },
      { label: "90+ Days", range: "Over 90 days", count: 0, total: 0, color: "text-red-600" },
    ];

    invoices.forEach((invoice) => {
      const outstanding = invoice.total_amount - invoice.paid_amount;
      if (outstanding <= 0) return;

      const daysOverdue = differenceInDays(new Date(), new Date(invoice.due_date));

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

    return buckets;
  };

  const buckets = calculateAgingBuckets();
  const grandTotal = buckets.reduce((sum, bucket) => sum + bucket.total, 0);

  const handleExport = () => {
    toast.success("Exporting aging report...");
    // TODO: Export to CSV/Excel
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-emerald-600" />
          Invoice Aging Report
        </CardTitle>
        <Button onClick={handleExport} size="sm" variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Export
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {buckets.map((bucket, index) => (
              <div key={index} className="text-center p-4 border rounded-lg">
                <div className="text-xs text-muted-foreground">{bucket.label}</div>
                <div className={`text-2xl font-bold ${bucket.color}`}>
                  {bucket.count}
                </div>
                <div className="text-sm font-semibold mt-1">
                  {formatCurrency(bucket.total)}
                </div>
                <div className="text-xs text-muted-foreground mt-1">{bucket.range}</div>
              </div>
            ))}
          </div>

          {/* Grand Total */}
          <div className="p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="font-semibold">Total Outstanding</span>
              <span className="text-2xl font-bold">{formatCurrency(grandTotal)}</span>
            </div>
          </div>

          {/* Warning Badge for High Overdue */}
          {buckets[3].total + buckets[4].total > 0 && (
            <Badge variant="destructive" className="w-full justify-center">
              {formatCurrency(buckets[3].total + buckets[4].total)} overdue 60+ days
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
