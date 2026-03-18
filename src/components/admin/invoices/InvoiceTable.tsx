import { format } from "date-fns";
import { CRMInvoice } from "@/types/crm";
import { formatCurrency } from "@/lib/utils/formatCurrency";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Edit, Mail, FileText, DollarSign } from "lucide-react";
import { AdminDataTable } from "@/components/admin/shared/AdminDataTable";
import { ResponsiveColumn } from "@/components/shared/ResponsiveTable";

interface InvoiceTableProps {
    invoices: CRMInvoice[];
    isLoading: boolean;
    selectedIds: string[];
    onSelectionChange: (ids: string[]) => void;
    onRowClick: (invoice: CRMInvoice) => void;
    onEditInBuilder: (invoiceId: string) => void;
}

export function InvoiceTable({
    invoices,
    isLoading,
    selectedIds,
    onSelectionChange,
    onRowClick,
    onEditInBuilder
}: InvoiceTableProps) {
    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            onSelectionChange(invoices.map(i => i.id));
        } else {
            onSelectionChange([]);
        }
    };

    const handleSelectRow = (checked: boolean, id: string) => {
        if (checked) {
            onSelectionChange([...selectedIds, id]);
        } else {
            onSelectionChange(selectedIds.filter(selectedId => selectedId !== id));
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "paid":
                return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">Paid</Badge>;
            case "overdue":
                return <Badge variant="destructive">Overdue</Badge>;
            case "sent":
                return <Badge className="bg-blue-100 text-blue-800 border-blue-200">Sent</Badge>;
            case "draft":
                return <Badge className="bg-gray-100 text-gray-700 border-gray-200">Draft</Badge>;
            case "partially_paid":
                return <Badge className="bg-amber-100 text-amber-800 border-amber-200">Partially Paid</Badge>;
            case "cancelled":
            case "void":
                return <Badge className="bg-gray-900 text-white border-gray-900">Void</Badge>;
            default:
                return <Badge variant="outline">{status}</Badge>;
        }
    };

    const columns: ResponsiveColumn<CRMInvoice>[] = [
        {
            header: (
                <Checkbox
                    checked={invoices.length > 0 && selectedIds.length === invoices.length}
                    onCheckedChange={handleSelectAll}
                    aria-label="Select all"
                />
            ),
            accessorKey: "id",
            cell: (invoice) => (
                <div onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                        checked={selectedIds.includes(invoice.id)}
                        onCheckedChange={(checked) => handleSelectRow(Boolean(checked), invoice.id)}
                        aria-label={`Select invoice ${invoice.invoice_number}`}
                    />
                </div>
            ),
            width: 40,
        },
        {
            header: "Invoice #",
            accessorKey: "invoice_number",
            cell: (invoice) => (
                <span className="font-medium">{invoice.invoice_number}</span>
            )
        },
        {
            header: "Customer",
            accessorKey: "client",
            cell: (invoice) => {
                const name = invoice.client?.name || "Unknown Client";
                return <div>{name}</div>;
            }
        },
        {
            header: "Status",
            accessorKey: "status",
            cell: (invoice) => getStatusBadge(invoice.status)
        },
        {
            header: "Issue Date",
            accessorKey: "invoice_date",
            cell: (invoice) => format(new Date(invoice.invoice_date || invoice.created_at), "MMM d, yyyy")
        },
        {
            header: "Due Date",
            accessorKey: "due_date",
            cell: (invoice) => invoice.due_date ? format(new Date(invoice.due_date), "MMM d, yyyy") : "N/A"
        },
        {
            header: <div className="text-right">Total</div>,
            accessorKey: "total",
            className: "text-right",
            cell: (invoice) => formatCurrency(invoice.total)
        },
        {
            header: <div className="text-right">Balance</div>,
            accessorKey: "amount_paid" as any,
            className: "text-right",
            cell: (invoice) => {
                const balance = invoice.total - (invoice.amount_paid ?? 0);
                return <span className={balance > 0 ? "font-medium" : ""}>{formatCurrency(balance)}</span>;
            }
        },
        {
            header: "",
            accessorKey: "id",
            width: 50,
            cell: (invoice) => (
                <div onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                                <span className="sr-only">Open menu</span>
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => onRowClick(invoice)}>
                                <FileText className="mr-2 h-4 w-4" />
                                View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onEditInBuilder(invoice.id)}>
                                <Edit className="mr-2 h-4 w-4" />
                                Edit in Builder
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem>
                                <Mail className="mr-2 h-4 w-4" />
                                Send Email
                            </DropdownMenuItem>
                            {["sent", "unpaid", "partially_paid", "overdue"].includes(invoice.status) && (
                                <DropdownMenuItem>
                                    <DollarSign className="mr-2 h-4 w-4" />
                                    Record Payment
                                </DropdownMenuItem>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            )
        }
    ];

    return (
        <AdminDataTable
            data={invoices}
            columns={columns}
            keyExtractor={(invoice) => invoice.id}
            isLoading={isLoading}
            onRowClick={onRowClick}
            emptyStateTitle="No invoices found"
            emptyStateDescription="Try adjusting your filters or create a new invoice."
        />
    );
}
