import { useParams, useNavigate } from "react-router-dom";
import { useInvoices } from "@/hooks/crm/useInvoices";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    ArrowLeft,
    Download,
    ExternalLink,
    CheckCircle,
    Send,
    Printer,
    Edit,
    Trash2
} from "lucide-react";
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
    const navigate = useNavigate();
    const { useInvoiceQuery, useMarkInvoicePaid, useDeleteInvoice } = useInvoices();

    const { data: invoice, isLoading } = useInvoiceQuery(invoiceId || '');
    const markAsPaid = useMarkInvoicePaid();
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
        });
    };

    const handleDelete = () => {
        deleteInvoice.mutate(invoice.id, {
            onSuccess: () => {
                toast.success("Invoice deleted");
                navigate("/admin/crm/invoices");
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
        <SwipeBackWrapper onBack={() => navigate("/admin/crm/invoices")}>
            <div className="space-y-6 p-6 pb-16 max-w-5xl mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => navigate("/admin/crm/invoices")}>
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

                    {invoice.status !== "paid" && (
                        <Button onClick={handleMarkAsPaid} className="bg-green-600 hover:bg-green-700">
                            <CheckCircle className="mr-2 h-4 w-4" />
                            Mark Paid
                        </Button>
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

            <div className="grid gap-6 md:grid-cols-3">
                {/* Main Content */}
                <div className="md:col-span-2 space-y-6">
                    {/* Invoice Document */}
                    <Card className="overflow-hidden">
                        <CardHeader className="bg-muted/30 border-b pb-8">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h2 className="text-lg font-semibold">Bill To:</h2>
                                    <div className="mt-2 text-sm">
                                        <p className="font-medium text-foreground">{invoice.client?.name}</p>
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
                        <CardContent className="p-0">
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
                                <div className="p-6 bg-muted/10 border-t">
                                    <h3 className="font-semibold text-sm mb-2">Notes:</h3>
                                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                                        {invoice.notes}
                                    </p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Sidebar */}
                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-sm font-medium">Client Details</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                <div>
                                    <span className="text-xs text-muted-foreground">Client Name</span>
                                    <p className="font-medium">{invoice.client?.name}</p>
                                </div>
                                <Button
                                    variant="outline"
                                    className="w-full"
                                    onClick={() => navigate(`/admin/crm/clients/${invoice.client_id}`)}
                                >
                                    View Client Profile
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

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
