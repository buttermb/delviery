import { Card } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils/formatCurrency";
import { CRMInvoice } from "@/types/crm";
import { startOfMonth, isAfter } from "date-fns";
import { DollarSign, Clock, CheckCircle, FileText } from "lucide-react";

interface InvoiceSummaryStatsProps {
    invoices: CRMInvoice[];
}

export function InvoiceSummaryStats({ invoices }: InvoiceSummaryStatsProps) {
    // Total Outstanding (unpaid balance on sent/partially_paid/overdue)
    const outstanding = invoices.reduce((sum, inv) => {
        if (["sent", "overdue", "partially_paid"].includes(inv.status)) {
            const balance = inv.total - (inv.amount_paid ?? 0);
            return sum + (balance > 0 ? balance : 0);
        }
        return sum;
    }, 0);

    // Overdue count and amount
    const overdueInvoices = invoices.filter(inv => inv.status === "overdue");
    const overdueAmount = overdueInvoices.reduce((sum, inv) => {
        const balance = inv.total - (inv.amount_paid ?? 0);
        return sum + (balance > 0 ? balance : 0);
    }, 0);

    // Paid This Month
    const monthStart = startOfMonth(new Date());
    const paidThisMonthInvoices = invoices.filter(
        inv => inv.status === "paid" && inv.paid_at && isAfter(new Date(inv.paid_at), monthStart)
    );
    const paidThisMonthAmount = paidThisMonthInvoices.reduce((sum, inv) => sum + inv.total, 0);

    // Draft count
    const draftCount = invoices.filter(inv => inv.status === "draft").length;

    return (
        <Card className="mb-6 border-border/50 shadow-sm overflow-hidden">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-border w-full">
                <div className="p-6 flex flex-col justify-center relative overflow-hidden">
                    <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-medium text-muted-foreground">Total Outstanding</p>
                        <DollarSign className="h-4 w-4 text-muted-foreground/50" />
                    </div>
                    <div className="text-3xl font-bold">{formatCurrency(outstanding)}</div>
                    <p className="text-xs text-muted-foreground mt-1">Unpaid & overdue</p>
                </div>

                <div className="p-6 flex flex-col justify-center relative overflow-hidden">
                    <div className="absolute inset-0 bg-red-500/[0.02] dark:bg-red-500/5 pointer-events-none" />
                    <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-medium text-muted-foreground">Overdue</p>
                        <Clock className="h-4 w-4 text-red-500/50" />
                    </div>
                    <div className="text-3xl font-bold text-red-600 dark:text-red-400">
                        {formatCurrency(overdueAmount)}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{overdueInvoices.length} invoices overdue</p>
                </div>

                <div className="p-6 flex flex-col justify-center relative overflow-hidden">
                    <div className="absolute inset-0 bg-emerald-500/[0.02] dark:bg-emerald-500/5 pointer-events-none" />
                    <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-medium text-muted-foreground">Paid This Month</p>
                        <CheckCircle className="h-4 w-4 text-emerald-500/50" />
                    </div>
                    <div className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(paidThisMonthAmount)}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{paidThisMonthInvoices.length} invoices paid</p>
                </div>

                <div className="p-6 flex flex-col justify-center relative overflow-hidden">
                    <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-medium text-muted-foreground">Drafts</p>
                        <FileText className="h-4 w-4 text-muted-foreground/50" />
                    </div>
                    <div className="text-3xl font-bold">{draftCount}</div>
                    <p className="text-xs text-muted-foreground mt-1">invoices in draft</p>
                </div>
            </div>
        </Card>
    );
}
