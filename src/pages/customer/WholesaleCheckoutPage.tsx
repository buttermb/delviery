import { logger } from '@/lib/logger';
/**
 * Wholesale Checkout Page
 * B2B customers can complete wholesale orders
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useCustomerAuth } from '@/contexts/CustomerAuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { 
  ShoppingCart, 
  ArrowLeft,
  Building2,
  MapPin,
  CreditCard,
  CheckCircle,
  Loader2
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { ModeBanner } from '@/components/customer/ModeSwitcher';
import { useState as useReactState, useEffect } from 'react';
import { STORAGE_KEYS, safeStorage } from '@/constants/storageKeys';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { calculateOrderTotal } from '@/lib/marketplace/feeCalculation';
import { useFeatureFlags } from '@/config/featureFlags';
import { queryKeys } from '@/lib/queryKeys';

type CustomerMode = 'retail' | 'wholesale';

const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
];

const PAYMENT_TERMS = [
  { value: 'prepaid', label: 'Prepaid (Pay Now)' },
  { value: 'net_30', label: 'Net 30 (Pay in 30 days)' },
  { value: 'net_60', label: 'Net 60 (Pay in 60 days)' },
];

export default function WholesaleCheckoutPage() {
  const { shouldAutoApprove } = useFeatureFlags();
  const { slug } = useParams<{ slug: string }>();
  const { customer, tenant } = useCustomerAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const tenantId = tenant?.id;
  const buyerTenantId = tenantId;
  const [mode, setMode] = useReactState<CustomerMode>('wholesale');
  const [shippingAddress, setShippingAddress] = useState({
    street: '',
    city: '',
    state: '',
    zip: '',
    country: 'USA',
  });
  const [shippingMethod, setShippingMethod] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('prepaid');
  const [buyerNotes, setBuyerNotes] = useState('');

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
  const { data: cartItems = [] } = useQuery({
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
            marketplace_profiles!inner (
              id,
              tenant_id,
              business_name
            )
          )
        `)
        .eq('buyer_tenant_id', buyerTenantId);

      if (error) {
        logger.error('Failed to fetch cart items', error, { component: 'WholesaleCheckoutPage' });
        throw error;
      }

      return data ?? [];
    },
    enabled: !!buyerTenantId,
  });

  // Group cart items by seller
  interface SellerGroup {
    sellerProfileId: string;
    sellerTenantId: string;
    sellerName: string;
    items: typeof cartItems;
  }

  const itemsBySeller = cartItems.reduce((acc: Record<string, SellerGroup>, item: typeof cartItems[number]) => {
    const sellerId = item.marketplace_listings?.marketplace_profiles?.tenant_id;
    if (!sellerId) return acc;

    if (!acc[sellerId]) {
      acc[sellerId] = {
        sellerProfileId: item.marketplace_listings.marketplace_profiles.id,
        sellerTenantId: sellerId,
        sellerName: item.marketplace_listings.marketplace_profiles.business_name,
        items: [],
      };
    }

    acc[sellerId].items.push(item);
    return acc;
  }, {});

  // Calculate totals
  const subtotal = cartItems.reduce((sum, item) => {
    const price = item.unit_price as number ?? 0;
    const qty = item.quantity as number ?? 0;
    return sum + (price * qty);
  }, 0);

  const feeCalculation = calculateOrderTotal(subtotal, 0, 0); // Tax and shipping calculated separately
  const total = feeCalculation.totalAmount;

  // Create order mutation
  const createOrderMutation = useMutation({
    mutationFn: async () => {
      if (!buyerTenantId) {
        throw new Error('Tenant ID required');
      }

      // Validate shipping address
      if (!shippingAddress.street || !shippingAddress.city || !shippingAddress.state || !shippingAddress.zip) {
        throw new Error('Please complete shipping address');
      }

      // Create orders for each seller (one order per seller)
      const orders = [];

      for (const sellerGroup of Object.values(itemsBySeller) as SellerGroup[]) {
        const orderItems = (sellerGroup as SellerGroup).items.map((item: typeof cartItems[number]) => ({
          listing_id: item.listing_id,
          product_name: item.marketplace_listings?.product_name || 'Unknown Product',
          product_type: item.marketplace_listings?.product_type || null,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price: (item.quantity as number) * (item.unit_price as number),
        }));

        const _orderSubtotal = orderItems.reduce((sum: number, item) => sum + item.total_price, 0);

        // Call edge function to create order
        const { data, error } = await supabase.functions.invoke('create-marketplace-order', {
          body: {
            buyer_tenant_id: buyerTenantId,
            buyer_user_id: customer?.id,
            seller_tenant_id: sellerGroup.sellerTenantId,
            seller_profile_id: sellerGroup.sellerProfileId,
            items: orderItems,
            shipping_address: shippingAddress,
            shipping_method: shippingMethod || null,
            shipping_cost: 0, // Could be calculated based on shipping method
            tax: 0, // Could be calculated based on address
            payment_terms: paymentTerms,
            buyer_notes: buyerNotes || null,
          },
        });

        if (error) throw error;
        if (data && data.error) {
          throw new Error(data.error);
        }

        // Auto-approve newly created orders if flag is active
        try {
          if (shouldAutoApprove('ORDERS')) {
            const createdOrderId = data?.order?.id || data?.id;
            if (createdOrderId) {
              await supabase
                .from('marketplace_orders')
                .update({ status: 'confirmed', confirmed_at: new Date().toISOString() })
                .eq('id', createdOrderId);
            }
          }
        } catch (e) {
          // Non-blocking: log and continue
          logger?.warn?.('Auto-approve (orders) update failed (non-blocking)', e);
        }

        orders.push(data);
      }

      // Clear cart after successful order creation
      const { error: clearError } = await supabase
        .from('marketplace_cart')
        .delete()
        .eq('buyer_tenant_id', buyerTenantId);

      if (clearError) {
        logger.warn('Failed to clear cart after order creation', clearError);
        // Don't throw - order was created successfully
      }

      return orders;
    },
    onSuccess: (orders) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.marketplaceCart.byBuyer(buyerTenantId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.marketplaceOrders.all });
      
      toast.success(shouldAutoApprove('ORDERS') ? 'Order Auto\u2011Approved' : 'Order Placed!', {
        description: shouldAutoApprove('ORDERS')
          ? `Created ${orders.length} order(s) and marked as confirmed.`
          : `Successfully created ${orders.length} order(s)`,
      });

      // Navigate to orders page
      navigate(`/${slug}/shop/wholesale/orders`);
    },
    onError: (error: unknown) => {
      logger.error('Failed to create order', error, { component: 'WholesaleCheckoutPage' });
      toast.error('Order Failed', {
        description: error instanceof Error ? error.message : 'Failed to create order',
      });
    },
  });

  if (cartItems.length === 0) {
    return (
      <div className="min-h-dvh bg-background pb-16 lg:pb-0">
        <div className="bg-primary/5 border-b border-primary/20">
          <div className="container mx-auto px-4 py-4">
            <ModeBanner currentMode={mode} onModeChange={setMode} />
          </div>
        </div>
        <div className="container mx-auto px-4 py-6">
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <ShoppingCart className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">Your Cart is Empty</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Add items to your cart before checkout
                </p>
                <Button onClick={() => navigate(`/${slug}/shop/wholesale`)}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Marketplace
                </Button>
              </div>
            </CardContent>
          </Card>
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
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(`/${slug}/shop/wholesale/cart`)}
            aria-label="Back to cart"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <CreditCard className="h-6 w-6" />
              Checkout
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Complete your wholesale order
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Shipping Address */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Shipping Address
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Street Address *</Label>
                  <Input
                    value={shippingAddress.street}
                    onChange={(e) => setShippingAddress({ ...shippingAddress, street: e.target.value })}
                    placeholder="123 Main St"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>City *</Label>
                    <Input
                      value={shippingAddress.city}
                      onChange={(e) => setShippingAddress({ ...shippingAddress, city: e.target.value })}
                      placeholder="Los Angeles"
                    />
                  </div>
                  <div>
                    <Label>State *</Label>
                    <Select
                      value={shippingAddress.state}
                      onValueChange={(value) => setShippingAddress({ ...shippingAddress, state: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select state" />
                      </SelectTrigger>
                      <SelectContent>
                        {US_STATES.map((state) => (
                          <SelectItem key={state} value={state}>
                            {state}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>ZIP Code *</Label>
                    <Input
                      value={shippingAddress.zip}
                      onChange={(e) => setShippingAddress({ ...shippingAddress, zip: e.target.value })}
                      placeholder="90001"
                    />
                  </div>
                  <div>
                    <Label>Country</Label>
                    <Input
                      value={shippingAddress.country}
                      onChange={(e) => setShippingAddress({ ...shippingAddress, country: e.target.value })}
                      placeholder="USA"
                    />
                  </div>
                </div>
                <div>
                  <Label>Shipping Method</Label>
                  <Input
                    value={shippingMethod}
                    onChange={(e) => setShippingMethod(e.target.value)}
                    placeholder="UPS Ground, FedEx, etc."
                  />
                </div>
              </CardContent>
            </Card>

            {/* Payment Terms */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Payment Terms
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Select value={paymentTerms} onValueChange={setPaymentTerms}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select payment terms" />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_TERMS.map((term) => (
                      <SelectItem key={term.value} value={term.value}>
                        {term.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            {/* Order Notes */}
            <Card>
              <CardHeader>
                <CardTitle>Order Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={buyerNotes}
                  onChange={(e) => setBuyerNotes(e.target.value)}
                  placeholder="Add any special instructions or notes for the seller..."
                  rows={4}
                  aria-label="Order notes"
                />
              </CardContent>
            </Card>
          </div>

          {/* Order Summary */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Items by Seller */}
                {(Object.values(itemsBySeller) as SellerGroup[]).map((sellerGroup) => (
                  <div key={sellerGroup.sellerTenantId} className="pb-4 border-b last:border-0">
                    <div className="flex items-center gap-2 mb-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">{sellerGroup.sellerName}</span>
                    </div>
                    <div className="space-y-1 text-sm">
                      {sellerGroup.items.map((item: typeof cartItems[number]) => (
                        <div key={item.id} className="flex justify-between text-muted-foreground">
                          <span>
                            {item.marketplace_listings?.product_name} × {item.quantity}
                          </span>
                          <span>
                            {formatCurrency((item.quantity as number) * (item.unit_price as number))}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                <div className="pt-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="font-medium">{formatCurrency(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Platform Fee (2%)</span>
                    <span className="font-medium">{formatCurrency(feeCalculation.platformFee)}</span>
                  </div>
                  <div className="pt-2 border-t flex justify-between font-semibold text-lg">
                    <span>Total</span>
                    <span>{formatCurrency(total)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Button
              className="w-full"
              size="lg"
              onClick={() => createOrderMutation.mutate()}
              disabled={createOrderMutation.isPending}
            >
              {createOrderMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Place Order
                </>
              )}
            </Button>

            <Button
              variant="outline"
              className="w-full"
              onClick={() => navigate(`/${slug}/shop/wholesale/cart`)}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Cart
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

