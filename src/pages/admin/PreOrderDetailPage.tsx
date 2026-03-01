import { useState } from "react";
import { useParams } from "react-router-dom";
import { EnhancedLoadingState } from "@/components/EnhancedLoadingState";
import { useTenantNavigation } from "@/lib/navigation/tenantNavigation";
import { useBreadcrumbLabel } from "@/contexts/BreadcrumbContext";
import { usePreOrder, useCancelPreOrder } from "@/hooks/crm/usePreOrders";
import { RelatedEntitiesPanel } from "@/components/admin/RelatedEntitiesPanel";
import { useRelatedPreOrderInvoices } from "@/hooks/useRelatedEntities";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    ArrowLeft,
    ArrowRight,
    Trash2,
    Receipt,
    Loader2
} from "lucide-react";
import { formatCurrency } from "@/lib/utils/formatCurrency";
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
import { ConvertPreOrderDialog } from "@/components/crm/ConvertPreOrderDialog";
import { SwipeBackWrapper } from "@/components/mobile/SwipeBackWrapper";

export default function PreOrderDetailPage() {
    const { preOrderId } = useParams<{ preOrderId: string }>();
    const { navigateToAdmin } = useTenantNavigation();

    const { data: preOrder, isLoading } = usePreOrder(preOrderId!);
    const cancelPreOrder = useCancelPreOrder();
    const relatedInvoices = useRelatedPreOrderInvoices(preOrder?.client_id, preOrderId);
    const [isConvertDialogOpen, setIsConvertDialogOpen] = useState(false);

    useBreadcrumbLabel(preOrder ? `Pre-Order #${preOrder.pre_order_number}` : null);

    if (isLoading) {
        return <EnhancedLoadingState variant="card" message="Loading pre-order details..." />;
    }

    if (!preOrder) {
        return <div className="p-8 text-center">Pre-order not found</div>;
    }

    const handleCancel = () => {
        cancelPreOrder.mutate(preOrder.id, {
            onSuccess: () => {
                toast.success("Pre-order cancelled");
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

    return (
        <SwipeBackWrapper onBack={() => navigateToAdmin("crm/pre-orders")}>
            <div className="space-y-4 p-4 pb-16 max-w-5xl mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => navigateToAdmin("crm/pre-orders")} aria-label="Back to pre-orders">
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl font-bold tracking-tight">
                                Pre-Order #{preOrder.pre_order_number}
                            </h1>
                            {getStatusBadge(preOrder.status)}
                        </div>
                        <p className="text-muted-foreground">
                            Created on {format(new Date(preOrder.created_at), "PPP")}
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap gap-2">
                    {preOrder.status === "pending" && (
                        <>
                            <Button onClick={() => setIsConvertDialogOpen(true)}>
                                <ArrowRight className="mr-2 h-4 w-4" />
                                Convert to Invoice
                            </Button>

                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="destructive" size="icon" aria-label="Cancel pre-order">
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Cancel Pre-Order?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            This will mark the pre-order as cancelled. You can still view it but cannot convert it.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Back</AlertDialogCancel>
                                        <AlertDialogAction onClick={handleCancel} disabled={cancelPreOrder.isPending} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                            {cancelPreOrder.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                            Cancel Order
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </>
                    )}
                </div>
            </div>

            <ConvertPreOrderDialog
                preOrder={preOrder}
                open={isConvertDialogOpen}
                onOpenChange={setIsConvertDialogOpen}
            />

            <div className="grid gap-6 md:grid-cols-3">
                {/* Main Content */}
                <div className="md:col-span-2 space-y-6">
                    {/* Order Details */}
                    <Card className="overflow-hidden">
                        <CardHeader className="bg-muted/30 border-b pb-8">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h2 className="text-lg font-semibold">Client:</h2>
                                    <div className="mt-2 text-sm">
                                        <p className="font-medium text-foreground">{preOrder.client?.name}</p>
                                        {preOrder.client?.email && <p>{preOrder.client.email}</p>}
                                        {preOrder.client?.phone && <p>{preOrder.client.phone}</p>}
                                    </div>
                                </div>
                                <div className="text-right">
                                    <h2 className="text-lg font-semibold">Details:</h2>
                                    <div className="mt-2 text-sm space-y-1">
                                        <div className="flex justify-end gap-4">
                                            <span className="text-muted-foreground">Created:</span>
                                            <span>{format(new Date(preOrder.created_at), "MMM d, yyyy")}</span>
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
                                    {(preOrder.line_items as unknown as Array<{ description: string; quantity: number; unit_price: number; total: number }>).map((item, index: number) => (
                                        <TableRow key={index}>
                                            <TableCell className="pl-6 font-medium">
                                                {item.description}
                                            </TableCell>
                                            <TableCell className="text-right">{item.quantity}</TableCell>
                                            <TableCell className="text-right">{formatCurrency(item.unit_price)}</TableCell>
                                            <TableCell className="text-right pr-6">{formatCurrency(item.total)}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>

                            <div className="p-6 flex flex-col items-end gap-2 text-sm border-t">
                                <div className="flex justify-between w-48 font-bold text-lg">
                                    <span>Total:</span>
                                    <span>{formatCurrency(preOrder.total)}</span>
                                </div>
                            </div>
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
                                    <p className="font-medium">{preOrder.client?.name}</p>
                                </div>
                                <Button
                                    variant="outline"
                                    className="w-full"
                                    onClick={() => navigateToAdmin(`crm/clients/${preOrder.client_id}`)}
                                >
                                    View Client Profile
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    <RelatedEntitiesPanel
                        title="Related Items"
                        sections={[
                            {
                                key: 'invoices',
                                label: 'Invoices',
                                icon: Receipt,
                                items: relatedInvoices.items,
                                isLoading: relatedInvoices.isLoading,
                                error: relatedInvoices.error,
                                fetchItems: relatedInvoices.fetchItems,
                                onNavigate: (id) => navigateToAdmin(`crm/invoices/${id}`),
                                emptyMessage: 'No invoices for this client',
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
                                        <p className="font-medium">Pre-Order Created</p>
                                        <p className="text-xs text-muted-foreground">
                                            {format(new Date(preOrder.created_at), "MMM d, yyyy h:mm a")}
                                        </p>
                                    </div>
                                </div>
                                {preOrder.status === 'converted' && (
                                    <div className="flex gap-3 text-sm">
                                        <div className="mt-0.5">
                                            <div className="h-2 w-2 rounded-full bg-green-500" />
                                        </div>
                                        <div>
                                            <p className="font-medium">Converted to Invoice</p>
                                            <p className="text-xs text-muted-foreground">
                                                {format(new Date(preOrder.updated_at), "MMM d, yyyy h:mm a")}
                                            </p>
                                        </div>
                                    </div>
                                )}
                                {preOrder.status === 'cancelled' && (
                                    <div className="flex gap-3 text-sm">
                                        <div className="mt-0.5">
                                            <div className="h-2 w-2 rounded-full bg-red-500" />
                                        </div>
                                        <div>
                                            <p className="font-medium">Order Cancelled</p>
                                            <p className="text-xs text-muted-foreground">
                                                {format(new Date(preOrder.updated_at), "MMM d, yyyy h:mm a")}
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
