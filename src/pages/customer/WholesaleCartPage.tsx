import { logger } from '@/lib/logger';
/**
 * Wholesale Cart Page
 * B2B customers can view and manage their wholesale shopping cart
 */

import { useState as _useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useCustomerAuth } from '@/contexts/CustomerAuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { 
  ShoppingCart, 
  Plus,
  Minus,
  Trash2,
  ArrowRight,
  Building2,
  Package
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { Table as _Table, TableBody as _TableBody, TableCell as _TableCell, TableHead as _TableHead, TableHeader as _TableHeader, TableRow as _TableRow } from '@/components/ui/table';
import { ModeBanner } from '@/components/customer/ModeSwitcher';
import { useState as useReactState, useEffect, useMemo } from 'react';
import { STORAGE_KEYS, safeStorage } from '@/constants/storageKeys';
import { queryKeys } from '@/lib/queryKeys';

type CustomerMode = 'retail' | 'wholesale';

export default function WholesaleCartPage() {
  const { slug } = useParams<{ slug: string }>();
  const { tenant } = useCustomerAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const tenantId = tenant?.id;
  const buyerTenantId = tenantId;
  const [mode, setMode] = useReactState<CustomerMode>('wholesale');

  // Load saved mode preference
  useEffect(() => {
    try {
      const savedMode = safeStorage.getItem(STORAGE_KEYS.CUSTOMER_MODE) as CustomerMode | null;
      if (savedMode && (savedMode === 'retail' || savedMode === 'wholesale')) {
        setMode(savedMode);
      }
    } catch {
      // Ignore storage errors
    }
  }, [setMode]);

  // Fetch cart items
  const { data: cartItems = [], isLoading } = useQuery({
    queryKey: queryKeys.marketplaceCart.byBuyer(buyerTenantId),
    queryFn: async () => {
      if (!buyerTenantId) return [];

      const { data, error } = await supabase
        .from('marketplace_cart')
        .select(`
          *,
          marketplace_listings!inner (
            id,
            product_name,
            product_type,
            images,
            base_price,
            unit_type,
            quantity_available,
            marketplace_profiles!inner (
              id,
              business_name,
              verified_badge
            )
          )
        `)
        .eq('buyer_tenant_id', buyerTenantId);

      if (error) {
        logger.error('Failed to fetch cart items', error, { component: 'WholesaleCartPage' });
        throw error;
      }

      return data ?? [];
    },
    enabled: !!buyerTenantId,
  });

  // Update quantity mutation
  const updateQuantityMutation = useMutation({
    mutationFn: async ({ cartId, quantity }: { cartId: string; quantity: number }) => {
      if (quantity <= 0) {
        // Remove item if quantity is 0 or less
        const { error } = await supabase
          .from('marketplace_cart')
          .delete()
          .eq('id', cartId);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('marketplace_cart')
          .update({ quantity })
          .eq('id', cartId);

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.marketplaceCart.byBuyer(buyerTenantId) });
    },
    onError: (error: unknown) => {
      logger.error('Failed to update cart', error, { component: 'WholesaleCartPage' });
      toast.error('Error', {
        description: error instanceof Error ? error.message : 'Failed to update cart',
      });
    },
  });

  // Remove item mutation
  const removeItemMutation = useMutation({
    mutationFn: async (cartId: string) => {
      const { error } = await supabase
        .from('marketplace_cart')
        .delete()
        .eq('id', cartId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.marketplaceCart.byBuyer(buyerTenantId) });
      toast.success('Item Removed', {
        description: 'Item removed from cart',
      });
    },
    onError: (error: unknown) => {
      logger.error('Failed to remove item', error, { component: 'WholesaleCartPage' });
      toast.error('Error', {
        description: error instanceof Error ? error.message : 'Failed to remove item',
      });
    },
  });

  // Memoized cart totals
  const { subtotal, platformFee, total } = useMemo(() => {
    const sub = cartItems.reduce((sum, item) => {
      const price = item.unit_price as number ?? 0;
      const qty = item.quantity as number ?? 0;
      return sum + (price * qty);
    }, 0);
    const fee = Math.round((sub * 0.02) * 100) / 100; // 2% platform fee
    return { subtotal: sub, platformFee: fee, total: sub + fee };
  }, [cartItems]);

  const handleQuantityChange = (cartId: string, currentQuantity: number, delta: number) => {
    const newQuantity = currentQuantity + delta;
    if (newQuantity < 1) {
      removeItemMutation.mutate(cartId);
    } else {
      updateQuantityMutation.mutate({ cartId, quantity: newQuantity });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-dvh bg-background pb-16 lg:pb-0">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background pb-16 lg:pb-0">
      {/* Mode Banner */}
      <div className="bg-primary/5 border-b border-primary/20">
        <div className="container mx-auto px-4 py-4">
          <ModeBanner currentMode={mode} onModeChange={setMode} />
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShoppingCart className="h-6 w-6" />
            Wholesale Cart
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Review your wholesale order before checkout
          </p>
        </div>

        {cartItems.length === 0 ? (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <ShoppingCart className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">Your Cart is Empty</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Add items from the marketplace to get started
                </p>
                <Button onClick={() => navigate(`/${slug}/shop/wholesale`)}>
                  <Building2 className="h-4 w-4 mr-2" />
                  Browse Marketplace
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Cart Items */}
            <div className="lg:col-span-2 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Cart Items ({cartItems.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {cartItems.map((item) => {
                      const listing = item.marketplace_listings;
                      const profile = listing?.marketplace_profiles;
                      const quantity = item.quantity as number;
                      const unitPrice = item.unit_price as number;
                      const itemTotal = quantity * unitPrice;

                      return (
                        <div key={item.id} className="flex gap-4 p-4 border rounded-lg">
                          {/* Product Image */}
                          {listing?.images && listing.images.length > 0 ? (
                            <img
                              src={listing.images[0]}
                              alt={listing.product_name}
                              className="w-20 h-20 object-cover rounded"
                              loading="lazy"
                            />
                          ) : (
                            <div className="w-20 h-20 bg-muted rounded flex items-center justify-center">
                              <Package className="h-8 w-8 text-muted-foreground" />
                            </div>
                          )}

                          {/* Product Info */}
                          <div className="flex-1">
                            <div className="flex items-start justify-between mb-2">
                              <div>
                                <h3 className="font-medium">{listing?.product_name || 'Unknown Product'}</h3>
                                {profile && (
                                  <div className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                                    <Building2 className="h-3 w-3" />
                                    {profile.business_name}
                                    {profile.verified_badge && (
                                      <Badge variant="outline" className="border-success/30 text-success text-xs">
                                        Verified
                                      </Badge>
                                    )}
                                  </div>
                                )}
                                <div className="text-sm text-muted-foreground mt-1">
                                  {formatCurrency(unitPrice)} / {listing?.unit_type || 'unit'}
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removeItemMutation.mutate(item.id)}
                                className="text-destructive hover:text-destructive"
                                aria-label="Remove item"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>

                            {/* Quantity Controls */}
                            <div className="flex items-center gap-3 mt-3">
                              <div className="flex items-center gap-2 border rounded-lg">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => handleQuantityChange(item.id, quantity, -1)}
                                  disabled={updateQuantityMutation.isPending}
                                  aria-label="Decrease quantity"
                                >
                                  <Minus className="h-4 w-4" />
                                </Button>
                                <span className="w-12 text-center font-medium">{quantity}</span>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => handleQuantityChange(item.id, quantity, 1)}
                                  disabled={updateQuantityMutation.isPending || ((listing?.quantity_available as number) ?? 0) <= quantity}
                                  aria-label="Increase quantity"
                                >
                                  <Plus className="h-4 w-4" />
                                </Button>
                              </div>
                              <div className="ml-auto">
                                <div className="text-lg font-semibold">
                                  {formatCurrency(itemTotal)}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Order Summary */}
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Order Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="font-medium">{formatCurrency(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Platform Fee (2%)</span>
                    <span className="font-medium">{formatCurrency(platformFee)}</span>
                  </div>
                  <div className="pt-3 border-t flex justify-between font-semibold">
                    <span>Total</span>
                    <span>{formatCurrency(total)}</span>
                  </div>
                </CardContent>
              </Card>

              <Button
                className="w-full"
                size="lg"
                onClick={() => navigate(`/${slug}/shop/wholesale/checkout`)}
              >
                Proceed to Checkout
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>

              <Button
                variant="outline"
                className="w-full"
                onClick={() => navigate(`/${slug}/shop/wholesale`)}
              >
                Continue Shopping
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

