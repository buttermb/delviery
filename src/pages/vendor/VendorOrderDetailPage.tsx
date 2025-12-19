// @ts-nocheck
import { logger } from '@/lib/logger';
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowLeft, Truck, Check, X } from "lucide-react";
import { useVendorAuth } from '@/contexts/VendorAuthContext';
import { toast } from "sonner";
import { Separator } from '@/components/ui/separator';

export default function VendorOrderDetailPage() {
    const { orderId } = useParams();
    const navigate = useNavigate();
    const { vendor } = useVendorAuth();
    const queryClient = useQueryClient();

    // Fetch Order Details
    const { data: order, isLoading } = useQuery({
        queryKey: ['vendor-order', orderId],
        enabled: !!orderId && !!vendor,
        queryFn: async () => {
            // Fetch order with items
            const { data, error } = await supabase
                .from("marketplace_orders")
                .select(`
          *,
          marketplace_order_items (*)
        `)
                .eq("id", orderId)
                .eq("seller_tenant_id", vendor?.tenant_id) // Security check
                .single();

            if (error) throw error;
            return data;
        },
    });

    // Update Status Mutation
    const updateStatus = useMutation({
        mutationFn: async (newStatus: string) => {
            const { error } = await supabase
                .from('marketplace_orders')
                .update({ status: newStatus })
                .eq('id', orderId);

            if (error) throw error;
        },
        onSuccess: (_, newStatus) => {
            toast.success(`Order marked as ${newStatus}`);
            queryClient.invalidateQueries({ queryKey: ['vendor-order', orderId] });
            queryClient.invalidateQueries({ queryKey: ['vendor-orders'] });
        },
        onError: (error) => {
            toast.error(`Failed to update status: ${error.message}`);
        }
    });

    if (isLoading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!order) {
        return (
            <div className="flex flex-col items-center justify-center h-screen gap-4">
                <h1 className="text-2xl font-bold">Order Not Found</h1>
                <Button onClick={() => navigate('/vendor/dashboard')}>Return to Dashboard</Button>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background container mx-auto px-4 py-8 space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => navigate('/vendor/dashboard')}>
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-3">
                        Order #{order.order_number}
                        <Badge variant="outline" className={`
               ${order.status === 'pending' ? 'bg-yellow-50 text-yellow-700' :
                                order.status === 'accepted' ? 'bg-blue-50 text-blue-700' :
                                    order.status === 'shipped' ? 'bg-purple-50 text-purple-700' :
                                        order.status === 'delivered' ? 'bg-green-50 text-green-700' : ''}
            `}>
                            {order.status.toUpperCase()}
                        </Badge>
                    </h1>
                    <p className="text-muted-foreground text-sm">
                        Placed on {new Date(order.created_at).toLocaleDateString()} at {new Date(order.created_at).toLocaleTimeString()}
                    </p>
                </div>
                <div className="ml-auto flex gap-2">
                    {order.status === 'pending' && (
                        <>
                            <Button
                                variant="outline"
                                onClick={() => updateStatus.mutate('rejected')}
                                disabled={updateStatus.isPending}
                                className="text-destructive hover:text-destructive"
                            >
                                <X className="h-4 w-4 mr-2" />
                                Reject
                            </Button>
                            <Button
                                onClick={() => updateStatus.mutate('accepted')}
                                disabled={updateStatus.isPending}
                            >
                                <Check className="h-4 w-4 mr-2" />
                                Accept Order
                            </Button>
                        </>
                    )}
                    {order.status === 'accepted' && (
                        <Button
                            onClick={() => updateStatus.mutate('shipped')}
                            disabled={updateStatus.isPending}
                        >
                            <Truck className="h-4 w-4 mr-2" />
                            Mark Shipped
                        </Button>
                    )}
                    {order.status === 'shipped' && (
                        <Button
                            variant="secondary"
                            onClick={() => updateStatus.mutate('delivered')}
                            disabled={updateStatus.isPending}
                        >
                            <Check className="h-4 w-4 mr-2" />
                            Mark Delivered
                        </Button>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Order Items */}
                <Card className="md:col-span-2">
                    <CardHeader>
                        <CardTitle>Items</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {order.marketplace_order_items.map((item: any) => (
                                <div key={item.id} className="flex justify-between items-start border-b pb-4 last:border-0 last:pb-0">
                                    <div>
                                        <h4 className="font-medium">{item.product_name}</h4>
                                        <p className="text-sm text-muted-foreground capitalize">{item.product_type} • {item.quantity} Units</p>
                                    </div>
                                    <div className="text-right">
                                        <div className="font-bold">${item.total_price}</div>
                                        <div className="text-xs text-muted-foreground">${item.unit_price} / unit</div>
                                    </div>
                                </div>
                            ))}

                            <Separator />

                            <div className="flex justify-between pt-2">
                                <span>Subtotal</span>
                                <span>${order.subtotal}</span>
                            </div>
                            <div className="flex justify-between text-muted-foreground text-sm">
                                <span>Tax</span>
                                <span>${order.tax || '0.00'}</span>
                            </div>
                            <div className="flex justify-between text-muted-foreground text-sm">
                                <span>Shipping</span>
                                <span>${order.shipping_cost || '0.00'}</span>
                            </div>
                            <div className="flex justify-between font-bold text-lg pt-2">
                                <span>Total</span>
                                <span>${order.total_amount}</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Customer & Shipping Info */}
                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-sm font-medium text-muted-foreground">Customer</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="font-semibold text-lg mb-1">{order.buyer_business_name}</div>
                            {/* We might add more buyer details if available via join or stored in order */}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="text-sm font-medium text-muted-foreground">Shipping Address</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {order.shipping_address ? (
                                <div className="text-sm space-y-1">
                                    <div>{order.shipping_address.street}</div>
                                    <div>{order.shipping_address.city}, {order.shipping_address.state} {order.shipping_address.zip}</div>
                                    <div>{order.shipping_address.country}</div>
                                </div>
                            ) : (
                                <div className="text-sm text-muted-foreground">No shipping address provided</div>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="text-sm font-medium text-muted-foreground">Payment Status</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Badge variant={order.payment_status === 'paid' ? 'default' : 'secondary'} className="mb-2">
                                {order.payment_status?.toUpperCase() || 'PENDING'}
                            </Badge>
                            {order.payment_terms && (
                                <div className="text-xs text-muted-foreground">Terms: {order.payment_terms}</div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
