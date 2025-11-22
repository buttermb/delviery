import { useParams } from "react-router-dom";
import { usePublicInvoice } from "@/hooks/crm/usePublicInvoice";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Printer, Download } from "lucide-react";
import { formatCurrency } from "@/utils/formatters";
import { format } from "date-fns";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

export default function InvoicePublicPage() {
    const { token } = useParams<{ token: string }>();
    const { data: invoice, isLoading, error } = usePublicInvoice(token);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-50">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (error || !invoice) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4">
                <h1 className="text-2xl font-bold text-gray-900 mb-2">Invoice Not Found</h1>
                <p className="text-gray-500">The invoice you are looking for does not exist or the link is invalid.</p>
            </div>
        );
    }

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl mx-auto space-y-6">
                {/* Actions Bar */}
                <div className="flex justify-end gap-4 print:hidden">
                    <Button variant="outline" onClick={handlePrint}>
                        <Printer className="mr-2 h-4 w-4" />
                        Print
                    </Button>
                    <Button>
                        <Download className="mr-2 h-4 w-4" />
                        Download PDF
                    </Button>
                </div>

                {/* Invoice Card */}
                <Card className="overflow-hidden print:shadow-none print:border-none">
                    <CardHeader className="border-b bg-white p-8">
                        <div className="flex justify-between items-start">
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900">INVOICE</h1>
                                <p className="text-gray-500 mt-1">#{invoice.invoice_number}</p>
                            </div>
                            <div className="text-right">
                                <h2 className="text-lg font-semibold text-gray-900">FloraIQ</h2>
                                <p className="text-sm text-gray-500">123 Business Rd</p>
                                <p className="text-sm text-gray-500">City, State 12345</p>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-8 bg-white">
                        {/* Bill To & Details */}
                        <div className="grid grid-cols-2 gap-8 mb-8">
                            <div>
                                <h3 className="text-sm font-medium text-gray-500 mb-2">Bill To</h3>
                                <p className="font-semibold text-gray-900">{invoice.client?.name}</p>
                                {invoice.client?.email && <p className="text-sm text-gray-600">{invoice.client.email}</p>}
                                {invoice.client?.phone && <p className="text-sm text-gray-600">{invoice.client.phone}</p>}
                            </div>
                            <div className="text-right space-y-2">
                                <div className="flex justify-between">
                                    <span className="text-sm text-gray-500">Issue Date:</span>
                                    <span className="text-sm font-medium text-gray-900">
                                        {format(new Date(invoice.invoice_date), "MMM d, yyyy")}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-sm text-gray-500">Due Date:</span>
                                    <span className="text-sm font-medium text-gray-900">
                                        {format(new Date(invoice.due_date), "MMM d, yyyy")}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center pt-2">
                                    <span className="text-sm text-gray-500">Status:</span>
                                    <Badge variant={invoice.status === 'paid' ? 'default' : 'secondary'}>
                                        {invoice.status.toUpperCase()}
                                    </Badge>
                                </div>
                            </div>
                        </div>

                        {/* Line Items */}
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="pl-0">Description</TableHead>
                                    <TableHead className="text-right">Qty</TableHead>
                                    <TableHead className="text-right">Price</TableHead>
                                    <TableHead className="text-right pr-0">Amount</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {invoice.line_items.map((item: any, index: number) => (
                                    <TableRow key={index}>
                                        <TableCell className="pl-0 font-medium">
                                            {item.description}
                                        </TableCell>
                                        <TableCell className="text-right">{item.quantity}</TableCell>
                                        <TableCell className="text-right">{formatCurrency(item.unit_price)}</TableCell>
                                        <TableCell className="text-right pr-0">{formatCurrency(item.total)}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>

                        {/* Totals */}
                        <div className="mt-8 flex flex-col items-end gap-2">
                            <div className="flex justify-between w-64 text-sm">
                                <span className="text-gray-500">Subtotal:</span>
                                <span className="font-medium">{formatCurrency(invoice.subtotal)}</span>
                            </div>
                            {invoice.tax_amount > 0 && (
                                <div className="flex justify-between w-64 text-sm">
                                    <span className="text-gray-500">Tax ({invoice.tax_rate}%):</span>
                                    <span className="font-medium">{formatCurrency(invoice.tax_amount)}</span>
                                </div>
                            )}
                            <div className="flex justify-between w-64 pt-4 border-t mt-2">
                                <span className="text-lg font-bold text-gray-900">Total:</span>
                                <span className="text-lg font-bold text-gray-900">{formatCurrency(invoice.total)}</span>
                            </div>
                        </div>

                        {/* Notes */}
                        {invoice.notes && (
                            <div className="mt-8 pt-8 border-t">
                                <h3 className="text-sm font-medium text-gray-500 mb-2">Notes</h3>
                                <p className="text-sm text-gray-600 whitespace-pre-wrap">{invoice.notes}</p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <div className="text-center text-sm text-gray-500 print:hidden">
                    &copy; {new Date().getFullYear()} FloraIQ. All rights reserved.
                </div>
            </div>
        </div>
    );
}
