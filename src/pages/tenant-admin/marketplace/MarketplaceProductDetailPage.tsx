import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { humanizeError } from '@/lib/humanizeError';
import {
    ArrowLeft,
    ShoppingCart,
    Store,
    FileText,
    ShieldCheck,
    Package,
    Loader2,
    Minus,
    Plus,
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
import { queryKeys } from '@/lib/queryKeys';

export default function MarketplaceProductDetailPage() {
    const { productId } = useParams<{ productId: string }>();
    const { tenant } = useTenantAdminAuth();
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const [quantity, setQuantity] = useState(1);
    const [messageText, setMessageText] = useState('');
    const [isMessageDialogOpen, setIsMessageDialogOpen] = useState(false);

    // Fetch product details
    const { data: product, isLoading } = useQuery({
        queryKey: queryKeys.marketplaceProduct.byProduct(productId),
        enabled: !!productId,
        queryFn: async () => {
            const { data, error } = await supabase
                .from('marketplace_listings')
                .select(`
          *,
            marketplace_profiles (
            business_name,
            can_sell,
            id,
            tenant_id
          )
        `)
                .eq('id', productId)
                .maybeSingle();

            if (error) throw error;
            return data;
        },
    });

    // Calculate total price
    const totalPrice = product ? product.base_price * quantity : 0;

    // Add to Cart Mutation
    const addToCartMutation = useMutation({
        mutationFn: async () => {
            if (!tenant?.id || !product) throw new Error("Missing tenant or product info");

            // Check if item already exists in cart, then update quantity
            const { data: existingItem } = await supabase
                .from('marketplace_cart')
                .select('id, quantity')
                .eq('buyer_tenant_id', tenant.id)
                .eq('listing_id', product.id)
                .maybeSingle();

            if (existingItem) {
                const { error } = await supabase
                    .from('marketplace_cart')
                    .update({ quantity: existingItem.quantity + quantity })
                    .eq('id', existingItem.id);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('marketplace_cart')
                    .insert({
                        buyer_tenant_id: tenant.id,
                        listing_id: product.id,
                        quantity: quantity,
                        unit_price: product.base_price
                    });
                if (error) throw error;
            }
        },
        onSuccess: () => {
            toast.success('Added to Cart', { description: `${quantity} ${product?.unit_of_measure}(s) of ${product?.product_name} added to your cart.` });
            queryClient.invalidateQueries({ queryKey: queryKeys.marketplaceCart.count() });
            // navigate(`/${tenant?.slug}/admin/marketplace/cart`); // Optional: redirect to cart or stay
        },
        onError: (error) => {
            toast.error('Error adding to cart', { description: humanizeError(error) });
        }
    });

    // Send Message Mutation
    const sendMessageMutation = useMutation({
        mutationFn: async () => {
            if (!tenant?.id || !product?.marketplace_profiles?.tenant_id) throw new Error("Missing tenant info");

            const { error } = await supabase
                .from('marketplace_messages' as 'tenants') // Supabase type limitation
                .insert({
                    sender_tenant_id: tenant.id,
                    receiver_tenant_id: product.marketplace_profiles.tenant_id,
                    listing_id: product.id,
                    subject: `Inquiry about ${product.product_name}`,
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

    if (!product) {
        return (
            <div className="flex flex-col items-center justify-center h-dvh gap-4">
                <h1 className="text-2xl font-bold">Product Not Found</h1>
                <Button onClick={() => navigate(`/${tenant?.slug}/admin/marketplace/browse`)}>Back to Marketplace</Button>
            </div>
        );
    }

    const handleIncrement = () => {
        if (quantity < (product.quantity_available || 100)) setQuantity(q => q + 1);
    };

    const handleDecrement = () => {
        if (quantity > 1) setQuantity(q => q - 1);
    };

    return (
        <div className="space-y-6 container mx-auto max-w-5xl py-8">
            <div className="flex items-center justify-between mb-4">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate(`/${tenant?.slug}/admin/marketplace/browse`)}
                >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to Marketplace
                </Button>
                {product?.marketplace_profiles?.tenant_id !== tenant?.id && (
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
                                    Send a message to {product?.marketplace_profiles?.business_name} about this product.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                <Textarea
                                    placeholder="Hi, I'm interested in..."
                                    value={messageText}
                                    onChange={(e) => setMessageText(e.target.value)}
                                    rows={4}
                                    aria-label="Message to vendor"
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
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Left Column - Images */}
                <div className="space-y-4">
                    <div className="aspect-square bg-muted rounded-lg overflow-hidden border">
                        {product.images && product.images.length > 0 ? (
                            <img src={product.images[0]} alt={product.product_name} className="w-full h-full object-cover" loading="lazy" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-muted-foreground bg-muted/50">
                                <Package className="h-24 w-24 opacity-20" />
                            </div>
                        )}
                    </div>
                    {/* Thumbnails grid would go here */}
                </div>

                {/* Right Column - Details */}
                <div className="space-y-6">
                    <div>
                        <Badge className="mb-2 uppercase tracking-wide">{product.product_type}</Badge>
                        <h1 className="text-3xl font-bold">{product.product_name}</h1>
                        <div className="flex items-center gap-2 mt-2 text-muted-foreground">
                            <Store className="h-4 w-4" />
                            <span className="font-medium underline decoration-dotted underline-offset-4">
                                {product.marketplace_profiles?.business_name || 'Verified Vendor'}
                            </span>
                            {product.marketplace_profiles?.can_sell && (
                                <Badge variant="outline" className="ml-2 text-xs bg-green-50 text-green-700 border-green-200">
                                    <ShieldCheck className="h-3 w-3 mr-1" /> Verified
                                </Badge>
                            )}
                        </div>
                    </div>

                    <Separator />

                    <div className="text-4xl font-bold text-primary">
                        {formatCurrency(product.base_price)}
                        <span className="text-lg font-normal text-muted-foreground ml-1">/ {product.unit_of_measure}</span>
                    </div>

                    <Card className="bg-muted/30">
                        <CardContent className="p-4 space-y-4">
                            <div className="flex items-center justify-between">
                                <span className="font-medium">Quantity ({product.unit_of_measure}s)</span>
                                <div className="flex items-center gap-2">
                                    <Button variant="outline" size="icon" className="h-11 w-11 sm:h-8 sm:w-8" onClick={handleDecrement} disabled={quantity <= 1} aria-label="Decrease quantity">
                                        <Minus className="h-3 w-3" />
                                    </Button>
                                    <Input
                                        type="number"
                                        value={quantity}
                                        onChange={(e) => setQuantity(Number(e.target.value))}
                                        className="w-20 text-center h-8"
                                        min={1}
                                        max={product.quantity_available}
                                        aria-label="Quantity"
                                    />
                                    <Button variant="outline" size="icon" className="h-11 w-11 sm:h-8 sm:w-8" onClick={handleIncrement} disabled={quantity >= (product.quantity_available || 100)} aria-label="Increase quantity">
                                        <Plus className="h-3 w-3" />
                                    </Button>
                                </div>
                            </div>

                            <div className="flex items-center justify-between text-muted-foreground text-sm">
                                <span>Available Stock</span>
                                <span>{product.quantity_available} {product.unit_of_measure}s</span>
                            </div>

                            <Separator />

                            <div className="flex items-center justify-between font-bold text-lg">
                                <span>Total</span>
                                <span>{formatCurrency(totalPrice)}</span>
                            </div>

                            <Button
                                className="w-full size-lg text-lg"
                                onClick={() => addToCartMutation.mutate()}
                                disabled={addToCartMutation.isPending || (product.quantity_available ?? 0) < 1}
                            >
                                {addToCartMutation.isPending ? (
                                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                                ) : (
                                    <ShoppingCart className="h-5 w-5 mr-2" />
                                )}
                                Add to Cart
                            </Button>
                        </CardContent>
                    </Card>

                    <div className="space-y-4 pt-4">
                        <h3 className="font-semibold text-lg">Product Details</h3>

                        <div className="grid grid-cols-2 gap-4 text-sm">
                            {product.strain_name && (
                                <div>
                                    <span className="text-muted-foreground block mb-1">Strain</span>
                                    <div className="font-medium">{product.strain_name}</div>
                                </div>
                            )}
                            {(product.thc_content ?? 0) > 0 && (
                                <div>
                                    <span className="text-muted-foreground block mb-1">THC</span>
                                    <div className="font-medium">{product.thc_content}%</div>
                                </div>
                            )}
                            {(product.cbd_content ?? 0) > 0 && (
                                <div>
                                    <span className="text-muted-foreground block mb-1">CBD</span>
                                    <div className="font-medium">{product.cbd_content}%</div>
                                </div>
                            )}
                        </div>

                        {product.description && (
                            <div className="pt-2">
                                <span className="text-muted-foreground block mb-1">Description</span>
                                <p className="leading-relaxed">{product.description}</p>
                            </div>
                        )}

                        {product.lab_results_url && (
                            <Button variant="outline" className="w-full justify-start mt-2" onClick={() => window.open(product.lab_results_url, '_blank', 'noopener,noreferrer')}>
                                <FileText className="h-4 w-4 mr-2" />
                                View Lab Results (COA)
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
