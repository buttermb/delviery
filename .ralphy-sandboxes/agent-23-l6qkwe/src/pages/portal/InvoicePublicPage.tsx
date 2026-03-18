import { useParams } from "react-router-dom";
import { usePublicInvoice } from "@/hooks/crm/usePublicInvoice";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Printer, Download, FileText, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { EnhancedLoadingState } from "@/components/EnhancedLoadingState";
import { formatCurrency } from "@/lib/utils/formatCurrency";
import { format } from "date-fns";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";

export default function InvoicePublicPage() {
    const { token } = useParams<{ token: string }>();
    const { data: invoice, isLoading, error } = usePublicInvoice(token);

    if (isLoading) {
        return <EnhancedLoadingState variant="card" message="Loading invoice..." />;
    }

    if (error || !invoice) {
        return (
            <div className="flex flex-col items-center justify-center min-h-dvh bg-gradient-to-br from-slate-50 to-slate-100 p-4">
                <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md text-center">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <AlertCircle className="h-8 w-8 text-red-500" />
                    </div>
                    <h1 className="text-2xl font-bold text-slate-900 mb-2">Invoice Not Found</h1>
                    <p className="text-slate-500">The invoice you are looking for does not exist or the link has expired.</p>
                </div>
            </div>
        );
    }

    const handlePrint = () => {
        window.print();
    };

    const getStatusConfig = (status: string) => {
        switch (status) {
            case "paid":
                return { icon: CheckCircle2, color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300", label: "Paid" };
            case "overdue":
                return { icon: AlertCircle, color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300", label: "Overdue" };
            case "sent":
                return { icon: Clock, color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300", label: "Awaiting Payment" };
            case "partially_paid":
                return { icon: Clock, color: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300", label: "Partially Paid" };
            case "draft":
                return { icon: FileText, color: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300", label: "Draft" };
            case "cancelled":
            case "void":
                return { icon: FileText, color: "bg-gray-900 text-white dark:bg-gray-100/10 dark:text-gray-300", label: status === "void" ? "Void" : "Cancelled" };
            default:
                return { icon: FileText, color: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300", label: status };
        }
    };

    const statusConfig = getStatusConfig(invoice.status);
    const StatusIcon = statusConfig.icon;
    const isOverdue = invoice.status === "overdue" || (invoice.status !== "paid" && new Date(invoice.due_date) < new Date());

    return (
        <div className="min-h-dvh bg-gradient-to-br from-slate-50 via-white to-slate-100 py-8 px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto space-y-6">
                {/* Header Actions */}
                <div className="flex justify-between items-center print:hidden">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                            <FileText className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <h1 className="text-lg font-semibold text-slate-900">Invoice #{invoice.invoice_number}</h1>
                            <p className="text-sm text-slate-500">Created {format(new Date(invoice.created_at), "MMM d, yyyy")}</p>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <Button variant="outline" onClick={handlePrint} className="gap-2">
                            <Printer className="h-4 w-4" />
                            Print
                        </Button>
                        <Button className="gap-2">
                            <Download className="h-4 w-4" />
                            Download PDF
                        </Button>
                    </div>
                </div>

                {/* Status Banner */}
                {isOverdue && invoice.status !== "paid" && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3 print:hidden">
                        <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
                        <div>
                            <p className="font-medium text-red-700">This invoice is overdue</p>
                            <p className="text-sm text-red-600">Payment was due on {format(new Date(invoice.due_date), "MMMM d, yyyy")}</p>
                        </div>
                    </div>
                )}

                {invoice.status === "paid" && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3 print:hidden">
                        <CheckCircle2 className="h-5 w-5 text-emerald-500 flex-shrink-0" />
                        <div>
                            <p className="font-medium text-emerald-700">Payment Received</p>
                            <p className="text-sm text-emerald-600">Thank you for your payment!</p>
                        </div>
                    </div>
                )}

                {/* Main Invoice Card */}
                <Card className="overflow-hidden shadow-xl border-0 print:shadow-none">
                    <CardHeader data-dark-panel className="bg-gradient-to-r from-slate-800 to-slate-900 text-white p-8">
                        <div className="flex justify-between items-start">
                            <div>
                                <h2 className="text-3xl font-bold tracking-tight">INVOICE</h2>
                                <p className="text-slate-300 mt-1 font-mono">#{invoice.invoice_number}</p>
                            </div>
                            <div className={`px-4 py-2 rounded-full flex items-center gap-2 ${statusConfig.color}`}>
                                <StatusIcon className="h-4 w-4" />
                                <span className="font-medium text-sm">{statusConfig.label}</span>
                            </div>
                        </div>
                    </CardHeader>

                    <CardContent className="p-8 bg-white">
                        {/* Bill To & Details Grid */}
                        <div className="grid md:grid-cols-2 gap-8 mb-8">
                            <div className="space-y-1">
                                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Bill To</h3>
                                <p className="text-lg font-semibold text-slate-900">{invoice.client?.name}</p>
                                {invoice.client?.email && (
                                    <p className="text-slate-600">{invoice.client.email}</p>
                                )}
                                {invoice.client?.phone && (
                                    <p className="text-slate-600">{invoice.client.phone}</p>
                                )}
                            </div>
                            <div className="space-y-3 md:text-right">
                                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Invoice Details</h3>
                                <div className="space-y-2">
                                    <div className="flex md:justify-end gap-4">
                                        <span className="text-slate-500">Issue Date:</span>
                                        <span className="font-medium text-slate-900">{format(new Date(invoice.invoice_date), "MMM d, yyyy")}</span>
                                    </div>
                                    <div className="flex md:justify-end gap-4">
                                        <span className="text-slate-500">Due Date:</span>
                                        <span className={`font-medium ${isOverdue && invoice.status !== "paid" ? "text-red-600" : "text-slate-900"}`}>
                                            {format(new Date(invoice.due_date), "MMM d, yyyy")}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <Separator className="my-6" />

                        {/* Line Items */}
                        <div className="rounded-xl border overflow-hidden">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-slate-50">
                                        <TableHead className="pl-6 font-semibold text-slate-700">Description</TableHead>
                                        <TableHead className="text-right font-semibold text-slate-700">Qty</TableHead>
                                        <TableHead className="text-right font-semibold text-slate-700">Price</TableHead>
                                        <TableHead className="text-right pr-6 font-semibold text-slate-700">Amount</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {invoice.line_items.map((item: { description?: string; product_name?: string; quantity: number; unit_price: number; total?: number; line_total?: number }, index: number) => (
                                        <TableRow key={index} className="border-slate-100">
                                            <TableCell className="pl-6 font-medium text-slate-900">
                                                {item.description || item.product_name}
                                            </TableCell>
                                            <TableCell className="text-right text-slate-600">{item.quantity}</TableCell>
                                            <TableCell className="text-right text-slate-600">{formatCurrency(item.unit_price)}</TableCell>
                                            <TableCell className="text-right pr-6 font-medium text-slate-900">
                                                {formatCurrency(item.line_total ?? item.total)}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>

                        {/* Totals */}
                        <div className="mt-8 flex flex-col items-end">
                            <div className="w-full max-w-xs space-y-3">
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">Subtotal</span>
                                    <span className="font-medium text-slate-700">{formatCurrency(invoice.subtotal)}</span>
                                </div>
                                {invoice.tax_amount > 0 && (
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-500">Tax ({invoice.tax_rate}%)</span>
                                        <span className="font-medium text-slate-700">{formatCurrency(invoice.tax_amount)}</span>
                                    </div>
                                )}
                                <Separator />
                                <div className="flex justify-between pt-2">
                                    <span className="text-lg font-bold text-slate-900">Total</span>
                                    <span className="text-2xl font-bold text-primary">{formatCurrency(invoice.total)}</span>
                                </div>
                                {(invoice.amount_paid ?? 0) > 0 && (
                                    <>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-emerald-600">Amount Paid</span>
                                            <span className="font-medium text-emerald-600">{formatCurrency(invoice.amount_paid ?? 0)}</span>
                                        </div>
                                        <Separator />
                                        <div className="flex justify-between pt-1">
                                            <span className="text-base font-bold text-slate-900">Amount Due</span>
                                            <span className={`text-xl font-bold ${Math.max(0, invoice.total - (invoice.amount_paid ?? 0)) > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                                                {formatCurrency(Math.max(0, invoice.total - (invoice.amount_paid ?? 0)))}
                                            </span>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Notes */}
                        {invoice.notes && (
                            <div className="mt-8 p-4 bg-slate-50 rounded-xl">
                                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Notes</h3>
                                <p className="text-sm text-slate-600 whitespace-pre-wrap">{invoice.notes}</p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Footer */}
                <div className="text-center text-sm text-slate-400 print:hidden">
                    <p>Questions about this invoice? Contact the sender directly.</p>
                </div>
            </div>
        </div>
    );
}
