import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Outstanding</CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(outstanding)}</div>
                    <p className="text-xs text-muted-foreground">Unpaid & overdue</p>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Overdue</CardTitle>
                    <Clock className="h-4 w-4 text-red-500" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                        {formatCurrency(overdueAmount)}
                    </div>
                    <p className="text-xs text-muted-foreground">{overdueInvoices.length} invoices overdue</p>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Paid This Month</CardTitle>
                    <CheckCircle className="h-4 w-4 text-emerald-500" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(paidThisMonthAmount)}
                    </div>
                    <p className="text-xs text-muted-foreground">{paidThisMonthInvoices.length} invoices paid</p>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Drafts</CardTitle>
                    <FileText className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{draftCount}</div>
                    <p className="text-xs text-muted-foreground">invoices in draft</p>
                </CardContent>
            </Card>
        </div>
    );
}
