import { useState } from "react";
import { useTenantNavigation } from "@/lib/navigation/tenantNavigation";
import { usePreOrders, useCancelPreOrder } from "@/hooks/crm/usePreOrders";
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
    ShoppingCart,
    Filter,
    ArrowRight,
    Clock,
    CheckCircle
} from "lucide-react";
import { formatCurrency } from "@/utils/formatters";
import { format } from "date-fns";
import { toast } from "sonner";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import { ConfirmDeleteDialog } from "@/components/shared/ConfirmDeleteDialog";
import { ShortcutHint, useModifierKey } from "@/components/ui/shortcut-hint";
import { Skeleton } from "@/components/ui/skeleton";

export default function PreOrdersPage() {
    const { navigateToAdmin } = useTenantNavigation();
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState<string | null>(null);
    const { dialogState, confirm, closeDialog, setLoading } = useConfirmDialog();

    const { data: preOrders, isLoading } = usePreOrders();
    const mod = useModifierKey();
    const cancelPreOrder = useCancelPreOrder();

    const filteredPreOrders = preOrders?.filter((order) => {
        const matchesSearch =
            order.pre_order_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (order.client?.name || "").toLowerCase().includes(searchQuery.toLowerCase());

        const matchesStatus = statusFilter ? order.status === statusFilter : true;

        return matchesSearch && matchesStatus;
    });

    const handleCancel = (id: string, orderNumber: string) => {
        confirm({
            title: 'Cancel Pre-Order',
            description: `Are you sure you want to cancel this pre-order?`,
            itemName: orderNumber,
            itemType: 'pre-order',
            onConfirm: async () => {
                setLoading(true);
                try {
                    await cancelPreOrder.mutateAsync(id);
                    toast.success("Pre-order cancelled");
                    closeDialog();
                } finally {
                    setLoading(false);
                }
            },
        });
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "converted":
                return <Badge className="bg-green-500 hover:bg-green-600">Converted</Badge>;
            case "pending":
                return <Badge className="bg-yellow-500 hover:bg-yellow-600">Pending</Badge>;
            case "cancelled":
                return <Badge variant="destructive">Cancelled</Badge>;
            default:
                return <Badge variant="outline">{status}</Badge>;
        }
    };

    // Calculate stats
    const pendingCount = preOrders?.filter((o) => o.status === "pending").length || 0;
    const pendingValue = preOrders
        ?.filter((o) => o.status === "pending")
        .reduce((sum, o) => sum + o.total, 0) || 0;

    const convertedCount = preOrders?.filter((o) => o.status === "converted").length || 0;

    return (
        <div className="space-y-6 p-6 pb-16">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Pre-Orders</h1>
                    <p className="text-muted-foreground">
                        Manage pre-orders and convert them to invoices.
                    </p>
                </div>
                <ShortcutHint keys={[mod, "N"]} label="New">
                    <Button onClick={() => navigateToAdmin("crm/pre-orders/new")}>
                        <Plus className="mr-2 h-4 w-4" /> Create Pre-Order
                    </Button>
                </ShortcutHint>
            </div>

            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Pending Orders</CardTitle>
                        <Clock className="h-4 w-4 text-yellow-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{pendingCount}</div>
                        <p className="text-xs text-muted-foreground">
                            Orders waiting to be fulfilled
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Pending Value</CardTitle>
                        <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(pendingValue)}</div>
                        <p className="text-xs text-muted-foreground">
                            Potential revenue
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Converted</CardTitle>
                        <CheckCircle className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{convertedCount}</div>
                        <p className="text-xs text-muted-foreground">
                            Orders processed to invoices
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
                                aria-label="Search pre-orders"
                                placeholder="Search pre-orders..."
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
                                <DropdownMenuItem onClick={() => setStatusFilter("pending")}>
                                    Pending
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setStatusFilter("converted")}>
                                    Converted
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
                                <TableHead>PO Number</TableHead>
                                <TableHead>Client</TableHead>
                                <TableHead>Date</TableHead>
                                <TableHead>Expected Date</TableHead>
                                <TableHead className="text-right">Total</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <TableRow key={i}>
                                        {Array.from({ length: 7 }).map((_, j) => (
                                            <TableCell key={j} className="h-14">
                                                <Skeleton className={j === 0 ? "h-4 w-3/4" : "h-4 w-full max-w-[120px]"} />
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                ))
                            ) : filteredPreOrders?.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="h-24 text-center">
                                        No pre-orders found.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredPreOrders?.map((order) => (
                                    <TableRow
                                        key={order.id}
                                        className="cursor-pointer hover:bg-muted/50"
                                        onClick={() => navigateToAdmin(`crm/pre-orders/${order.id}`)}
                                    >
                                        <TableCell className="font-medium">
                                            {order.pre_order_number}
                                        </TableCell>
                                        <TableCell>
                                            {order.client?.name || "Unknown Client"}
                                        </TableCell>
                                        <TableCell>
                                            {format(new Date(order.created_at), "MMM d, yyyy")}
                                        </TableCell>
                                        <TableCell>
                                            -
                                        </TableCell>
                                        <TableCell className="text-right font-medium">
                                            {formatCurrency(order.total)}
                                        </TableCell>
                                        <TableCell>
                                            {getStatusBadge(order.status)}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" className="h-11 w-11 p-0" onClick={(e) => e.stopPropagation()}>
                                                        <span className="sr-only">Open menu</span>
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                    <DropdownMenuItem onClick={(e) => {
                                                        e.stopPropagation();
                                                        navigateToAdmin(`crm/pre-orders/${order.id}`);
                                                    }}>
                                                        View Details
                                                    </DropdownMenuItem>
                                                    {order.status === "pending" && (
                                                        <>
                                                            <DropdownMenuItem onClick={(e) => {
                                                                e.stopPropagation();
                                                                // Trigger convert dialog (will implement later)
                                                                navigateToAdmin(`crm/pre-orders/${order.id}?action=convert`);
                                                            }}>
                                                                <ArrowRight className="mr-2 h-4 w-4" />
                                                                Convert to Invoice
                                                            </DropdownMenuItem>
                                                            <DropdownMenuSeparator />
                                                            <DropdownMenuItem
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleCancel(order.id, order.pre_order_number);
                                                                }}
                                                                className="text-destructive focus:text-destructive"
                                                            >
                                                                Cancel Order
                                                            </DropdownMenuItem>
                                                        </>
                                                    )}
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

            <ConfirmDeleteDialog
                open={dialogState.open}
                onOpenChange={(open) => !open && closeDialog()}
                onConfirm={dialogState.onConfirm}
                title={dialogState.title}
                description={dialogState.description}
                itemName={dialogState.itemName}
                itemType={dialogState.itemType}
                isLoading={dialogState.isLoading}
            />
        </div>
    );
}
