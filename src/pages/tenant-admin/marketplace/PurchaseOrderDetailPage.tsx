import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { humanizeError } from '@/lib/humanizeError';
import {
    ArrowLeft,
    CheckCircle,
    Truck,
    Store,
    Package,
    Clock,
    XCircle,
    MessageSquare,
    Send
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
import { Textarea } from '@/components/ui/textarea';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { DetailPageSkeleton } from '@/components/admin/shared/LoadingSkeletons';
import { formatSmartDate } from '@/lib/utils/formatDate';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { queryKeys } from '@/lib/queryKeys';

export default function PurchaseOrderDetailPage() {
    const { orderId } = useParams<{ orderId: string }>();
    const { tenant } = useTenantAdminAuth();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [messageText, setMessageText] = useState('');
    const [isMessageDialogOpen, setIsMessageDialogOpen] = useState(false);

    // Fetch order details
    const { data: order, isLoading } = useQuery({
        queryKey: queryKeys.marketplacePurchaseDetail.byOrder(orderId),
        queryFn: async () => {
            if (!orderId) return null;

            const { data, error } = await supabase
                .from('marketplace_orders')
                .select(`
          *,
          marketplace_order_items (*),
          marketplace_profiles (
            business_name,
            tenant_id
          )
        `)
                .eq('id', orderId)
                .eq('buyer_tenant_id', tenant?.id) // Security check
                .maybeSingle();

            if (error) throw error;
            return data;
        },
        enabled: !!orderId && !!tenant?.id,
    });

    // Mark Received Mutation
    const markReceivedMutation = useMutation({
        mutationFn: async () => {
            const { error } = await supabase
                .from('marketplace_orders')
                .update({
                    status: 'delivered',
                    delivered_at: new Date().toISOString()
                })
                .eq('id', orderId);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.marketplacePurchaseDetail.byOrder(orderId) });
            toast.success('Order marked as received');
        },
        onError: (error) => {
            toast.error('Error', { description: humanizeError(error) });
        }
    });

    // Send Message Mutation
    const sendMessageMutation = useMutation({
        mutationFn: async () => {
            if (!tenant?.id || !order?.marketplace_profiles?.tenant_id) throw new Error("Missing tenant info");

            const { error } = await supabase
                .from('marketplace_messages' as 'tenants') // Supabase type limitation
                .insert({
                    sender_tenant_id: tenant.id,
                    receiver_tenant_id: order.marketplace_profiles.tenant_id,
                    order_id: order.id,
                    subject: `Question about Order #${order.order_number}`,
                    message_text: messageText
                });

            if (error) throw error;
        },
        onSuccess: () => {
            toast.success('Message sent', { description: 'The seller has been notified.' });
            setIsMessageDialogOpen(false);
            setMessageText('');
        },
        onError: (error) => {
            toast.error('Error sending message', { description: humanizeError(error) });
        }
    });

    if (isLoading) {
        return <DetailPageSkeleton />;
    }

    if (!order) {
        return (
            <div className="flex flex-col items-center justify-center py-20">
                <h2 className="text-xl font-bold">Order Not Found</h2>
                <Button
                    className="mt-4"
                    variant="ghost"
                    onClick={() => navigate(`/${tenant?.slug}/admin/marketplace/purchases`)}
                >
                    Back to My Purchases
                </Button>
            </div>
        );
    }

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'pending': return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
            case 'accepted': return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-200"><CheckCircle className="h-3 w-3 mr-1" />Accepted</Badge>;
            case 'processing': return <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-200"><Package className="h-3 w-3 mr-1" />Processing</Badge>;
            case 'shipped': return <Badge className="bg-indigo-100 text-indigo-800 hover:bg-indigo-200"><Truck className="h-3 w-3 mr-1" />Shipped</Badge>;
            case 'delivered': return <Badge className="bg-green-100 text-green-800 hover:bg-green-200"><CheckCircle className="h-3 w-3 mr-1" />Delivered</Badge>;
            case 'cancelled': return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Cancelled</Badge>;
            default: return <Badge variant="outline">{status}</Badge>;
        }
    };

    const seller = order.marketplace_profiles;
    const shippingAddress = (order.shipping_address as Record<string, string> | null) || {};

    return (
        <div className="space-y-6 container mx-auto py-6">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => navigate(`/${tenant?.slug}/admin/marketplace/purchases`)} aria-label="Back to purchases">
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-3">
                        Purchase #{order.order_number}
                        {getStatusBadge(order.status)}
                    </h1>
                    <p className="text-muted-foreground text-sm">
                        Placed on {formatSmartDate(order.created_at)}
                    </p>
                </div>
                <div className="ml-auto flex gap-2">
                    <Dialog open={isMessageDialogOpen} onOpenChange={setIsMessageDialogOpen}>
                        <DialogTrigger asChild>
                            <Button variant="outline">
                                <MessageSquare className="h-4 w-4 mr-2" />
                                Contact Seller
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Contact Seller</DialogTitle>
                                <DialogDescription>
                                    Send a message to {seller?.business_name} about Order #{order.order_number}.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                <Textarea
                                    placeholder="I have a question about..."
                                    value={messageText}
                                    onChange={(e) => setMessageText(e.target.value)}
                                    rows={4}
                                />
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setIsMessageDialogOpen(false)}>Cancel</Button>
                                <Button onClick={() => sendMessageMutation.mutate()} disabled={!messageText.trim() || sendMessageMutation.isPending}>
                                    <Send className="h-4 w-4 mr-2" />
                                    Send Message
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                    {order.status === 'shipped' && (
                        <Button onClick={() => markReceivedMutation.mutate()} disabled={markReceivedMutation.isPending}>
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Mark Received
                        </Button>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Main Details */}
                <div className="md:col-span-2 space-y-6">
                    <Card>
                        <CardHeader><CardTitle>Items</CardTitle></CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Product</TableHead>
                                        <TableHead className="text-right">Unit Price</TableHead>
                                        <TableHead className="text-right">Qty</TableHead>
                                        <TableHead className="text-right">Total</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {order.marketplace_order_items.map((item) => (
                                        <TableRow key={item.id}>
                                            <TableCell>
                                                <div className="font-medium">{item.product_name}</div>
                                                <div className="text-xs text-muted-foreground capitalize">{item.product_type}</div>
                                            </TableCell>
                                            <TableCell className="text-right">{formatCurrency(item.unit_price)}</TableCell>
                                            <TableCell className="text-right">{item.quantity} {item.unit_of_measure}</TableCell>
                                            <TableCell className="text-right">{formatCurrency(item.total_price)}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                            <div className="mt-4 pt-4 border-t space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span>Subtotal</span>
                                    <span>{formatCurrency(order.subtotal)}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span>Tax</span>
                                    <span>{formatCurrency(order.tax ?? 0)}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span>Shipping</span>
                                    <span>{formatCurrency(order.shipping_cost ?? 0)}</span>
                                </div>
                                <div className="flex justify-between font-bold text-lg pt-2">
                                    <span>Total</span>
                                    <span>{formatCurrency(order.total_amount)}</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader><CardTitle className="flex items-center gap-2"><Truck className="h-4 w-4" /> Shipping Details</CardTitle></CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <div className="text-sm font-semibold mb-1">Shipping To</div>
                                    <div className="text-sm text-muted-foreground">
                                        {shippingAddress.street}<br />
                                        {shippingAddress.city}, {shippingAddress.state} {shippingAddress.zip}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-sm font-semibold mb-1">Status</div>
                                    <div className="text-sm mb-2">{order.status === 'shipped' ? 'In Transit' : order.status}</div>
                                    {order.tracking_number && (
                                        <div className="text-sm">
                                            <span className="font-semibold block">Tracking Number:</span>
                                            <span className="font-mono bg-muted px-2 py-1 rounded">{order.tracking_number}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Sidebar Stats */}
                <div className="space-y-6">
                    <Card>
                        <CardHeader><CardTitle className="flex items-center gap-2"><Store className="h-4 w-4" /> Vendor</CardTitle></CardHeader>
                        <CardContent>
                            <div className="font-semibold text-lg mb-1">{seller?.business_name || 'Unknown Vendor'}</div>
                            <div className="text-sm text-muted-foreground space-y-1">
                                <div className="italic text-xs">Contact info available upon request</div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader><CardTitle>Payment</CardTitle></CardHeader>
                        <CardContent>
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm text-muted-foreground">Status</span>
                                <Badge variant={order.payment_status === 'paid' ? 'default' : 'outline'}>{order.payment_status}</Badge>
                            </div>
                            {order.payment_terms && (
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-muted-foreground">Terms</span>
                                    <span>{order.payment_terms}</span>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
