import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { logger } from '@/lib/logger';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { humanizeError } from '@/lib/humanizeError';
import {
    Trash2,
    ShoppingCart,
    CreditCard,
    ArrowRight,
    Store,
    Loader2
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { PageHeader } from '@/components/shared/PageHeader';
import { queryKeys } from '@/lib/queryKeys';

export default function MarketplaceCartPage() {
    const { tenant } = useTenantAdminAuth();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [isCheckingOut, setIsCheckingOut] = useState(false);

    // Fetch Cart Items
    const { data: cartItems = [], isLoading } = useQuery({
        queryKey: queryKeys.marketplaceCart.all,
        queryFn: async () => {
            const { data, error } = await supabase
                .from('marketplace_cart')
                .select(`
          *,
          marketplace_listings (
            product_name,
            product_type,
            images,
            unit_of_measure,
            seller_tenant_id,
            marketplace_profiles (
              business_name
            )
          )
        `)
                .eq('buyer_tenant_id', tenant?.id);

            if (error) throw error;
            return data;
        },
    });

    // Remove Item
    const removeItemMutation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase
                .from('marketplace_cart')
                .delete()
                .eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.marketplaceCart.all });
            toast.success('Item removed');
        },
        onError: (error: Error) => {
            logger.error('Failed to remove cart item', { error });
            toast.error('Failed to remove item', { description: humanizeError(error) });
        },
    });

    // Calculate Totals
    const subtotal = cartItems.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
    const taxes = subtotal * 0.15; // Mock tax 15%
    const shipping = 50; // Flat mock shipping
    const total = subtotal + taxes + shipping;

    // Checkout Handler
    const handleCheckout = async () => {
        setIsCheckingOut(true);
        try {
            // 1. Group items by Seller
            const itemsBySeller: Record<string, typeof cartItems> = {};

            cartItems.forEach(item => {
                const sellerId = item.marketplace_listings.seller_tenant_id;
                if (!itemsBySeller[sellerId]) itemsBySeller[sellerId] = [];
                itemsBySeller[sellerId].push(item);
            });

            // 2. Create Order per Seller
            for (const [sellerId, items] of Object.entries(itemsBySeller)) {
                const sellerSubtotal = items.reduce((sum, i) => sum + (i.quantity * i.unit_price), 0);
                const sellerTax = sellerSubtotal * 0.15;
                const sellerTotal = sellerSubtotal + sellerTax + 50; // Per shipment cost

                // Create Order
                const { data: order, error: orderError } = await supabase
                    .from('marketplace_orders')
                    .insert({
                        buyer_tenant_id: tenant!.id,
                        seller_tenant_id: sellerId,
                        status: 'pending',
                        payment_status: 'pending',
                        subtotal: sellerSubtotal,
                        tax: sellerTax,
                        shipping_cost: 50,
                        total_amount: sellerTotal,
                        order_number: `WS-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                        buyer_business_name: tenant?.business_name,
                        // Assuming seller_profile_id is optional or fetched via seller_tenant_id lookups, 
                        // but for now we skip strict profile linking if not available, OR we assume we can get it from listing joins if needed.
                        // Simplified for MVP.
                    })
                    .select()
                    .maybeSingle();

                if (orderError) throw orderError;

                // Create Order Items
                const orderItems = items.map(item => ({
                    order_id: order.id,
                    marketplace_listing_id: item.listing_id,
                    product_name: item.marketplace_listings.product_name,
                    product_type: item.marketplace_listings.product_type,
                    quantity: item.quantity,
                    unit_price: item.unit_price,
                    total_price: item.quantity * item.unit_price,
                    unit_of_measure: item.marketplace_listings.unit_of_measure
                }));

                const { error: itemsError } = await supabase
                    .from('marketplace_order_items')
                    .insert(orderItems);

                if (itemsError) throw itemsError;
            }

            // 3. Clear Cart
            await supabase
                .from('marketplace_cart')
                .delete()
                .eq('buyer_tenant_id', tenant!.id);

            toast.success('Order Placed Successfully!', { description: `We've created ${Object.keys(itemsBySeller).length} order(s) for your items.` });

            navigate(`/${tenant?.slug}/admin/marketplace/orders`); // Redirect to My Orders

        } catch (error: unknown) {
            toast.error('Checkout Failed', { description: humanizeError(error) });
        } finally {
            setIsCheckingOut(false);
        }
    };

    return (
        <div className="space-y-6 container mx-auto max-w-5xl py-8">
            <PageHeader
                title="Shopping Cart"
                description="Review your wholesale items before checkout."
            />

            {isLoading ? (
                <div className="flex justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            ) : cartItems.length > 0 ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Cart Items List */}
                    <div className="lg:col-span-2 space-y-4">
                        {cartItems.map((item) => (
                            <Card key={item.id}>
                                <CardContent className="p-4 flex gap-4 items-center">
                                    <div className="h-20 w-20 bg-muted rounded-md overflow-hidden flex-shrink-0">
                                        {item.marketplace_listings?.images?.[0] ? (
                                            <img src={item.marketplace_listings.images[0]} alt={item.marketplace_listings.product_name || 'Product image'} className="h-full w-full object-cover" loading="lazy" />
                                        ) : (
                                            <div className="h-full w-full flex items-center justify-center bg-gray-100">
                                                <ShoppingCart className="h-8 w-8 text-gray-300" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between">
                                            <h3 className="font-semibold truncate pr-4">{item.marketplace_listings?.product_name}</h3>
                                            <div className="font-bold">{formatCurrency(item.quantity * item.unit_price)}</div>
                                        </div>
                                        <div className="flex items-center text-sm text-muted-foreground gap-1 mb-2">
                                            <Store className="h-3 w-3" />
                                            {item.marketplace_listings?.marketplace_profiles?.business_name}
                                        </div>
                                        <div className="flex items-center justify-between mt-2">
                                            <div className="text-sm">
                                                {formatCurrency(item.unit_price)} / {item.marketplace_listings?.unit_of_measure}
                                            </div>
                                            <div className="flex items-center gap-3">
                                                {/* Quantity (Read Only for MVP, update logic requires simpler mutation setup) */}
                                                <span className="text-sm">Qty: {item.quantity}</span>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-destructive"
                                                    onClick={() => removeItemMutation.mutate(item.id)}
                                                    disabled={removeItemMutation.isPending}
                                                >
                                                    {removeItemMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>

                    {/* Checkout Summary */}
                    <div className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Order Summary</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Subtotal</span>
                                    <span>{formatCurrency(subtotal)}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Tax (est. 15%)</span>
                                    <span>{formatCurrency(taxes)}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Shipping</span>
                                    <span>{formatCurrency(shipping)}</span>
                                </div>
                                <Separator />
                                <div className="flex justify-between font-bold text-lg">
                                    <span>Total</span>
                                    <span>{formatCurrency(total)}</span>
                                </div>
                            </CardContent>
                            <CardFooter>
                                <Button
                                    className="w-full size-lg text-lg"
                                    onClick={handleCheckout}
                                    disabled={isCheckingOut}
                                >
                                    {isCheckingOut ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <CreditCard className="h-5 w-5 mr-2" />}
                                    Checkout
                                </Button>
                            </CardFooter>
                        </Card>
                    </div>
                </div>
            ) : (
                <div className="text-center py-20 bg-muted/20 rounded-lg border border-dashed">
                    <ShoppingCart className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                    <h2 className="text-2xl font-bold mb-2">Your Cart is Empty</h2>
                    <p className="text-muted-foreground mb-6">Looks like you haven't added any wholesale items yet.</p>
                    <Button onClick={() => navigate(`/${tenant?.slug}/admin/marketplace/browse`)}>
                        Browse Marketplace
                        <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                </div>
            )}
        </div>
    );
}
