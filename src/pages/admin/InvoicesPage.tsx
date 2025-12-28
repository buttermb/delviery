import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { logger } from "@/lib/logger";
import jsPDF from "jspdf";
import { useInvoices } from "@/hooks/crm/useInvoices";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Plus,
    Search,
    MoreHorizontal,
    FileText,
    Filter,
    Download,
    ExternalLink,
    CheckCircle,
    AlertCircle,
    Clock,
    DollarSign
} from "lucide-react";
import { formatCurrency } from "@/utils/formatters";
import { format } from "date-fns";
import { toast } from "sonner";
import { CRMInvoice } from "@/types/crm";
import { EnhancedEmptyState } from "@/components/shared/EnhancedEmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { usePagination } from "@/hooks/usePagination";
import { StandardPagination } from "@/components/shared/StandardPagination";

export default function InvoicesPage() {
    const navigate = useNavigate();
    const { tenantSlug } = useParams<{ tenantSlug: string }>();
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState<string | null>(null);

    const { useInvoicesQuery, useMarkInvoicePaid } = useInvoices();
    const { data: invoices, isLoading } = useInvoicesQuery();
    const markAsPaid = useMarkInvoicePaid();

    const filteredInvoices = invoices?.filter((invoice) => {
        const matchesSearch =
            invoice.invoice_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (invoice.client?.name || "").toLowerCase().includes(searchQuery.toLowerCase());

        const matchesStatus = statusFilter ? invoice.status === statusFilter : true;

        return matchesSearch && matchesStatus;
    }) || [];

    // Pagination
    const {
        paginatedItems: paginatedInvoices,
        currentPage,
        pageSize,
        totalPages,
        totalItems,
        goToPage,
        changePageSize,
        pageSizeOptions,
    } = usePagination(filteredInvoices, {
        defaultPageSize: 20,
        persistInUrl: true,
        urlKey: 'invoices',
    });

    const handleMarkAsPaid = (id: string) => {
        markAsPaid.mutate(id, {
            onSuccess: () => {
                toast.success("Invoice marked as paid");
            },
            onError: (error: unknown) => {
                const message = error instanceof Error ? error.message : "Failed to update invoice";
                toast.error("Update failed", { description: message });
                logger.error('Failed to mark invoice as paid', error, { component: 'InvoicesPage', invoiceId: id });
            },
        });
    };

    const handleDownloadPDF = (invoice: CRMInvoice) => {
        try {
            const doc = new jsPDF();

            // Header
            doc.setFontSize(20);
            doc.text("INVOICE", 105, 20, { align: "center" });

            // Invoice Details
            doc.setFontSize(12);
            doc.text(`Invoice #: ${invoice.invoice_number}`, 20, 40);
            doc.text(`Date: ${format(new Date(invoice.invoice_date), "MMM d, yyyy")}`, 20, 50);
            doc.text(`Due Date: ${format(new Date(invoice.due_date), "MMM d, yyyy")}`, 20, 60);
            doc.text(`Status: ${invoice.status.toUpperCase()}`, 20, 70);

            // Client Details
            doc.text(`Client: ${invoice.client?.name || "Unknown"}`, 20, 90);

            // Amount
            doc.setFontSize(16);
            doc.text(`Total Amount: ${formatCurrency(invoice.total)}`, 20, 110);

            // Footer
            doc.setFontSize(10);
            doc.text("Thank you for your business!", 105, 280, { align: "center" });

            doc.save(`Invoice_${invoice.invoice_number}.pdf`);
            toast.success("PDF downloaded successfully");
        } catch (error) {
            logger.error("PDF generation failed:", error instanceof Error ? error : new Error(String(error)), { component: 'InvoicesPage' });
            toast.error("Failed to generate PDF");
        }
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

    const getStatusIcon = (status: string) => {
        switch (status) {
            case "paid":
                return <CheckCircle className="h-4 w-4 text-green-500" />;
            case "overdue":
                return <AlertCircle className="h-4 w-4 text-red-500" />;
            case "sent":
                return <ExternalLink className="h-4 w-4 text-blue-500" />;
            case "draft":
                return <FileText className="h-4 w-4 text-muted-foreground" />;
            default:
                return <Clock className="h-4 w-4 text-muted-foreground" />;
        }
    };

    // Calculate stats
    const totalRevenue = invoices
        ?.filter((i) => i.status === "paid")
        .reduce((sum, i) => sum + i.total, 0) || 0;

    const outstandingAmount = invoices
        ?.filter((i) => i.status === "sent" || i.status === "overdue")
        .reduce((sum, i) => sum + i.total, 0) || 0;

    const overdueAmount = invoices
        ?.filter((i) => i.status === "overdue")
        .reduce((sum, i) => sum + i.total, 0) || 0;

    return (
        <div className="space-y-6 p-6 pb-16">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Invoices</h1>
                    <p className="text-muted-foreground">
                        Manage your invoices and track payments.
                    </p>
                </div>
                <Button onClick={() => navigate(`/${tenantSlug}/admin/crm/invoices/new`)}>
                    <Plus className="mr-2 h-4 w-4" /> Create Invoice
                </Button>
            </div>

            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(totalRevenue)}</div>
                        <p className="text-xs text-muted-foreground">
                            From {invoices?.filter(i => i.status === 'paid').length || 0} paid invoices
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Outstanding</CardTitle>
                        <Clock className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(outstandingAmount)}</div>
                        <p className="text-xs text-muted-foreground">
                            {invoices?.filter(i => i.status === 'sent').length || 0} sent invoices
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Overdue</CardTitle>
                        <AlertCircle className="h-4 w-4 text-red-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-600">{formatCurrency(overdueAmount)}</div>
                        <p className="text-xs text-muted-foreground">
                            {invoices?.filter(i => i.status === 'overdue').length || 0} overdue invoices
                        </p>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader className="p-4">
                    <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-2.5 top-3.5 h-4 w-4 text-muted-foreground md:top-2.5" />
                            <Input
                                placeholder="Search invoices..."
                                className="pl-8 h-11 md:h-10 text-base md:text-sm"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" className="gap-2 w-full md:w-auto justify-center h-11 md:h-10 text-base md:text-sm">
                                    <Filter className="h-4 w-4" />
                                    Filter: {statusFilter ? statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1) : "All"}
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-[200px]">
                                <DropdownMenuLabel>Filter by Status</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="py-3 md:py-1.5" onClick={() => setStatusFilter(null)}>
                                    All Statuses
                                </DropdownMenuItem>
                                <DropdownMenuItem className="py-3 md:py-1.5" onClick={() => setStatusFilter("draft")}>
                                    Draft
                                </DropdownMenuItem>
                                <DropdownMenuItem className="py-3 md:py-1.5" onClick={() => setStatusFilter("sent")}>
                                    Sent
                                </DropdownMenuItem>
                                <DropdownMenuItem className="py-3 md:py-1.5" onClick={() => setStatusFilter("paid")}>
                                    Paid
                                </DropdownMenuItem>
                                <DropdownMenuItem className="py-3 md:py-1.5" onClick={() => setStatusFilter("overdue")}>
                                    Overdue
                                </DropdownMenuItem>
                                <DropdownMenuItem className="py-3 md:py-1.5" onClick={() => setStatusFilter("cancelled")}>
                                    Cancelled
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    {/* Mobile List View */}
                    <div className="md:hidden divide-y">
                        {isLoading ? (
                            [...Array(3)].map((_, i) => (
                                <div key={i} className="p-4 space-y-3">
                                    <div className="flex justify-between">
                                        <Skeleton className="h-5 w-24" />
                                        <Skeleton className="h-5 w-16 rounded-full" />
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <div className="space-y-1">
                                            <Skeleton className="h-4 w-32" />
                                            <Skeleton className="h-3 w-20" />
                                        </div>
                                        <Skeleton className="h-6 w-20" />
                                    </div>
                                </div>
                            ))
                        ) : filteredInvoices?.length === 0 ? (
                            <div className="p-6">
                                <EnhancedEmptyState
                                    icon={FileText}
                                    title={searchQuery || statusFilter ? "No Invoices Found" : "No Invoices Yet"}
                                    description={searchQuery || statusFilter ? "No invoices match your current filters." : "Create your first invoice to get started."}
                                    primaryAction={!searchQuery && !statusFilter ? {
                                        label: "Create Invoice",
                                        onClick: () => navigate(`/${tenantSlug}/admin/crm/invoices/new`),
                                        icon: Plus
                                    } : undefined}
                                    compact
                                />
                            </div>
                        ) : (
                            filteredInvoices?.map((invoice) => (
                                <div
                                    key={invoice.id}
                                    className="p-4 active:bg-muted/50 transition-colors"
                                    onClick={() => navigate(`/${tenantSlug}/admin/crm/invoices/${invoice.id}`)}
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <span className="font-semibold text-sm">{invoice.invoice_number}</span>
                                            <p className="text-sm text-foreground/90 font-medium">
                                                {invoice.client?.name || "Unknown Client"}
                                            </p>
                                        </div>
                                        {getStatusBadge(invoice.status)}
                                    </div>

                                    <div className="flex justify-between items-end">
                                        <div className="text-xs text-muted-foreground space-y-0.5">
                                            <p>Due: {format(new Date(invoice.due_date), "MMM d, yyyy")}</p>
                                            <p>{format(new Date(invoice.invoice_date), "MMM d")}</p>
                                        </div>

                                        <div className="flex items-center gap-3">
                                            <span className="font-bold text-base">
                                                {formatCurrency(invoice.total)}
                                            </span>

                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-11 w-11 -mr-2" onClick={(e) => e.stopPropagation()}>
                                                        <span className="sr-only">Open menu</span>
                                                        <MoreHorizontal className="h-5 w-5" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="w-[200px]">
                                                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                    <DropdownMenuItem className="py-3" onClick={(e) => {
                                                        e.stopPropagation();
                                                        navigate(`/${tenantSlug}/admin/crm/invoices/${invoice.id}`);
                                                    }}>
                                                        View Details
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem className="py-3" onClick={(e) => {
                                                        e.stopPropagation();
                                                        const link = `${window.location.origin}/portal/invoice/${invoice.public_token}`;
                                                        navigator.clipboard.writeText(link);
                                                        toast.success("Invoice link copied");
                                                    }}>
                                                        Copy Link
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    {invoice.status !== "paid" && invoice.status !== "cancelled" && (
                                                        <DropdownMenuItem className="py-3" onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleMarkAsPaid(invoice.id);
                                                        }}>
                                                            Mark as Paid
                                                        </DropdownMenuItem>
                                                    )}
                                                    <DropdownMenuItem className="py-3" onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDownloadPDF(invoice);
                                                    }}>
                                                        Download PDF
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Desktop Table View */}
                    <Table className="hidden md:table">
                        <TableHeader>
                            <TableRow>
                                <TableHead>Invoice #</TableHead>
                                <TableHead>Client</TableHead>
                                <TableHead>Date</TableHead>
                                <TableHead>Due Date</TableHead>
                                <TableHead className="text-right">Amount</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                // Skeleton loading state
                                [...Array(5)].map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                        <TableCell className="text-right"><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                                        <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
                                        <TableCell className="text-right"><Skeleton className="h-8 w-8 ml-auto rounded" /></TableCell>
                                    </TableRow>
                                ))
                            ) : filteredInvoices?.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="h-64">
                                        <EnhancedEmptyState
                                            icon={FileText}
                                            title={searchQuery || statusFilter ? "No Invoices Found" : "No Invoices Yet"}
                                            description={searchQuery || statusFilter ? "No invoices match your current filters." : "Create your first invoice to get started."}
                                            primaryAction={!searchQuery && !statusFilter ? {
                                                label: "Create Invoice",
                                                onClick: () => navigate(`/${tenantSlug}/admin/crm/invoices/new`),
                                                icon: Plus
                                            } : undefined}
                                            compact
                                        />
                                    </TableCell>
                                </TableRow>
                            ) : (
                                paginatedInvoices?.map((invoice) => (
                                    <TableRow
                                        key={invoice.id}
                                        className="cursor-pointer hover:bg-muted/50"
                                        onClick={() => navigate(`/${tenantSlug}/admin/crm/invoices/${invoice.id}`)}
                                    >
                                        <TableCell className="font-medium">
                                            {invoice.invoice_number}
                                        </TableCell>
                                        <TableCell>
                                            {invoice.client?.name || "Unknown Client"}
                                        </TableCell>
                                        <TableCell>
                                            {format(new Date(invoice.invoice_date), "MMM d, yyyy")}
                                        </TableCell>
                                        <TableCell>
                                            {format(new Date(invoice.due_date), "MMM d, yyyy")}
                                        </TableCell>
                                        <TableCell className="text-right font-medium">
                                            {formatCurrency(invoice.total)}
                                        </TableCell>
                                        <TableCell>
                                            {getStatusBadge(invoice.status)}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" className="h-8 w-8 p-0" onClick={(e) => e.stopPropagation()}>
                                                        <span className="sr-only">Open menu</span>
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                    <DropdownMenuItem onClick={(e) => {
                                                        e.stopPropagation();
                                                        navigate(`/${tenantSlug}/admin/crm/invoices/${invoice.id}`);
                                                    }}>
                                                        View Details
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={(e) => {
                                                        e.stopPropagation();
                                                        // Copy link logic
                                                        const link = `${window.location.origin}/portal/invoice/${invoice.public_token}`;
                                                        navigator.clipboard.writeText(link);
                                                        toast.success("Invoice link copied to clipboard");
                                                    }}>
                                                        Copy Link
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    {invoice.status !== "paid" && invoice.status !== "cancelled" && (
                                                        <DropdownMenuItem onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleMarkAsPaid(invoice.id);
                                                        }}>
                                                            Mark as Paid
                                                        </DropdownMenuItem>
                                                    )}
                                                    <DropdownMenuItem onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDownloadPDF(invoice);
                                                    }}>
                                                        Download PDF
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>

                {/* Pagination */}
                {totalItems > pageSize && (
                    <div className="p-4 border-t">
                        <StandardPagination
                            currentPage={currentPage}
                            totalPages={totalPages}
                            totalItems={totalItems}
                            pageSize={pageSize}
                            onPageChange={goToPage}
                            onPageSizeChange={changePageSize}
                            pageSizeOptions={pageSizeOptions}
                        />
                    </div>
                )}
            </Card>
        </div>
    );
}

function DollarSignIcon(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <line x1="12" x2="12" y1="2" y2="22" />
            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
        </svg>
    );
}
