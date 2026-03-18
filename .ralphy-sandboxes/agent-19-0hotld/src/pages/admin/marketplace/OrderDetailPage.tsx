import { logger } from '@/lib/logger';
/**
 * Marketplace Order Detail Page
 * View detailed information about a marketplace order
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { humanizeError } from '@/lib/humanizeError';
import {
    ShoppingCart,
    ArrowLeft,
    Edit,
    CheckCircle,
    XCircle,
    Clock,
    Package,
    Truck,
    FileText,
    Send,
    User,
    Loader2
} from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { formatSmartDate } from '@/lib/utils/formatDate';
import { useBreadcrumbLabel } from '@/contexts/BreadcrumbContext';
import { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { queryKeys } from '@/lib/queryKeys';

export default function OrderDetailPage() {
    const { orderId } = useParams<{ orderId: string }>();
    const { tenant } = useTenantAdminAuth();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [trackingNumber, setTrackingNumber] = useState('');
    const [sellerNotes, setSellerNotes] = useState('');
    const [showTrackingDialog, setShowTrackingDialog] = useState(false);
    const [showNotesDialog, setShowNotesDialog] = useState(false);
    const [messageText, setMessageText] = useState('');
    const [isMessageDialogOpen, setIsMessageDialogOpen] = useState(false);

    // Fetch order details
    const { data: order, isLoading } = useQuery({
        queryKey: queryKeys.marketplaceOrders.orderDetail(orderId),
        queryFn: async () => {
            if (!orderId) return null;

            const { data, error } = await supabase
                .from('marketplace_orders')
                .select(`
          *,
          marketplace_order_items (*),
          buyer_tenant:tenants!marketplace_orders_buyer_tenant_id_fkey (
             id,
             business_name
          )
        `)
                .eq('id', orderId)
                .maybeSingle();

            if (error) {
                logger.error('Failed to fetch order', error, { component: 'OrderDetailPage', orderId });
                throw error;
            }

            return data;
        },
        enabled: !!orderId,
    });

    useBreadcrumbLabel(order ? `Order #${order.order_number}` : null);

    // Update order status
    const updateStatusMutation = useMutation({
        mutationFn: async ({ newStatus, trackingNum }: { newStatus: string; trackingNum?: string }) => {
            const updateData: Record<string, unknown> = { status: newStatus };

            if (newStatus === 'shipped' && trackingNum) {
                updateData.tracking_number = trackingNum;
                updateData.shipped_at = new Date().toISOString();
            } else if (newStatus === 'delivered') {
                updateData.delivered_at = new Date().toISOString();
            }

            if (!tenant?.id) throw new Error('Tenant context required');

            const { error } = await supabase
                .from('marketplace_orders')
                .update(updateData)
                .eq('id', orderId)
                .eq('seller_tenant_id', tenant.id);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.marketplaceOrders.orderDetail(orderId) });
            queryClient.invalidateQueries({ queryKey: queryKeys.marketplaceOrders.all });
            toast.success("Order status has been updated");
            setShowTrackingDialog(false);
            setTrackingNumber('');
        },
        onError: (error: unknown) => {
            logger.error('Failed to update order status', error, { component: 'OrderDetailPage' });
            toast.error(`Failed to update order status: ${humanizeError(error)}`);
        },
    });

    // Update seller notes
    const updateNotesMutation = useMutation({
        mutationFn: async (notes: string) => {
            if (!tenant?.id) throw new Error('Tenant context required');

            const { error } = await supabase
                .from('marketplace_orders')
                .update({ seller_notes: notes })
                .eq('id', orderId)
                .eq('seller_tenant_id', tenant.id);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.marketplaceOrders.orderDetail(orderId) });
            toast.success("Seller notes have been saved");
            setShowNotesDialog(false);
        },
        onError: (error: unknown) => {
            logger.error('Failed to update notes', error, { component: 'OrderDetailPage' });
            toast.error(`Failed to save seller notes: ${humanizeError(error)}`);
        },
    });

    // Send Message Mutation
    const sendMessageMutation = useMutation({
        mutationFn: async () => {
            if (!tenant?.id || !order?.buyer_tenant_id) throw new Error("Missing tenant info");

            // Check if trying to message self (guest checkout scenario)
            if (tenant.id === order.buyer_tenant_id) {
                throw new Error("Cannot message guest customers directly via platform messaging yet.");
            }

            const { error } = await supabase
                .from('marketplace_messages' as 'tenants') // Supabase type limitation
                .insert({
                    sender_tenant_id: tenant.id,
                    receiver_tenant_id: order.buyer_tenant_id,
                    order_id: order.id,
                    subject: `Update on Order #${order.order_number}`,
                    message_text: messageText
                });

            if (error) throw error;
        },
        onSuccess: () => {
            toast.success("The buyer has been notified.");
            setIsMessageDialogOpen(false);
            setMessageText('');
        },
        onError: (error) => {
            toast.error("Error sending message", { description: humanizeError(error) });
        }
    });

    // Mark as paid
    const markPaidMutation = useMutation({
        mutationFn: async () => {
            if (!tenant?.id) throw new Error('Tenant context required');

            const { error } = await supabase
                .from('marketplace_orders')
                .update({
                    payment_status: 'paid',
                    paid_at: new Date().toISOString(),
                })
                .eq('id', orderId)
                .eq('seller_tenant_id', tenant.id);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.marketplaceOrders.orderDetail(orderId) });
            queryClient.invalidateQueries({ queryKey: queryKeys.marketplaceOrders.all });
            toast.success("Order marked as paid");
        },
        onError: (error: unknown) => {
            logger.error('Failed to mark order as paid', error, { component: 'OrderDetailPage' });
            toast.error(`Failed to mark order as paid: ${humanizeError(error)}`);
        },
    });

    if (isLoading) {
        return (
            <div className="space-y-4">
                <Card>
                    <CardContent className="py-6">
                        <div className="flex items-center justify-center">
                            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (!order) {
        return (
            <div className="space-y-4">
                <Card>
                    <CardContent className="py-6">
                        <div className="text-center">
                            <ShoppingCart className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                            <h3 className="text-lg font-semibold mb-2">Order Not Found</h3>
                            <p className="text-sm text-muted-foreground mb-4">
                                The order you're looking for doesn't exist or has been removed.
                            </p>
                            <Button onClick={() => navigate(`/${tenant?.slug}/admin/marketplace/orders`)}>
                                <ArrowLeft className="h-4 w-4 mr-2" />
                                Back to Orders
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'pending':
                return (
                    <Badge className="bg-warning/20 text-warning border-warning/30">
                        <Clock className="h-3 w-3 mr-1" />
                        Pending
                    </Badge>
                );
            case 'accepted':
                return (
                    <Badge className="bg-info/20 text-info border-info/30">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Accepted
                    </Badge>
                );
            case 'processing':
                return (
                    <Badge className="bg-primary/20 text-primary border-primary/30">
                        <Package className="h-3 w-3 mr-1" />
                        Processing
                    </Badge>
                );
            case 'shipped':
                return (
                    <Badge className="bg-info/20 text-info border-info/30">
                        <Truck className="h-3 w-3 mr-1" />
                        Shipped
                    </Badge>
                );
            case 'delivered':
                return (
                    <Badge className="bg-success/20 text-success border-success/30">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Delivered
                    </Badge>
                );
            case 'cancelled':
                return (
                    <Badge className="bg-destructive/20 text-destructive border-destructive/30">
                        <XCircle className="h-3 w-3 mr-1" />
                        Cancelled
                    </Badge>
                );
            default:
                return <Badge variant="outline">{status}</Badge>;
        }
    };

    const shippingAddress = order.shipping_address as {
        street?: string;
        city?: string;
        state?: string;
        zip?: string;
        country?: string;
    } || {};

    const orderItems = Array.isArray(order.marketplace_order_items)
        ? order.marketplace_order_items
        : [];

    // Can message if buyer is a different tenant
    const canMessage = tenant?.id !== order.buyer_tenant_id;

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => navigate(`/${tenant?.slug}/admin/marketplace/orders`)}
                        aria-label="Back to orders"
                    >
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold flex items-center gap-2">
                            <ShoppingCart className="h-6 w-6" />
                            Order {order.order_number}
                        </h1>
                        <p className="text-sm text-muted-foreground mt-1">
                            {formatSmartDate(order.created_at as string)}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {getStatusBadge(order.status || 'pending')}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Content */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Order Items */}
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>Order Items</CardTitle>
                            {canMessage && (
                                <Dialog open={isMessageDialogOpen} onOpenChange={setIsMessageDialogOpen}>
                                    <DialogTrigger asChild>
                                        <Button variant="outline" size="sm">
                                            <Send className="h-4 w-4 mr-2" />
                                            Message Buyer
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent>
                                        <DialogHeader>
                                            <DialogTitle>Message Buyer</DialogTitle>
                                            <DialogDescription>
                                                Send a message to {(order as unknown as Record<string, Record<string, string>>).buyer_tenant?.business_name || 'Buyer'} about Order #{order.order_number}.
                                            </DialogDescription>
                                        </DialogHeader>
                                        <div className="space-y-4 py-4">
                                            <Textarea
                                                placeholder="Update on your order..."
                                                aria-label="Message to buyer"
                                                value={messageText}
                                                onChange={(e) => setMessageText(e.target.value)}
                                                rows={4}
                                            />
                                        </div>
                                        <DialogFooter>
                                            <Button variant="outline" onClick={() => setIsMessageDialogOpen(false)}>Cancel</Button>
                                            <Button onClick={() => sendMessageMutation.mutate()} disabled={!messageText.trim() || sendMessageMutation.isPending}>
                                                {sendMessageMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                                                Send Message
                                            </Button>
                                        </DialogFooter>
                                    </DialogContent>
                                </Dialog>
                            )}
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Product</TableHead>
                                        <TableHead>Quantity</TableHead>
                                        <TableHead className="text-right">Unit Price</TableHead>
                                        <TableHead className="text-right">Total</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {orderItems.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={4} className="text-center text-muted-foreground">
                                                No items found
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        orderItems.map((item) => (
                                            <TableRow key={item.id}>
                                                <TableCell className="font-medium">{item.product_name}</TableCell>
                                                <TableCell>{item.quantity} {item.unit_type || 'unit'}</TableCell>
                                                <TableCell className="text-right">{formatCurrency(Number(item.unit_price) || 0)}</TableCell>
                                                <TableCell className="text-right">{formatCurrency(Number(item.total_price) || 0)}</TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>

                    {/* Shipping Information */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Truck className="h-5 w-5" />
                                Shipping Information
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <Label className="text-xs text-muted-foreground mb-1">Shipping Address</Label>
                                <div className="text-sm">
                                    {shippingAddress.street && <div>{shippingAddress.street}</div>}
                                    {shippingAddress.city && shippingAddress.state && (
                                        <div>
                                            {shippingAddress.city}, {shippingAddress.state} {shippingAddress.zip}
                                        </div>
                                    )}
                                    {shippingAddress.country && <div>{shippingAddress.country}</div>}
                                </div>
                            </div>
                            {order.shipping_method && (
                                <div>
                                    <Label className="text-xs text-muted-foreground mb-1">Shipping Method</Label>
                                    <div className="text-sm">{order.shipping_method}</div>
                                </div>
                            )}
                            {order.tracking_number && (
                                <div>
                                    <Label className="text-xs text-muted-foreground mb-1">Tracking Number</Label>
                                    <div className="text-sm font-mono">{order.tracking_number}</div>
                                </div>
                            )}
                            {order.shipped_at && (
                                <div>
                                    <Label className="text-xs text-muted-foreground mb-1">Shipped At</Label>
                                    <div className="text-sm">{formatSmartDate(order.shipped_at as string)}</div>
                                </div>
                            )}
                            {order.delivered_at && (
                                <div>
                                    <Label className="text-xs text-muted-foreground mb-1">Delivered At</Label>
                                    <div className="text-sm">{formatSmartDate(order.delivered_at as string)}</div>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Notes */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center justify-between">
                                <span className="flex items-center gap-2">
                                    <FileText className="h-5 w-5" />
                                    Notes
                                </span>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                        setSellerNotes(order.seller_notes ?? '');
                                        setShowNotesDialog(true);
                                    }}
                                >
                                    <Edit className="h-4 w-4 mr-2" />
                                    Edit
                                </Button>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {order.buyer_notes && (
                                <div className="mb-4">
                                    <Label className="text-xs text-muted-foreground mb-1">Buyer Notes</Label>
                                    <p className="text-sm">{order.buyer_notes}</p>
                                </div>
                            )}
                            {order.seller_notes ? (
                                <div>
                                    <Label className="text-xs text-muted-foreground mb-1">Seller Notes</Label>
                                    <p className="text-sm">{order.seller_notes}</p>
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground">No seller notes</p>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Sidebar */}
                <div className="space-y-6">
                    {/* Order Summary */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Order Summary</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Subtotal</span>
                                <span className="font-medium">{formatCurrency(Number(order.subtotal) || 0)}</span>
                            </div>
                            {Number(order.platform_fee) > 0 && (
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Platform Fee (2%)</span>
                                    <span className="font-medium">{formatCurrency(Number(order.platform_fee) || 0)}</span>
                                </div>
                            )}
                            {Number(order.shipping_cost) > 0 && (
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Shipping</span>
                                    <span className="font-medium">{formatCurrency(Number(order.shipping_cost) || 0)}</span>
                                </div>
                            )}
                            {Number(order.tax) > 0 && (
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Tax</span>
                                    <span className="font-medium">{formatCurrency(Number(order.tax) || 0)}</span>
                                </div>
                            )}
                            <div className="pt-3 border-t flex justify-between font-semibold">
                                <span>Total</span>
                                <span>{formatCurrency(Number(order.total_amount) || 0)}</span>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Payment Information */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Payment Information</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div>
                                <Label className="text-xs text-muted-foreground mb-1">Payment Status</Label>
                                <div className="mt-1">
                                    {order.payment_status === 'paid' ? (
                                        <Badge className="bg-success/20 text-success border-success/30">
                                            Paid
                                        </Badge>
                                    ) : order.payment_status === 'overdue' ? (
                                        <Badge className="bg-destructive/20 text-destructive border-destructive/30">
                                            Overdue
                                        </Badge>
                                    ) : (
                                        <Badge className="bg-warning/20 text-warning border-warning/30">
                                            {order.payment_status || 'Pending'}
                                        </Badge>
                                    )}
                                </div>
                            </div>
                            <div>
                                <Label className="text-xs text-muted-foreground mb-1">Payment Terms</Label>
                                <div className="text-sm">{order.payment_terms || 'Prepaid'}</div>
                            </div>
                            {(order as unknown as Record<string, unknown>).paid_at && (
                                <div>
                                    <Label className="text-xs text-muted-foreground mb-1">Paid At</Label>
                                    <div className="text-sm">{formatSmartDate((order as unknown as Record<string, unknown>).paid_at as string)}</div>
                                </div>
                            )}
                            {order.payment_status !== 'paid' && (
                                <Button
                                    className="w-full"
                                    onClick={() => markPaidMutation.mutate()}
                                    disabled={markPaidMutation.isPending}
                                >
                                    {markPaidMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                                    Mark as Paid
                                </Button>
                            )}
                        </CardContent>
                    </Card>

                    {/* Actions */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Actions</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            {order.status === 'pending' && (
                                <>
                                    <Button
                                        className="w-full"
                                        onClick={() => updateStatusMutation.mutate({ newStatus: 'accepted' })}
                                        disabled={updateStatusMutation.isPending}
                                    >
                                        {updateStatusMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                                        Accept Order
                                    </Button>
                                    <Button
                                        className="w-full"
                                        variant="destructive"
                                        onClick={() => updateStatusMutation.mutate({ newStatus: 'rejected' })}
                                        disabled={updateStatusMutation.isPending}
                                    >
                                        {updateStatusMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <XCircle className="h-4 w-4 mr-2" />}
                                        Reject Order
                                    </Button>
                                </>
                            )}
                            {order.status === 'accepted' && (
                                <Button
                                    className="w-full"
                                    onClick={() => updateStatusMutation.mutate({ newStatus: 'processing' })}
                                    disabled={updateStatusMutation.isPending}
                                >
                                    {updateStatusMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Package className="h-4 w-4 mr-2" />}
                                    Start Processing
                                </Button>
                            )}
                            {order.status === 'processing' && (
                                <Dialog open={showTrackingDialog} onOpenChange={setShowTrackingDialog}>
                                    <DialogTrigger asChild>
                                        <Button className="w-full">
                                            <Truck className="h-4 w-4 mr-2" />
                                            Mark as Shipped
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent>
                                        <DialogHeader>
                                            <DialogTitle>Add Tracking Information</DialogTitle>
                                            <DialogDescription>
                                                Enter the tracking number for this shipment
                                            </DialogDescription>
                                        </DialogHeader>
                                        <div className="space-y-4">
                                            <div>
                                                <Label>Tracking Number</Label>
                                                <Input
                                                    value={trackingNumber}
                                                    onChange={(e) => setTrackingNumber(e.target.value)}
                                                    placeholder="1Z999AA10123456784"
                                                />
                                            </div>
                                            <div>
                                                <Label>Shipping Method (Optional)</Label>
                                                <Input
                                                    placeholder="UPS Ground, FedEx, etc."
                                                />
                                            </div>
                                        </div>
                                        <DialogFooter>
                                            <Button
                                                variant="outline"
                                                onClick={() => setShowTrackingDialog(false)}
                                            >
                                                Cancel
                                            </Button>
                                            <Button
                                                onClick={() => updateStatusMutation.mutate({ newStatus: 'shipped', trackingNum: trackingNumber })}
                                                disabled={updateStatusMutation.isPending || !trackingNumber}
                                            >
                                                {updateStatusMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Truck className="h-4 w-4 mr-2" />}
                                                Mark as Shipped
                                            </Button>
                                        </DialogFooter>
                                    </DialogContent>
                                </Dialog>
                            )}
                            {order.status === 'shipped' && (
                                <Button
                                    className="w-full"
                                    onClick={() => updateStatusMutation.mutate({ newStatus: 'delivered' })}
                                    disabled={updateStatusMutation.isPending}
                                >
                                    {updateStatusMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                                    Mark as Delivered
                                </Button>
                            )}
                        </CardContent>
                    </Card>

                    {/* Buyer Information */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <User className="h-5 w-5" />
                                Buyer Information
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-sm">
                                <div className="font-medium mb-1">{String((order as unknown as Record<string, unknown>).buyer_business_name || 'Guest/Unknown')}</div>
                                <div className="text-muted-foreground">Order #{order.order_number}</div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Notes Dialog */}
            <Dialog open={showNotesDialog} onOpenChange={setShowNotesDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit Seller Notes</DialogTitle>
                        <DialogDescription>
                            Add internal notes about this order (only visible to you)
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <Textarea
                            value={sellerNotes}
                            onChange={(e) => setSellerNotes(e.target.value)}
                            placeholder="Add notes about this order..."
                            aria-label="Seller notes"
                            rows={6}
                        />
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setShowNotesDialog(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={() => updateNotesMutation.mutate(sellerNotes)}
                            disabled={updateNotesMutation.isPending}
                        >
                            {updateNotesMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                            Save Notes
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
