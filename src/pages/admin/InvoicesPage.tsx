import { useState } from "react";
import { useNavigate } from "react-router-dom";
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
    Clock
} from "lucide-react";
import { formatCurrency } from "@/utils/formatters";
import { format } from "date-fns";
import { toast } from "sonner";
import { CRMInvoice } from "@/types/crm";

export default function InvoicesPage() {
    const navigate = useNavigate();
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
    });

    const handleMarkAsPaid = (id: string) => {
        markAsPaid.mutate(id, {
            onSuccess: () => {
                toast.success("Invoice marked as paid");
            },
        });
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
                <Button onClick={() => navigate("/admin/crm/invoices/new")}>
                    <Plus className="mr-2 h-4 w-4" /> Create Invoice
                </Button>
            </div>

            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                        <DollarSignIcon className="h-4 w-4 text-muted-foreground" />
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
                    <div className="flex items-center gap-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search invoices..."
                                className="pl-8"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" className="gap-2">
                                    <Filter className="h-4 w-4" />
                                    Filter: {statusFilter ? statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1) : "All"}
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Filter by Status</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => setStatusFilter(null)}>
                                    All Statuses
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setStatusFilter("draft")}>
                                    Draft
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setStatusFilter("sent")}>
                                    Sent
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setStatusFilter("paid")}>
                                    Paid
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setStatusFilter("overdue")}>
                                    Overdue
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setStatusFilter("cancelled")}>
                                    Cancelled
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
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
                                <TableRow>
                                    <TableCell colSpan={7} className="h-24 text-center">
                                        Loading invoices...
                                    </TableCell>
                                </TableRow>
                            ) : filteredInvoices?.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="h-24 text-center">
                                        No invoices found.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredInvoices?.map((invoice) => (
                                    <TableRow
                                        key={invoice.id}
                                        className="cursor-pointer hover:bg-muted/50"
                                        onClick={() => navigate(`/admin/crm/invoices/${invoice.id}`)}
                                    >
                                        <TableCell className="font-medium">
                                            {invoice.invoice_number}
                                        </TableCell>
                                        <TableCell>
                                            {invoice.client?.name || "Unknown Client"}
                                        </TableCell>
                                        <TableCell>
                                            {format(new Date(invoice.issue_date), "MMM d, yyyy")}
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
                                                        navigate(`/admin/crm/invoices/${invoice.id}`);
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
                                                        // Download PDF logic (placeholder)
                                                        toast.info("PDF download coming soon");
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
