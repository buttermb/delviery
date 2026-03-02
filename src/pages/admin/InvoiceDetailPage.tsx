import { useState } from "react";
import { useParams } from "react-router-dom";
import { EnhancedLoadingState } from "@/components/EnhancedLoadingState";
import { useTenantNavigation } from "@/lib/navigation/tenantNavigation";
import { useTenant } from "@/contexts/TenantContext";
import { CustomerLink } from "@/components/admin/cross-links";
import { useInvoices } from "@/hooks/crm/useInvoices";
import { InvoicePaymentDialog } from "@/components/admin/invoices/InvoicePaymentDialog";
import { RelatedEntitiesPanel } from "@/components/admin/RelatedEntitiesPanel";
import { useRelatedInvoicePreOrders } from "@/hooks/useRelatedEntities";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    ArrowLeft,
    ExternalLink,
    Send,
    Printer,
    Trash2,
    Copy,
    Ban,
    FileText,
    DollarSign,
    Loader2
} from "lucide-react";
import { logger } from "@/lib/logger";
import { formatCurrency } from "@/lib/utils/formatCurrency";
import { formatPhoneNumber } from "@/lib/formatters";
import { format, parseISO, differenceInCalendarDays } from "date-fns";
import { toast } from "sonner";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ConfirmDeleteDialog } from '@/components/shared/ConfirmDeleteDialog';
import { SwipeBackWrapper } from "@/components/mobile/SwipeBackWrapper";
import { useBreadcrumbLabel } from "@/contexts/BreadcrumbContext";
import { formatPaymentMethod } from "@/lib/constants/paymentMethods";
import { humanizeError } from '@/lib/humanizeError';

interface PaymentHistoryEntry {
    amount: number;
    method: string;
    date: string;
    reference: string | null;
    notes: string | null;
    recorded_at: string;
}

function isPaymentHistoryEntry(entry: unknown): entry is PaymentHistoryEntry {
    if (typeof entry !== 'object' || entry === null) return false;
    const obj = entry as Record<string, unknown>;
    return typeof obj.amount === 'number' && typeof obj.method === 'string' && typeof obj.date === 'string';
}

