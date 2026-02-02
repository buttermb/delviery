/**
 * Single Page Checkout
 * Streamlined one-page checkout experience
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { sanitizeFormInput, sanitizeEmail, sanitizePhoneInput, sanitizeTextareaInput } from '@/lib/utils/sanitize';
import { useShop } from '@/pages/shop/ShopLayout';
import { useLuxuryTheme } from '@/components/shop/luxury';
import { useShopCart } from '@/hooks/useShopCart';
import { useInventoryCheck } from '@/hooks/useInventoryCheck';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { logger } from '@/lib/logger';
import { StockWarning } from '@/components/shop/StockWarning';
import ArrowLeft from "lucide-react/dist/esm/icons/arrow-left";
import Package from "lucide-react/dist/esm/icons/package";
import Truck from "lucide-react/dist/esm/icons/truck";
import CreditCard from "lucide-react/dist/esm/icons/credit-card";
import ShoppingCart from "lucide-react/dist/esm/icons/shopping-cart";
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import AlertTriangle from "lucide-react/dist/esm/icons/alert-triangle";
import Check from "lucide-react/dist/esm/icons/check";
import X from "lucide-react/dist/esm/icons/x";
import { formatCurrency } from '@/lib/utils/formatCurrency';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface CheckoutFormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  street: string;
  apartment: string;
  city: string;
  state: string;
  zip: string;
  deliveryNotes: string;
  paymentMethod: string;
}

export function SinglePageCheckout() {
  const { storeSlug } = useParams();
  const navigate = useNavigate();
  const { store, setCartItemCount } = useShop();
  const { isLuxuryTheme, accentColor } = useLuxuryTheme();
  const { toast } = useToast();
  const { checkCartStock } = useInventoryCheck();

  const [formData, setFormData] = useState<CheckoutFormData>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    street: '',
    apartment: '',
    city: '',
    state: '',
    zip: '',
    deliveryNotes: '',
    paymentMethod: 'cash',
  });
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [stockIssues, setStockIssues] = useState<Array<{ productName: string; available: number; requested: number }>>([]);
  const [isCheckingStock, setIsCheckingStock] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof CheckoutFormData, string>>>({});

  // Cart hook
  const { cartItems, subtotal, clearCart, isInitialized } = useShopCart({
    storeId: store?.id,
    onCartChange: setCartItemCount,
  });

  // Load saved form data
  const formStorageKey = store?.id ? `checkout_form_${store.id}` : null;
  
  useEffect(() => {
    if (formStorageKey) {
      try {
        const saved = localStorage.getItem(formStorageKey);
        if (saved) {
          setFormData((prev) => ({ ...prev, ...JSON.parse(saved) }));
        }
      } catch {}
    }
  }, [formStorageKey]);

  // Save form data on change
  useEffect(() => {
    if (formStorageKey && formData.email) {
      try {
        localStorage.setItem(formStorageKey, JSON.stringify(formData));
      } catch {}
    }
  }, [formData, formStorageKey]);

  // Check stock on mount
  useEffect(() => {
    if (isInitialized && cartItems.length > 0) {
      checkStock();
    }
  }, [isInitialized, cartItems.length]);

  // Redirect if cart empty
  useEffect(() => {
    if (isInitialized && cartItems.length === 0) {
      toast({ title: 'Your cart is empty' });
      navigate(`/shop/${storeSlug}/cart`);
    }
  }, [isInitialized, cartItems.length]);

  const checkStock = async () => {
    setIsCheckingStock(true);
    const result = await checkCartStock(
      cartItems.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        name: item.name,
      }))
    );
    
    if (!result.isValid) {
      setStockIssues(
        result.outOfStock.map((s) => ({
          productName: s.productName,
          available: s.available,
          requested: s.requested,
        }))
      );
    } else {
      setStockIssues([]);
    }
    setIsCheckingStock(false);
  };

  // Calculate totals
  const deliveryFee = subtotal >= (store?.free_delivery_threshold || 100) ? 0 : (store?.default_delivery_fee || 5);
  const total = subtotal + deliveryFee;

  const updateField = (field: keyof CheckoutFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error on change
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof CheckoutFormData, string>> = {};

    if (!formData.firstName.trim()) newErrors.firstName = 'First name is required';
    if (!formData.lastName.trim()) newErrors.lastName = 'Last name is required';
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!EMAIL_REGEX.test(formData.email)) {
      newErrors.email = 'Invalid email address';
    }
    if (!formData.street.trim()) newErrors.street = 'Street address is required';
    if (!formData.city.trim()) newErrors.city = 'City is required';
    if (!formData.zip.trim()) newErrors.zip = 'ZIP code is required';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Place order mutation
  const placeOrderMutation = useMutation({
    mutationFn: async () => {
      if (!store?.id) throw new Error('No store');

      // Final stock check
      const stockResult = await checkCartStock(
        cartItems.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          name: item.name,
        }))
      );

      if (!stockResult.isValid) {
        const outOfStockNames = stockResult.outOfStock.map((s) => s.productName).join(', ');
        throw new Error(`Items out of stock: ${outOfStockNames}`);
      }

      const orderItems = cartItems.map((item) => ({
        product_id: item.productId,
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        image_url: item.imageUrl,
      }));

      const sanitizedFirstName = sanitizeFormInput(formData.firstName, 100);
      const sanitizedLastName = sanitizeFormInput(formData.lastName, 100);
      const sanitizedStreet = sanitizeFormInput(formData.street, 200);
      const sanitizedApt = formData.apartment ? sanitizeFormInput(formData.apartment, 100) : '';
      const sanitizedCity = sanitizeFormInput(formData.city, 100);
      const sanitizedState = sanitizeFormInput(formData.state, 50);
      const sanitizedZip = sanitizeFormInput(formData.zip, 20);

      const { data: orderId, error } = await supabase.rpc('create_marketplace_order', {
        p_store_id: store.id,
        p_items: orderItems,
        p_customer_name: `${sanitizedFirstName} ${sanitizedLastName}`,
        p_customer_email: sanitizeEmail(formData.email),
        p_customer_phone: formData.phone ? sanitizePhoneInput(formData.phone) : null,
        p_delivery_address: `${sanitizedStreet}${sanitizedApt ? ', ' + sanitizedApt : ''}, ${sanitizedCity}, ${sanitizedState} ${sanitizedZip}`,
        p_delivery_notes: formData.deliveryNotes ? sanitizeTextareaInput(formData.deliveryNotes, 500) : null,
        p_subtotal: subtotal,
        p_tax: 0,
        p_delivery_fee: deliveryFee,
        p_total: total,
        p_payment_method: formData.paymentMethod,
      });

      if (error) throw error;
      if (!orderId) throw new Error('Failed to create order');

      return { order_id: orderId };
    },
    onSuccess: async (data) => {
      // Clear cart and form
      if (store?.id) {
        localStorage.removeItem(`shop_cart_${store.id}`);
        if (formStorageKey) localStorage.removeItem(formStorageKey);
        setCartItemCount(0);
      }

      navigate(`/shop/${storeSlug}/order-confirmation`, {
        state: { orderId: data.order_id },
      });
    },
    onError: (error: any) => {
      logger.error('Order failed', error);
      toast({
        title: 'Order failed',
        description: error.message || 'Something went wrong',
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = async () => {
    if (!validateForm()) {
      toast({ title: 'Please fix the errors', variant: 'destructive' });
      return;
    }

    if (!agreeToTerms) {
      toast({ title: 'Please agree to the terms', variant: 'destructive' });
      return;
    }

    if (stockIssues.length > 0) {
      toast({ title: 'Some items are out of stock', variant: 'destructive' });
      return;
    }

    placeOrderMutation.mutate();
  };

  if (!store) return null;

  const themeColor = isLuxuryTheme ? accentColor : store.primary_color;

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(`/shop/${storeSlug}/cart`)}
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Checkout</h1>
          <p className="text-muted-foreground text-sm">
            {cartItems.length} item{cartItems.length !== 1 ? 's' : ''} • {formatCurrency(subtotal)}
          </p>
        </div>
      </div>

      {/* Stock Issues Alert */}
      {stockIssues.length > 0 && (
        <Card className="mb-6 border-destructive bg-destructive/5">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-destructive mt-0.5" />
              <div className="flex-1">
                <p className="font-medium text-destructive">Stock Issues</p>
                <ul className="mt-1 text-sm text-muted-foreground">
                  {stockIssues.map((issue, idx) => (
                    <li key={idx}>
                      {issue.productName}: only {issue.available} available (you have {issue.requested})
                    </li>
                  ))}
                </ul>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => navigate(`/shop/${storeSlug}/cart`)}
                >
                  Update Cart
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid lg:grid-cols-5 gap-6">
        {/* Main Form */}
        <div className="lg:col-span-3 space-y-6">
          {/* Contact Info */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <Package className="w-5 h-5" />
                Contact Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name *</Label>
                  <Input
                    id="firstName"
                    value={formData.firstName}
                    onChange={(e) => updateField('firstName', e.target.value)}
                    className={errors.firstName ? 'border-destructive' : ''}
                  />
                  {errors.firstName && (
                    <p className="text-xs text-destructive">{errors.firstName}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name *</Label>
                  <Input
                    id="lastName"
                    value={formData.lastName}
                    onChange={(e) => updateField('lastName', e.target.value)}
                    className={errors.lastName ? 'border-destructive' : ''}
                  />
                  {errors.lastName && (
                    <p className="text-xs text-destructive">{errors.lastName}</p>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => updateField('email', e.target.value)}
                  className={errors.email ? 'border-destructive' : ''}
                />
                {errors.email && (
                  <p className="text-xs text-destructive">{errors.email}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone (optional)</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => updateField('phone', e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Delivery Address */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <Truck className="w-5 h-5" />
                Delivery Address
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="street">Street Address *</Label>
                <Input
                  id="street"
                  value={formData.street}
                  onChange={(e) => updateField('street', e.target.value)}
                  className={errors.street ? 'border-destructive' : ''}
                />
                {errors.street && (
                  <p className="text-xs text-destructive">{errors.street}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="apartment">Apt, Suite, etc. (optional)</Label>
                <Input
                  id="apartment"
                  value={formData.apartment}
                  onChange={(e) => updateField('apartment', e.target.value)}
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">City *</Label>
                  <Input
                    id="city"
                    value={formData.city}
                    onChange={(e) => updateField('city', e.target.value)}
                    className={errors.city ? 'border-destructive' : ''}
                  />
                  {errors.city && (
                    <p className="text-xs text-destructive">{errors.city}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">State</Label>
                  <Input
                    id="state"
                    value={formData.state}
                    onChange={(e) => updateField('state', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="zip">ZIP *</Label>
                  <Input
                    id="zip"
                    value={formData.zip}
                    onChange={(e) => updateField('zip', e.target.value)}
                    className={errors.zip ? 'border-destructive' : ''}
                  />
                  {errors.zip && (
                    <p className="text-xs text-destructive">{errors.zip}</p>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Delivery Notes (optional)</Label>
                <Textarea
                  id="notes"
                  placeholder="Gate code, building instructions..."
                  value={formData.deliveryNotes}
                  onChange={(e) => updateField('deliveryNotes', e.target.value)}
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>

          {/* Payment */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                Payment Method
              </CardTitle>
            </CardHeader>
            <CardContent>
              <RadioGroup
                value={formData.paymentMethod}
                onValueChange={(v) => updateField('paymentMethod', v)}
                className="space-y-3"
              >
                <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/50">
                  <RadioGroupItem value="cash" />
                  <div>
                    <p className="font-medium">Cash on Delivery</p>
                    <p className="text-sm text-muted-foreground">Pay when order arrives</p>
                  </div>
                </label>
                <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/50">
                  <RadioGroupItem value="card" />
                  <div>
                    <p className="font-medium">Credit/Debit Card</p>
                    <p className="text-sm text-muted-foreground">Secure payment via Stripe</p>
                  </div>
                </label>
              </RadioGroup>
            </CardContent>
          </Card>
        </div>

        {/* Order Summary Sidebar */}
        <div className="lg:col-span-2">
          <Card className="sticky top-4">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <ShoppingCart className="w-5 h-5" />
                Order Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Items */}
              <div className="space-y-3 max-h-60 overflow-y-auto">
                {cartItems.map((item) => (
                  <div key={`${item.productId}-${item.variant || ''}`} className="flex gap-3">
                    <div className="w-14 h-14 bg-muted rounded flex-shrink-0">
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          className="w-full h-full object-cover rounded"
                        />
                      ) : (
                        <Package className="w-full h-full p-3 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.name}</p>
                      <p className="text-xs text-muted-foreground">Qty: {item.quantity}</p>
                    </div>
                    <p className="text-sm font-medium">{formatCurrency(item.price * item.quantity)}</p>
                  </div>
                ))}
              </div>

              <Separator />

              {/* Totals */}
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Delivery</span>
                  <span>
                    {deliveryFee === 0 ? (
                      <span className="text-green-600">FREE</span>
                    ) : (
                      formatCurrency(deliveryFee)
                    )}
                  </span>
                </div>
                {deliveryFee > 0 && store?.free_delivery_threshold && (
                  <p className="text-xs text-muted-foreground">
                    Add {formatCurrency(store.free_delivery_threshold - subtotal)} more for free delivery
                  </p>
                )}
              </div>

              <Separator />

              <div className="flex justify-between text-lg font-bold">
                <span>Total</span>
                <span style={{ color: themeColor }}>{formatCurrency(total)}</span>
              </div>

              {/* Terms */}
              <label className="flex items-start gap-2 cursor-pointer">
                <Checkbox
                  checked={agreeToTerms}
                  onCheckedChange={(checked) => setAgreeToTerms(checked === true)}
                  className="mt-0.5"
                />
                <span className="text-xs text-muted-foreground">
                  I agree to the terms of service and privacy policy
                </span>
              </label>

              {/* Submit */}
              <Button
                className="w-full h-12 text-base"
                style={{ backgroundColor: themeColor }}
                disabled={
                  placeOrderMutation.isPending ||
                  stockIssues.length > 0 ||
                  isCheckingStock
                }
                onClick={handleSubmit}
              >
                {placeOrderMutation.isPending ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Check className="w-5 h-5 mr-2" />
                    Place Order • {formatCurrency(total)}
                  </>
                )}
              </Button>

              <p className="text-xs text-center text-muted-foreground">
                Your payment information is secure
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default SinglePageCheckout;
