import { useParams } from "react-router-dom";
import { useTenantNavigation } from "@/lib/navigation/tenantNavigation";
import { useTenant } from "@/contexts/TenantContext";
import { CustomerLink } from "@/components/admin/cross-links";
import { useInvoices } from "@/hooks/crm/useInvoices";
import { RelatedEntitiesPanel } from "@/components/admin/RelatedEntitiesPanel";
import { useRelatedInvoicePreOrders } from "@/hooks/useRelatedEntities";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    ArrowLeft,
    ExternalLink,
    CheckCircle,
    Send,
    Printer,
    Trash2,
    Copy,
    Ban,
    FileText
} from "lucide-react";
import { logger } from "@/lib/logger";
import { formatCurrency } from "@/utils/formatters";
import { format } from "date-fns";
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
import { SwipeBackWrapper } from "@/components/mobile/SwipeBackWrapper";

export default function InvoiceDetailPage() {
    const { invoiceId } = useParams<{ invoiceId: string }>();
    const { navigateToAdmin } = useTenantNavigation();
    const { tenant } = useTenant();
    const { useInvoiceQuery, useMarkInvoicePaid, useMarkInvoiceSent, useVoidInvoice, useDuplicateInvoice, useDeleteInvoice } = useInvoices();

    const { data: invoice, isLoading } = useInvoiceQuery(invoiceId || '');
    const relatedPreOrders = useRelatedInvoicePreOrders(invoice?.client_id, invoiceId);
    const markAsPaid = useMarkInvoicePaid();
    const markAsSent = useMarkInvoiceSent();
    const voidInvoiceMutation = useVoidInvoice();
    const duplicateInvoice = useDuplicateInvoice();
    const deleteInvoice = useDeleteInvoice();

    if (isLoading) {
        return <div className="p-8 text-center">Loading invoice details...</div>;
    }

    if (!invoice) {
        return <div className="p-8 text-center">Invoice not found</div>;
    }

    const handleMarkAsPaid = () => {
        markAsPaid.mutate(invoice.id, {
            onSuccess: () => {
                toast.success("Invoice marked as paid");
            },
            onError: (error: unknown) => {
                const message = error instanceof Error ? error.message : "Failed to update invoice";
                toast.error("Update failed", { description: message });
                logger.error('Failed to mark invoice as paid', error, { component: 'InvoiceDetailPage', invoiceId: invoice.id });
            },
        });
    };

    const handleMarkAsSent = () => {
        markAsSent.mutate(invoice.id, {
            onSuccess: () => {
                toast.success("Invoice marked as sent");
            },
            onError: (error: unknown) => {
                const message = error instanceof Error ? error.message : "Failed to update invoice";
                toast.error("Update failed", { description: message });
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
                const message = error instanceof Error ? error.message : "Failed to void invoice";
                toast.error("Void failed", { description: message });
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
                const message = error instanceof Error ? error.message : "Failed to duplicate invoice";
                toast.error("Duplicate failed", { description: message });
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

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "paid":
                return <Badge className="bg-green-500 hover:bg-green-600">Paid</Badge>;
            case "overdue":
                return <Badge variant="destructive">Overdue</Badge>;
            case "sent":
                return <Badge className="bg-blue-500 hover:bg-blue-600">Sent</Badge>;
            case "draft":
                return <Badge variant="secondary">Draft</Badge>;
            case "cancelled":
                return <Badge variant="outline" className="text-muted-foreground">Cancelled</Badge>;
            default:
                return <Badge variant="outline">{status}</Badge>;
        }
    };

    return (
        <SwipeBackWrapper onBack={() => navigateToAdmin("crm/invoices")}>
            <div className="space-y-6 p-6 pb-16 max-w-5xl mx-auto print:p-0 print:max-w-none print:space-y-0">
                {/* Header — hidden on print */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="icon" onClick={() => navigateToAdmin("crm/invoices")}>
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                        <div>
                            <div className="flex items-center gap-3">
                                <h1 className="text-2xl font-bold tracking-tight">
                                    Invoice #{invoice.invoice_number}
                                </h1>
                                {getStatusBadge(invoice.status)}
                            </div>
                            <p className="text-muted-foreground">
                                Created on {format(new Date(invoice.created_at), "PPP")}
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <Button variant="outline" onClick={copyPublicLink}>
                            <ExternalLink className="mr-2 h-4 w-4" />
                            Share Link
                        </Button>
                        <Button variant="outline" onClick={() => window.print()}>
                            <Printer className="mr-2 h-4 w-4" />
                            Print
                        </Button>
                        <Button
                            variant="outline"
                            onClick={handleDuplicateInvoice}
                            disabled={duplicateInvoice.isPending}
                        >
                            <Copy className="mr-2 h-4 w-4" />
                            Duplicate
                        </Button>

                        {invoice.status === "draft" && (
                            <Button
                                variant="outline"
                                onClick={handleMarkAsSent}
                                disabled={markAsSent.isPending}
                                className="border-blue-500 text-blue-600 hover:bg-blue-50"
                            >
                                <Send className="mr-2 h-4 w-4" />
                                Mark as Sent
                            </Button>
                        )}

                        {invoice.status !== "paid" && invoice.status !== "cancelled" && (
                            <Button
                                onClick={handleMarkAsPaid}
                                disabled={markAsPaid.isPending}
                                className="bg-green-600 hover:bg-green-700"
                            >
                                <CheckCircle className="mr-2 h-4 w-4" />
                                Mark Paid
                            </Button>
                        )}

                        {invoice.status !== "paid" && invoice.status !== "cancelled" && (
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="outline" className="border-orange-500 text-orange-600 hover:bg-orange-50">
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
                                            className="bg-orange-600 text-white hover:bg-orange-700"
                                        >
                                            Void Invoice
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        )}

                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="destructive" size="icon">
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Delete Invoice?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        This action cannot be undone. This will permanently delete the invoice.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                        Delete
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </div>
                </div>

                <div className="grid gap-6 md:grid-cols-3 print:block">
                    {/* Main Content */}
                    <div className="md:col-span-2 space-y-6 print:space-y-0">
                        {/* Invoice Document */}
                        <Card className="overflow-hidden invoice-print-document print:border-none print:shadow-none">
                            <CardHeader className="bg-muted/30 border-b pb-8 print:bg-white print:border-b-2 print:border-b-gray-800 print:px-0">
                                <div className="flex justify-between items-start mb-6">
                                    <div>
                                        <h1 className="text-xl font-bold">{tenant?.business_name}</h1>
                                        <div className="text-sm text-muted-foreground mt-1 space-y-0.5">
                                            {tenant?.address && <p>{tenant.address}</p>}
                                            {tenant?.city && <p>{tenant.city}, {tenant.state} {tenant.zip_code}</p>}
                                            {tenant?.phone && <p>{tenant.phone}</p>}
                                            {tenant?.owner_email && <p>{tenant.owner_email}</p>}
                                            {tenant?.tax_id && <p>Tax ID: {tenant.tax_id}</p>}
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
                                            {invoice.client?.phone && <p>{invoice.client.phone}</p>}
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
                                </div>

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
                                        {tenant?.address && <p>{tenant.address}</p>}
                                        {tenant?.city && <p>{tenant.city}, {tenant.state} {tenant.zip_code}</p>}
                                        {tenant?.phone && <p>Phone: {tenant.phone}</p>}
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
        </SwipeBackWrapper>
    );
}