export default function InvoiceDetailPage() {
    const { invoiceId } = useParams<{ invoiceId: string }>();
    const { navigateToAdmin } = useTenantNavigation();
    const { tenant } = useTenant();
    const { useInvoiceQuery, useMarkInvoiceSent, useVoidInvoice, useDuplicateInvoice, useDeleteInvoice } = useInvoices();

    const { data: invoice, isLoading, error } = useInvoiceQuery(invoiceId ?? '');
    const relatedPreOrders = useRelatedInvoicePreOrders(invoice?.client_id, invoiceId);
    const markAsSent = useMarkInvoiceSent();
    const voidInvoiceMutation = useVoidInvoice();
    const duplicateInvoice = useDuplicateInvoice();
    const deleteInvoice = useDeleteInvoice();
    const [showPaymentDialog, setShowPaymentDialog] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

    // Set breadcrumb label to show invoice number
    useBreadcrumbLabel(invoice ? `Invoice #${invoice.invoice_number}` : null);

    if (isLoading) {
        return <EnhancedLoadingState variant="card" message="Loading invoice details..." />;
    }

    if (error || !invoice) {
        return (
            <div className="space-y-4 p-4 max-w-5xl mx-auto">
                <Card>
                    <CardContent className="py-16 text-center">
                        <FileText className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                        <h2 className="text-xl font-semibold mb-2">Invoice Not Found</h2>
                        <p className="text-muted-foreground mb-6">
                            The invoice you're looking for doesn't exist or has been removed.
                        </p>
                        <Button variant="outline" onClick={() => navigateToAdmin("crm/invoices")}>
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            Back to Invoices
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const handleMarkAsSent = () => {
        markAsSent.mutate(invoice.id, {
            onSuccess: () => {
                toast.success("Invoice marked as sent");
            },
            onError: (error: unknown) => {
                toast.error("Update failed", { description: humanizeError(error) });
                logger.error('Failed to mark invoice as sent', error, { component: 'InvoiceDetailPage', invoiceId: invoice.id });
            },
        });
    };

    const handleVoidInvoice = () => {
        voidInvoiceMutation.mutate(invoice.id, {
            onSuccess: () => {
                toast.success("Invoice voided");
            },
            onError: (error: unknown) => {
                toast.error("Void failed", { description: humanizeError(error) });
                logger.error('Failed to void invoice', error, { component: 'InvoiceDetailPage', invoiceId: invoice.id });
            },
        });
    };

    const handleDuplicateInvoice = () => {
        duplicateInvoice.mutate(invoice.id, {
            onSuccess: (newInvoice) => {
                toast.success("Invoice duplicated");
                navigateToAdmin(`crm/invoices/${newInvoice.id}`);
            },
            onError: (error: unknown) => {
                toast.error("Duplicate failed", { description: humanizeError(error) });
                logger.error('Failed to duplicate invoice', error, { component: 'InvoiceDetailPage', invoiceId: invoice.id });
            },
        });
    };

    const handleDelete = () => {
        deleteInvoice.mutate(invoice.id, {
            onSuccess: () => {
                toast.success("Invoice deleted");
                navigateToAdmin("crm/invoices");
            },
        });
    };

    const copyPublicLink = () => {
        const link = `${window.location.origin}/portal/invoice/${invoice.public_token}`;
        navigator.clipboard.writeText(link);
        toast.success("Public link copied to clipboard");
    };

    const isAnyPending = markAsSent.isPending || voidInvoiceMutation.isPending || duplicateInvoice.isPending || deleteInvoice.isPending;
    const isVoided = invoice.status === 'cancelled';
    const isOverdue = invoice.due_date
        && new Date(invoice.due_date) < new Date()
        && ['sent', 'partially_paid'].includes(invoice.status);
    const daysOverdue = isOverdue && invoice.due_date
        ? differenceInCalendarDays(new Date(), new Date(invoice.due_date))
        : 0;

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "paid":
                return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700">Paid</Badge>;
            case "overdue":
                return <Badge variant="destructive">Overdue</Badge>;
            case "sent":
                return <Badge className="bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700">Sent</Badge>;
            case "draft":
                return <Badge className="bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-900/30 dark:text-gray-300 dark:border-gray-700">Draft</Badge>;
            case "partially_paid":
                return <Badge className="bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700">Partially Paid</Badge>;
            case "cancelled":
            case "void":
                return <Badge className="bg-gray-900 text-white border-gray-900 dark:bg-gray-100/10 dark:text-gray-300 dark:border-gray-600">{status === "void" ? "Void" : "Cancelled"}</Badge>;
            default:
                return <Badge variant="outline">{status}</Badge>;
        }
    };

    return (
        <SwipeBackWrapper onBack={() => navigateToAdmin("crm/invoices")}>
            <div className="space-y-4 p-4 pb-16 max-w-5xl mx-auto print:p-0 print:max-w-none print:space-y-0">
                {/* Header — hidden on print */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="icon" onClick={() => navigateToAdmin("crm/invoices")} aria-label="Back to invoices">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                        <div>
                            <div className="flex items-center gap-3">
                                <h1 className="text-2xl font-bold tracking-tight">
                                    Invoice #{invoice.invoice_number}
                                </h1>
                                {getStatusBadge(invoice.status)}
                                {isOverdue && (
                                    <Badge variant="destructive">
                                        Overdue {daysOverdue > 0 && `(${daysOverdue} day${daysOverdue === 1 ? '' : 's'})`}
                                    </Badge>
                                )}
                            </div>
                            <p className="text-muted-foreground">
                                Created on {format(new Date(invoice.created_at), "PPP")}
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <Button variant="outline" onClick={() => window.print()} disabled={isAnyPending}>
                            <Printer className="mr-2 h-4 w-4" />
                            Print
                        </Button>

                        {!isVoided && (
                            <>
                                <Button variant="outline" onClick={copyPublicLink} disabled={isAnyPending}>
                                    <ExternalLink className="mr-2 h-4 w-4" />
                                    Share Link
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={handleDuplicateInvoice}
                                    disabled={isAnyPending}
                                >
                                    <Copy className="mr-2 h-4 w-4" />
                                    Duplicate
                                </Button>

                                {invoice.status === "draft" && (
                                    <Button
                                        variant="outline"
                                        onClick={handleMarkAsSent}
                                        disabled={isAnyPending}
                                        className="border-blue-500 text-blue-600 hover:bg-blue-50"
                                    >
                                        <Send className="mr-2 h-4 w-4" />
                                        Mark as Sent
                                    </Button>
                                )}

                                {(invoice.status === "sent" || invoice.status === "partially_paid") && (
                                    <Button
                                        onClick={() => setShowPaymentDialog(true)}
                                        disabled={isAnyPending}
                                        className="bg-green-600 hover:bg-green-700"
                                    >
                                        <DollarSign className="mr-2 h-4 w-4" />
                                        Record Payment
                                        {invoice.amount_paid ? ` (${formatCurrency(invoice.total - (invoice.amount_paid ?? 0))} remaining)` : ''}
                                    </Button>
                                )}

                                {invoice.status !== "paid" && (
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <Button variant="outline" disabled={isAnyPending} className="border-orange-500 text-orange-600 hover:bg-orange-50">
                                                <Ban className="mr-2 h-4 w-4" />
                                                Void
                                            </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>Void Invoice?</AlertDialogTitle>
                                                <AlertDialogDescription>
                                                    This will mark the invoice as cancelled. This action cannot be undone.
                                                </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                <AlertDialogAction
                                                    onClick={handleVoidInvoice}
                                                    disabled={voidInvoiceMutation.isPending}
                                                    className="bg-orange-600 text-white hover:bg-orange-700"
                                                >
                                                    {voidInvoiceMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                                    Void Invoice
                                                </AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                )}
                            </>
                        )}

                        <Button variant="destructive" size="icon" disabled={isAnyPending} onClick={() => setDeleteDialogOpen(true)} aria-label="Delete invoice">
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                <div className="grid gap-6 md:grid-cols-3 print:block">
                    {/* Main Content */}
                    <div className="md:col-span-2 space-y-6 print:space-y-0">
                        {/* Invoice Document */}
                        <Card className="overflow-hidden invoice-print-document print:border-none print:shadow-none relative">
                            {invoice.status === 'cancelled' && (
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-10">
                                    <span className="text-8xl font-bold text-red-500/20 -rotate-45">
                                        VOID
                                    </span>
                                </div>
                            )}
                            <CardHeader className="bg-muted/30 border-b pb-8 print:bg-white print:border-b-2 print:border-b-gray-800 print:px-0">
                                <div className="flex justify-between items-start mb-6">
                                    <div>
                                        <h1 className="text-xl font-bold">{tenant?.business_name}</h1>
                                        <div className="text-sm text-muted-foreground mt-1 space-y-0.5">
                                            {tenant?.state && <p>{tenant.state}</p>}
                                            {tenant?.phone && <p>{formatPhoneNumber(tenant.phone)}</p>}
                                            {tenant?.owner_email && <p>{tenant.owner_email}</p>}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <h2 className="text-2xl font-bold">INVOICE</h2>
                                        <p className="font-mono text-muted-foreground">#{invoice.invoice_number}</p>
                                    </div>
                                </div>

                                <div className="flex justify-between items-start">
                                    <div>
                                        <h2 className="text-lg font-semibold">Bill To:</h2>
                                        <div className="mt-2 text-sm">
                                            <p className="font-medium text-foreground">
                                                <CustomerLink
                                                    customerId={invoice.client_id}
                                                    customerName={invoice.client?.name || "Unknown Client"}
                                                />
                                            </p>
                                            {invoice.client?.email && <p>{invoice.client.email}</p>}
                                            {invoice.client?.phone && <p>{formatPhoneNumber(invoice.client.phone)}</p>}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <h2 className="text-lg font-semibold">Details:</h2>
                                        <div className="mt-2 text-sm space-y-1">
                                            <div className="flex justify-end gap-4">
                                                <span className="text-muted-foreground">Issue Date:</span>
                                                <span>{format(new Date(invoice.issue_date), "MMM d, yyyy")}</span>
                                            </div>
                                            <div className="flex justify-end gap-4">
                                                <span className="text-muted-foreground">Due Date:</span>
                                                <span>{format(new Date(invoice.due_date), "MMM d, yyyy")}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="p-0 print:px-0">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="pl-6">Item</TableHead>
                                            <TableHead className="text-right">Qty</TableHead>
                                            <TableHead className="text-right">Price</TableHead>
                                            <TableHead className="text-right pr-6">Total</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {invoice.line_items.map((item, index) => (
                                            <TableRow key={index}>
                                                <TableCell className="pl-6 font-medium">
                                                    {item.description}
                                                </TableCell>
                                                <TableCell className="text-right">{item.quantity}</TableCell>
                                                <TableCell className="text-right">{formatCurrency(item.unit_price)}</TableCell>
                                                <TableCell className="text-right pr-6">{formatCurrency(item.line_total)}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>

                                <div className="p-6 flex flex-col items-end gap-2 text-sm border-t">
                                    <div className="flex justify-between w-48">
                                        <span className="text-muted-foreground">Subtotal:</span>
                                        <span>{formatCurrency(invoice.subtotal)}</span>
                                    </div>
                                    <div className="flex justify-between w-48">
                                        <span className="text-muted-foreground">Tax:</span>
                                        <span>{formatCurrency(invoice.tax_amount)}</span>
                                    </div>
                                    <Separator className="my-2 w-48" />
                                    <div className="flex justify-between w-48 font-bold text-lg">
                                        <span>Total:</span>
                                        <span>{formatCurrency(invoice.total)}</span>
                                    </div>
                                    {(invoice.amount_paid ?? 0) > 0 && (
                                        <>
                                            <Separator className="my-2 w-48" />
                                            <div className="flex justify-between w-48 text-green-600">
                                                <span>Paid:</span>
                                                <span>{formatCurrency(invoice.amount_paid ?? 0)}</span>
                                            </div>
                                            <div className="flex justify-between w-48 font-bold">
                                                <span>Balance:</span>
                                                <span className={invoice.total - (invoice.amount_paid ?? 0) > 0 ? 'text-red-600' : 'text-green-600'}>
                                                    {formatCurrency(Math.max(0, invoice.total - (invoice.amount_paid ?? 0)))}
                                                </span>
                                            </div>
                                        </>
                                    )}
                                </div>

                                {/* Payment History */}
                                {(() => {
                                    const payments = Array.isArray(invoice.payment_history)
                                        ? invoice.payment_history.filter(isPaymentHistoryEntry)
                                        : [];
                                    if (payments.length === 0) return null;
                                    let runningBalance = invoice.total;
                                    return (
                                        <div className="p-6 border-t">
                                            <h3 className="font-semibold text-sm mb-3">Payments</h3>
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead className="pl-0">Date</TableHead>
                                                        <TableHead>Method</TableHead>
                                                        <TableHead>Reference</TableHead>
                                                        <TableHead className="text-right">Amount</TableHead>
                                                        <TableHead className="text-right pr-0">Balance</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {payments.map((payment, idx) => {
                                                        runningBalance -= payment.amount;
                                                        return (
                                                            <TableRow key={idx}>
                                                                <TableCell className="pl-0">
                                                                    {format(parseISO(payment.date), "MMM d, yyyy")}
                                                                </TableCell>
                                                                <TableCell>{formatPaymentMethod(payment.method)}</TableCell>
                                                                <TableCell className="text-muted-foreground">
                                                                    {payment.reference || '—'}
                                                                </TableCell>
                                                                <TableCell className="text-right text-green-600">
                                                                    {formatCurrency(payment.amount)}
                                                                </TableCell>
                                                                <TableCell className="text-right pr-0">
                                                                    {formatCurrency(Math.max(0, runningBalance))}
                                                                </TableCell>
                                                            </TableRow>
                                                        );
                                                    })}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    );
                                })()}

                                {invoice.notes && (
                                    <div className="p-6 bg-muted/10 border-t print:bg-white">
                                        <h3 className="font-semibold text-sm mb-2">Notes:</h3>
                                        <p className="text-sm text-muted-foreground whitespace-pre-wrap print:text-gray-700">
                                            {invoice.notes}
                                        </p>
                                    </div>
                                )}

                                {/* Print-only terms and footer */}
                                <div className="hidden print:block p-6 border-t mt-8">
                                    <h3 className="font-semibold text-sm mb-2">Terms & Conditions</h3>
                                    <p className="text-xs text-gray-600 mb-4">
                                        Payment is due within the terms stated above. Late payments may be subject to interest charges.
                                        Please include the invoice number with your payment.
                                    </p>
                                    <div className="border-t pt-4 mt-4 text-center text-xs text-gray-500">
                                        <p className="font-medium">{tenant?.business_name}</p>
                                        {tenant?.state && <p>{tenant.state}</p>}
                                        {tenant?.phone && <p>Phone: {formatPhoneNumber(tenant.phone)}</p>}
                                        {tenant?.owner_email && <p>Email: {tenant.owner_email}</p>}
                                        <p className="mt-2">Thank you for your business!</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Sidebar — hidden on print */}
                    <div className="space-y-6 print:hidden">
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-sm font-medium">Client Details</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    <div>
                                        <span className="text-xs text-muted-foreground">Client Name</span>
                                        <p className="font-medium">
                                            <CustomerLink
                                                customerId={invoice.client_id}
                                                customerName={invoice.client?.name || "Unknown Client"}
                                            />
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <RelatedEntitiesPanel
                            title="Related Items"
                            sections={[
                                {
                                    key: 'pre-orders',
                                    label: 'Pre-Orders',
                                    icon: FileText,
                                    items: relatedPreOrders.items,
                                    isLoading: relatedPreOrders.isLoading,
                                    error: relatedPreOrders.error,
                                    fetchItems: relatedPreOrders.fetchItems,
                                    onNavigate: (id) => navigateToAdmin(`crm/pre-orders/${id}`),
                                    emptyMessage: 'No pre-orders for this client',
                                },
                            ]}
                        />

                        <Card>
                            <CardHeader>
                                <CardTitle className="text-sm font-medium">Timeline</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    <div className="flex gap-3 text-sm">
                                        <div className="mt-0.5">
                                            <div className="h-2 w-2 rounded-full bg-blue-500" />
                                        </div>
                                        <div>
                                            <p className="font-medium">Invoice Created</p>
                                            <p className="text-xs text-muted-foreground">
                                                {format(new Date(invoice.created_at), "MMM d, yyyy h:mm a")}
                                            </p>
                                        </div>
                                    </div>
                                    {invoice.status === 'paid' && (
                                        <div className="flex gap-3 text-sm">
                                            <div className="mt-0.5">
                                                <div className="h-2 w-2 rounded-full bg-green-500" />
                                            </div>
                                            <div>
                                                <p className="font-medium">Payment Received</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {format(new Date(invoice.updated_at), "MMM d, yyyy h:mm a")}
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>

            <InvoicePaymentDialog
                invoiceId={invoice.id}
                amountDue={invoice.total}
                amountPaid={invoice.amount_paid ?? 0}
                open={showPaymentDialog}
                onOpenChange={setShowPaymentDialog}
            />

            <ConfirmDeleteDialog
                open={deleteDialogOpen}
                onOpenChange={setDeleteDialogOpen}
                onConfirm={() => {
                    handleDelete();
                    setDeleteDialogOpen(false);
                }}
                itemType="invoice"
                itemName={`#${invoice.invoice_number}`}
                isLoading={deleteInvoice.isPending}
            />
        </SwipeBackWrapper>
    );
}
