/**
 * Checkout Page
 * Multi-step checkout flow
 */

import { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useShop } from './ShopLayout';
import { useLuxuryTheme } from '@/components/shop/luxury';
import { useShopCart, ShopCartItem } from '@/hooks/useShopCart';
import { useDeals } from '@/hooks/useDeals';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { logger } from '@/lib/logger';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Package,
  User,
  MapPin,
  CreditCard,
  ShoppingCart,
  Loader2
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { CheckoutAddressAutocomplete } from '@/components/shop/CheckoutAddressAutocomplete';
import ExpressPaymentButtons from '@/components/shop/ExpressPaymentButtons';
import { CheckoutLoyalty } from '@/components/shop/CheckoutLoyalty';
import { useStoreStatus } from '@/hooks/useStoreStatus';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Clock } from 'lucide-react';

// Email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface CheckoutData {
  // Contact
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  // Delivery
  street: string;
  apartment: string;
  city: string;
  state: string;
  zip: string;
  deliveryNotes: string;
  // Payment
  paymentMethod: string;
}

const STEPS = [
  { id: 1, name: 'Contact', icon: User },
  { id: 2, name: 'Delivery', icon: MapPin },
  { id: 3, name: 'Payment', icon: CreditCard },
  { id: 4, name: 'Review', icon: Check },
];

export default function CheckoutPage() {
  const { storeSlug } = useParams();
  const navigate = useNavigate();
  const { store, setCartItemCount } = useShop();
  const { isLuxuryTheme, accentColor, cardBg, cardBorder, textPrimary, textMuted, inputBg, inputBorder, inputText } = useLuxuryTheme();
  const { toast } = useToast();

  // Check store status
  const { data: storeStatus } = useStoreStatus(store?.id);
  const isStoreClosed = storeStatus?.isOpen === false;

  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<CheckoutData>({
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
  const [showErrors, setShowErrors] = useState(false);
  const [orderRetryCount, setOrderRetryCount] = useState(0);

  // Loyalty points state
  const [loyaltyDiscount, setLoyaltyDiscount] = useState(0);
  const [loyaltyPointsUsed, setLoyaltyPointsUsed] = useState(0);

  // Form persistence key
  const formStorageKey = store?.id ? `checkout_form_${store.id}` : null;

  // Load saved form data on mount
  useEffect(() => {
    if (formStorageKey) {
      try {
        const saved = localStorage.getItem(formStorageKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          setFormData((prev) => ({ ...prev, ...parsed }));
        }
      } catch {
        // Ignore parse errors
      }
    }
  }, [formStorageKey]);

  // Save form data when it changes
  useEffect(() => {
    if (formStorageKey && formData.email) {
      try {
        localStorage.setItem(formStorageKey, JSON.stringify(formData));
      } catch {
        // Ignore storage errors
      }
    }
  }, [formData, formStorageKey]);

  // Use unified cart hook
  const { cartItems, cartCount, subtotal, clearCart, isInitialized } = useShopCart({
    storeId: store?.id,
    onCartChange: setCartItemCount,
  });

  // Redirect to cart if empty
  useEffect(() => {
    if (isInitialized && cartItems.length === 0) {
      toast({ title: 'Your cart is empty', description: 'Add some items before checkout.' });
      navigate(`/shop/${storeSlug}/cart`);
    }
  }, [isInitialized, cartItems.length, navigate, storeSlug, toast]);

  // Fetch and calculate active deals
  const { appliedDeals, totalDiscount: dealsDiscount } = useDeals(store?.id, cartItems, formData.email || undefined);

  // Get delivery fee based on zip code (from delivery zones or default)
  const getDeliveryFee = () => {
    if (subtotal >= (store?.free_delivery_threshold || 100)) return 0;

    // Check if zip matches a delivery zone
    const deliveryZones = (store as any)?.delivery_zones || [];
    const matchingZone = deliveryZones.find((zone: any) => zone.zip_code === formData.zip);

    if (matchingZone) {
      return matchingZone.fee || store?.default_delivery_fee || 5;
    }

    // Fall back to default delivery fee
    return store?.default_delivery_fee || 5;
  };

  // Calculate totals
  const freeDeliveryThreshold = store?.free_delivery_threshold || 100;
  const deliveryFee = getDeliveryFee();
  const rawTotal = Math.max(0, subtotal + deliveryFee - loyaltyDiscount - dealsDiscount);

  // Cart rounding: round to nearest dollar if enabled
  const enableCartRounding = (store as any)?.enable_cart_rounding === true;
  const total = enableCartRounding ? Math.round(rawTotal) : rawTotal;
  const roundingAdjustment = enableCartRounding ? (total - rawTotal) : 0;

  // Update form field
  const updateField = (field: keyof CheckoutData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Validate current step
  const validateStep = () => {
    setShowErrors(true);
    switch (currentStep) {
      case 1:
        if (!formData.firstName || !formData.lastName || !formData.email) {
          toast({ title: 'Please fill in all required fields', variant: 'destructive' });
          return false;
        }
        if (!EMAIL_REGEX.test(formData.email)) {
          toast({ title: 'Invalid email address', description: 'Please enter a valid email.', variant: 'destructive' });
          return false;
        }
        if ((store as any)?.checkout_settings?.require_phone && !formData.phone) {
          toast({ title: 'Phone number is required', variant: 'destructive' });
          return false;
        }
        return true;
      case 2:
        if (!formData.street || !formData.city || !formData.zip) {
          toast({ title: 'Please fill in your delivery address', variant: 'destructive' });
          return false;
        }
        // Validate delivery zone if zones are configured
        const deliveryZones = (store as any)?.delivery_zones || [];
        if (deliveryZones.length > 0) {
          const matchingZone = deliveryZones.find((zone: any) => zone.zip_code === formData.zip);
          if (!matchingZone) {
            toast({
              title: 'Delivery not available',
              description: `We don't currently deliver to zip code ${formData.zip}. Please try a different address.`,
              variant: 'destructive'
            });
            return false;
          }
          // Check minimum order if zone has one
          if (matchingZone.min_order && subtotal < matchingZone.min_order) {
            toast({
              title: 'Minimum order not met',
              description: `This delivery zone requires a minimum order of $${matchingZone.min_order}.`,
              variant: 'destructive'
            });
            return false;
          }
        }
        return true;
      case 3:
        if (!formData.paymentMethod) {
          toast({ title: 'Please select a payment method', variant: 'destructive' });
          return false;
        }
        return true;
      case 4:
        if (!agreeToTerms) {
          toast({ title: 'Please agree to the terms to continue', variant: 'destructive' });
          return false;
        }
        return true;
      default:
        return true;
    }
  };

  // Next step
  const nextStep = () => {
    if (validateStep()) {
      setCurrentStep((prev) => Math.min(prev + 1, 4));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Previous step
  const prevStep = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Place order mutation with retry logic
  const MAX_ORDER_RETRIES = 3;
  const placeOrderMutation = useMutation({
    mutationFn: async () => {
      if (!store?.id) throw new Error('No store');

      // Validate inventory before placing order
      const productIds = cartItems.map((item) => item.productId);
      const { data: products, error: stockError } = await supabase
        .from('products')
        .select('id, name, stock_quantity, available_quantity')
        .in('id', productIds);

      if (stockError) {
        logger.warn('Failed to check inventory', stockError, { component: 'CheckoutPage' });
        // Continue anyway - don't block orders on stock check failure
      } else if (products) {
        const outOfStock: string[] = [];
        for (const item of cartItems) {
          const product = products.find((p) => p.id === item.productId);
          if (product) {
            const available = product.available_quantity ?? product.stock_quantity ?? 0;
            if (available < item.quantity) {
              outOfStock.push(`${item.name} (only ${available} available)`);
            }
          }
        }
        if (outOfStock.length > 0) {
          throw new Error(`Some items are out of stock: ${outOfStock.join(', ')}`);
        }
      }

      // Validate purchase limits
      const purchaseLimits = (store as any)?.purchase_limits;
      if (purchaseLimits?.enabled) {
        // Check max per order limit
        if (purchaseLimits.max_per_order && total > purchaseLimits.max_per_order) {
          throw new Error(
            `Order exceeds maximum limit of $${purchaseLimits.max_per_order} per transaction. ` +
            `Your order total is $${total.toFixed(2)}.`
          );
        }

        // Check daily/weekly limits (requires email for tracking)
        if (formData.email && (purchaseLimits.max_daily || purchaseLimits.max_weekly)) {
          // Get customer's recent orders
          const weekAgo = new Date();
          weekAgo.setDate(weekAgo.getDate() - 7);

          const { data: recentOrders, error: ordersError } = await supabase
            .from('marketplace_orders')
            .select('total, created_at')
            .eq('store_id', store.id)
            .eq('customer_email', formData.email)
            .gte('created_at', weekAgo.toISOString())
            .neq('status', 'cancelled');

          if (!ordersError && recentOrders) {
            const today = new Date().toISOString().split('T')[0];

            // Calculate daily spending
            const dailyTotal = recentOrders
              .filter(o => o.created_at.startsWith(today))
              .reduce((sum, o) => sum + (o.total || 0), 0);

            // Calculate weekly spending
            const weeklyTotal = recentOrders.reduce((sum, o) => sum + (o.total || 0), 0);

            // Check daily limit
            if (purchaseLimits.max_daily && (dailyTotal + total) > purchaseLimits.max_daily) {
              const remaining = Math.max(0, purchaseLimits.max_daily - dailyTotal);
              throw new Error(
                `You've reached your daily purchase limit of $${purchaseLimits.max_daily}. ` +
                `You can spend $${remaining.toFixed(2)} more today.`
              );
            }

            // Check weekly limit
            if (purchaseLimits.max_weekly && (weeklyTotal + total) > purchaseLimits.max_weekly) {
              const remaining = Math.max(0, purchaseLimits.max_weekly - weeklyTotal);
              throw new Error(
                `You've reached your weekly purchase limit of $${purchaseLimits.max_weekly}. ` +
                `You can spend $${remaining.toFixed(2)} more this week.`
              );
            }
          }
        }
      }

      // Prepare items for order
      const orderItems = cartItems.map((item) => ({
        product_id: item.productId,
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        image_url: item.imageUrl,
      }));

      const attemptOrder = async (attempt: number): Promise<any> => {
        try {
          const { data: orderId, error } = await supabase.rpc('create_marketplace_order', {
            p_store_id: store.id,
            p_customer_name: `${formData.firstName} ${formData.lastName}`,
            p_customer_email: formData.email,
            p_customer_phone: formData.phone || null,
            p_delivery_address: `${formData.street}${formData.apartment ? ', ' + formData.apartment : ''}, ${formData.city}, ${formData.state} ${formData.zip}`,
            p_delivery_notes: formData.deliveryNotes || null,
            p_items: orderItems,
            p_subtotal: subtotal,
            p_tax: 0,
            p_delivery_fee: deliveryFee,
            p_total: total,
            p_payment_method: formData.paymentMethod,
          });

          if (error) {
            // Handle case where RPC function doesn't exist - don't retry
            if (error.message?.includes('function') || error.code === '42883') {
              throw new Error('Order system is not configured. Please contact the store.');
            }
            throw error;
          }

          if (!orderId) {
            throw new Error('Failed to create order');
          }

          return { order_id: orderId };
        } catch (err: any) {
          const isNetworkError = err instanceof Error &&
            (err.message.toLowerCase().includes('network') ||
              err.message.toLowerCase().includes('fetch') ||
              err.message.toLowerCase().includes('timeout') ||
              err.message.toLowerCase().includes('failed to fetch'));

          // Retry on network errors
          if (isNetworkError && attempt < MAX_ORDER_RETRIES) {
            setOrderRetryCount(attempt);
            toast({
              title: `Connection issue, retrying (${attempt}/${MAX_ORDER_RETRIES})...`,
            });
            // Exponential backoff: 1s, 2s, 4s
            await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt - 1)));
            return attemptOrder(attempt + 1);
          }

          logger.error('Order RPC error', err, { attempt, component: 'CheckoutPage' });
          throw err;
        }
      };

      return attemptOrder(1);
    },
    onSuccess: async (data) => {
      setOrderRetryCount(0);

      // For card payments, redirect to Stripe checkout
      if (formData.paymentMethod === 'card' && store?.id) {
        try {
          const checkoutItems = cartItems.map((item) => ({
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            image_url: item.imageUrl,
          }));

          const origin = window.location.origin;
          const successUrl = `${origin}/shop/${storeSlug}/order-confirmation?order=${data.order_number}&token=${data.tracking_token}&total=${total}`;
          const cancelUrl = `${origin}/shop/${storeSlug}/checkout`;

          const response = await supabase.functions.invoke('storefront-checkout', {
            body: {
              store_id: store.id,
              order_id: data.order_id,
              items: checkoutItems,
              customer_email: formData.email,
              customer_name: `${formData.firstName} ${formData.lastName}`,
              subtotal,
              delivery_fee: deliveryFee,
              success_url: successUrl,
              cancel_url: cancelUrl,
            },
          });

          if (response.error) {
            throw new Error(response.error.message || 'Payment initialization failed');
          }

          const { url } = response.data;
          if (url) {
            // Redirect to Stripe checkout
            window.location.href = url;
            return;
          }
        } catch (stripeError: any) {
          logger.error('Stripe checkout error', stripeError, { component: 'CheckoutPage' });
          toast({
            title: 'Payment setup failed',
            description: stripeError.message || 'Unable to initialize payment. Please try again or choose a different payment method.',
            variant: 'destructive',
          });
          return;
        }
      }

      // For cash/other payments, go directly to confirmation
      // Clear cart and saved form data
      if (store?.id) {
        localStorage.removeItem(`shop_cart_${store.id}`);
        if (formStorageKey) {
          localStorage.removeItem(formStorageKey);
        }
        setCartItemCount(0);
      }

      // Send order confirmation email (fire and forget)
      const origin = window.location.origin;
      supabase.functions.invoke('send-order-confirmation', {
        body: {
          order_id: data.order_id,
          customer_email: formData.email,
          customer_name: `${formData.firstName} ${formData.lastName}`,
          order_number: data.order_number,
          items: cartItems.map((item) => ({
            name: item.name,
            quantity: item.quantity,
            price: item.price,
          })),
          subtotal,
          delivery_fee: deliveryFee,
          total: data.total,
          store_name: store?.store_name || 'Store',
          tracking_url: `${origin}/shop/${storeSlug}/order-tracking?token=${data.tracking_token}`,
        },
      }).catch((err) => {
        logger.warn('Failed to send order confirmation email', err, { component: 'CheckoutPage' });
      });

      // Navigate to confirmation
      navigate(`/shop/${storeSlug}/order-confirmation`, {
        state: {
          orderNumber: data.order_number,
          trackingToken: data.tracking_token,
          total: data.total,
        },
      });
    },
    onError: (error: any) => {
      setOrderRetryCount(0);
      logger.error('Failed to place order', error, { component: 'CheckoutPage' });

      const errorMessage = error?.message || 'Something went wrong. Please try again.';
      const isNetworkError = errorMessage.toLowerCase().includes('network') ||
        errorMessage.toLowerCase().includes('fetch') ||
        errorMessage.toLowerCase().includes('timeout');

      toast({
        title: 'Order failed',
        description: isNetworkError
          ? 'Network connection issue. Check your connection and try again.'
          : errorMessage,
        variant: 'destructive',
        action: (
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePlaceOrder()}
            className="ml-2"
          >
            Retry
          </Button>
        ),
      });
    },
  });

  // Handle place order
  const handlePlaceOrder = () => {
    if (validateStep()) {
      placeOrderMutation.mutate();
    }
  };

  if (!store) return null;

  const themeColor = isLuxuryTheme ? accentColor : store.primary_color;

  return (
    <div className={`container mx-auto px-4 py-8 max-w-5xl ${isLuxuryTheme ? 'min-h-screen' : ''}`}>
      {/* Steps */}
      <div className="mb-8">
        <nav className="flex justify-between">
          {STEPS.map((step, index) => {
            const Icon = step.icon;
            const isActive = currentStep === step.id;
            const isComplete = currentStep > step.id;
            const isFuture = currentStep < step.id;

            return (
              <div
                key={step.id}
                className="flex-1 flex flex-col items-center relative"
              >
                {/* Connecting Line */}
                {index < STEPS.length - 1 && (
                  <div className={`absolute top-5 left-[calc(50%+20px)] w-[calc(100%-40px)] h-[2px] ${isLuxuryTheme ? 'bg-white/5' : 'bg-muted'}`}>
                    <motion.div
                      className="h-full"
                      initial={{ width: "0%" }}
                      animate={{ width: isComplete ? "100%" : "0%" }}
                      transition={{ duration: 0.5, ease: "easeInOut" }}
                      style={{ backgroundColor: themeColor }}
                    />
                  </div>
                )}

                <div
                  className={`relative w-10 h-10 rounded-full flex items-center justify-center z-10 transition-all duration-300 ${isActive ? 'ring-2 ring-offset-4 ring-offset-background scale-110' : ''
                    } ${isFuture ? (isLuxuryTheme ? 'bg-white/5 text-white/20' : 'bg-muted text-muted-foreground') : ''
                    }`}
                  style={{
                    backgroundColor: isComplete || isActive ? themeColor : undefined,
                    color: isComplete || isActive ? '#fff' : undefined,
                    boxShadow: isActive && isLuxuryTheme ? `0 0 20px ${themeColor}60` : undefined,
                    borderColor: isLuxuryTheme ? '#000' : undefined
                  }}
                >
                  {isComplete ? (
                    <Check className="w-5 h-5" />
                  ) : (
                    <Icon className="w-5 h-5" />
                  )}

                  {/* Active Pulse Ring */}
                  {isActive && (
                    <motion.div
                      className="absolute inset-0 rounded-full"
                      initial={{ scale: 1, opacity: 0.5 }}
                      animate={{ scale: 1.5, opacity: 0 }}
                      transition={{ duration: 2, repeat: Infinity }}
                      style={{ border: `1px solid ${themeColor}` }}
                    />
                  )}
                </div>

                <span
                  className={`text-xs uppercase tracking-widest mt-4 font-semibold transition-colors duration-300 ${isActive ? 'text-primary' : (isLuxuryTheme ? 'text-white/20' : 'text-muted-foreground')
                    }`}
                  style={{ color: isActive ? themeColor : undefined }}
                >
                  {step.name}
                </span>
              </div>
            );
          })}
        </nav>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Form */}
        <div className="lg:col-span-2">

          {/* Store Closed Warning */}
          {isStoreClosed && (
            <Alert className="border-yellow-500/50 bg-yellow-500/10 mb-6">
              <Clock className="h-4 w-4 text-yellow-500" />
              <AlertTitle className="text-yellow-500">Store is currently closed</AlertTitle>
              <AlertDescription className="text-yellow-500/90">
                {storeStatus?.reason || 'We are currently closed for new orders.'}
                {storeStatus?.nextOpen && ` We open again at ${storeStatus.nextOpen}.`}
                {' '}You can still place a pre-order for delivery/pickup when we open.
              </AlertDescription>
            </Alert>
          )}

          <Card className={isLuxuryTheme ? `${cardBg} ${cardBorder}` : ''}>
            <CardContent className="pt-6 overflow-hidden">
              <AnimatePresence mode="wait">
                {/* Step 1: Contact Information */}
                {currentStep === 1 && (
                  <motion.div
                    key="step1"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-4"
                  >
                    <h2 className={`text-xl font-semibold mb-4 ${isLuxuryTheme ? 'text-white font-light' : ''}`}>Contact Information</h2>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="firstName">First Name *</Label>
                        <Input
                          id="firstName"
                          name="firstName"
                          value={formData.firstName}
                          onChange={(e) => updateField('firstName', e.target.value)}
                          placeholder="John"
                          className={showErrors && !formData.firstName ? "border-red-500 focus-visible:ring-red-500" : ""}
                        />
                        {showErrors && !formData.firstName && (
                          <p className="text-xs text-red-500">Required</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="lastName">Last Name *</Label>
                        <Input
                          id="lastName"
                          name="lastName"
                          value={formData.lastName}
                          onChange={(e) => updateField('lastName', e.target.value)}
                          placeholder="Doe"
                          className={showErrors && !formData.lastName ? "border-red-500 focus-visible:ring-red-500" : ""}
                        />
                        {showErrors && !formData.lastName && (
                          <p className="text-xs text-red-500">Required</p>
                        )}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email *</Label>
                      <Input
                        id="email"
                        name="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => updateField('email', e.target.value)}
                        placeholder="john@example.com"
                        className={showErrors && !formData.email ? "border-red-500 focus-visible:ring-red-500" : ""}
                      />
                      {showErrors && !formData.email && (
                        <p className="text-xs text-red-500">Required</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">
                        Phone {store.checkout_settings?.require_phone ? '*' : '(Optional)'}
                      </Label>
                      <Input
                        id="phone"
                        name="phone"
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => updateField('phone', e.target.value)}
                        placeholder="(555) 123-4567"
                      />
                    </div>
                  </motion.div>
                )}

                {/* Step 2: Delivery Address */}
                {currentStep === 2 && (
                  <motion.div
                    key="step2"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-4"
                  >
                    <h2 className="text-xl font-semibold mb-4">Delivery Address</h2>

                    {/* Address Autocomplete */}
                    <div className="space-y-2">
                      <Label htmlFor="street">Street Address *</Label>
                      <CheckoutAddressAutocomplete
                        defaultValue={formData.street}
                        placeholder="Start typing your address..."
                        onAddressSelect={(address) => {
                          updateField('street', address.street);
                          updateField('city', address.city);
                          updateField('state', address.state);
                          updateField('zip', address.zip);
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="apartment">Apartment, Suite, etc. (Optional)</Label>
                      <Input
                        id="apartment"
                        name="apartment"
                        value={formData.apartment}
                        onChange={(e) => updateField('apartment', e.target.value)}
                        placeholder="Apt 4B"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="city">City *</Label>
                        <Input
                          id="city"
                          name="city"
                          value={formData.city}
                          onChange={(e) => updateField('city', e.target.value)}
                          placeholder="New York"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="state">State</Label>
                        <Input
                          id="state"
                          name="state"
                          value={formData.state}
                          onChange={(e) => updateField('state', e.target.value)}
                          placeholder="NY"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="zip">ZIP Code *</Label>
                      <Input
                        id="zip"
                        name="zip"
                        value={formData.zip}
                        onChange={(e) => updateField('zip', e.target.value)}
                        placeholder="10001"
                      />
                    </div>
                    {store.checkout_settings?.show_delivery_notes && (
                      <div className="space-y-2">
                        <Label htmlFor="deliveryNotes">Delivery Instructions (Optional)</Label>
                        <Textarea
                          id="deliveryNotes"
                          value={formData.deliveryNotes}
                          onChange={(e) => updateField('deliveryNotes', e.target.value)}
                          placeholder="Ring doorbell, leave at door, etc."
                          rows={3}
                        />
                      </div>
                    )}
                  </motion.div>
                )}

                {/* Step 3: Payment Method */}
                {currentStep === 3 && (
                  <motion.div
                    key="step3"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-6"
                  >
                    <h2 className="text-xl font-semibold mb-4">Payment Method</h2>

                    {/* Express Payment Options */}
                    <div className="space-y-4">
                      <ExpressPaymentButtons
                        showDivider={true}
                        size="lg"
                      />
                    </div>

                    {/* Standard Payment Methods */}
                    <RadioGroup
                      value={formData.paymentMethod}
                      onValueChange={(value) => updateField('paymentMethod', value)}
                      className="space-y-3"
                    >
                      {(store.payment_methods || ['cash']).map((method: string) => (
                        <div
                          key={method}
                          className="flex items-center space-x-3 p-4 border rounded-lg cursor-pointer hover:bg-muted/50"
                          onClick={() => updateField('paymentMethod', method)}
                        >
                          <RadioGroupItem value={method} id={method} />
                          <Label htmlFor={method} className="flex-1 cursor-pointer capitalize">
                            {method === 'cash' && 'Cash on Delivery'}
                            {method === 'card' && 'Credit/Debit Card'}
                            {method === 'paypal' && 'PayPal'}
                            {method === 'bitcoin' && 'Bitcoin'}
                            {method === 'venmo' && 'Venmo'}
                            {method === 'zelle' && 'Zelle'}
                            {!['cash', 'card', 'paypal', 'bitcoin', 'venmo', 'zelle'].includes(method) && method}
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                  </motion.div>
                )}

                {/* Step 4: Review Order */}
                {currentStep === 4 && (
                  <motion.div
                    key="step4"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-6"
                  >
                    <h2 className="text-xl font-semibold mb-4">Review Your Order</h2>

                    {/* Contact Summary */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-medium">Contact</h3>
                        <Button variant="ghost" size="sm" onClick={() => setCurrentStep(1)}>
                          Edit
                        </Button>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {formData.firstName} {formData.lastName}<br />
                        {formData.email}<br />
                        {formData.phone}
                      </p>
                    </div>

                    <Separator />

                    {/* Delivery Summary */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-medium">Delivery Address</h3>
                        <Button variant="ghost" size="sm" onClick={() => setCurrentStep(2)}>
                          Edit
                        </Button>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {formData.street}
                        {formData.apartment && `, ${formData.apartment}`}<br />
                        {formData.city}, {formData.state} {formData.zip}
                      </p>
                      {formData.deliveryNotes && (
                        <p className="text-sm text-muted-foreground mt-2">
                          Notes: {formData.deliveryNotes}
                        </p>
                      )}
                    </div>

                    <Separator />

                    {/* Payment Summary */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-medium">Payment</h3>
                        <Button variant="ghost" size="sm" onClick={() => setCurrentStep(3)}>
                          Edit
                        </Button>
                      </div>
                      <p className="text-sm text-muted-foreground capitalize">
                        {formData.paymentMethod === 'cash' ? 'Cash on Delivery' : formData.paymentMethod}
                      </p>
                    </div>

                    <Separator />

                    {/* Terms */}
                    <div className="flex items-start gap-2">
                      <Checkbox
                        id="terms"
                        checked={agreeToTerms}
                        onCheckedChange={(checked) => setAgreeToTerms(checked as boolean)}
                      />
                      <Label htmlFor="terms" className="text-sm text-muted-foreground">
                        I agree to the terms and conditions and confirm that my order details are correct.
                      </Label>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Navigation Buttons */}
              <div className="flex justify-between mt-8">
                {currentStep > 1 ? (
                  <Button variant="outline" onClick={prevStep}>
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back
                  </Button>
                ) : (
                  <Link to={`/shop/${storeSlug}/cart`}>
                    <Button variant="outline">
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Back to Cart
                    </Button>
                  </Link>
                )}

                {currentStep < 4 ? (
                  <Button
                    onClick={nextStep}
                    style={{ backgroundColor: store.primary_color }}
                  >
                    Continue
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                ) : (
                  <Button
                    onClick={handlePlaceOrder}
                    disabled={placeOrderMutation.isPending}
                    style={{ backgroundColor: store.primary_color }}
                  >
                    {placeOrderMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        {/* Dynamic Button Text based on Status */}
                        {isStoreClosed ? (
                          <>
                            <Clock className="w-4 h-4 mr-2" />
                            Place Pre-Order
                          </>
                        ) : (
                          <>
                            <Check className="w-4 h-4 mr-2" />
                            Place Order
                          </>
                        )}
                      </>
                    )}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Order Summary Sidebar */}
        <div>
          <Card className="sticky top-24">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5" />
                Order Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Items */}
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {cartItems.map((item) => (
                  <div key={item.productId} className="flex gap-3">
                    <div className="w-12 h-12 flex-shrink-0 bg-muted rounded overflow-hidden">
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="w-5 h-5 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium line-clamp-1">{item.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Qty: {item.quantity} × {formatCurrency(item.price)}
                      </p>
                    </div>
                    <p className="text-sm font-medium">
                      {formatCurrency(item.price * item.quantity)}
                    </p>
                  </div>
                ))}
              </div>

              <Separator />

              {/* Loyalty Points Redemption */}
              {store?.id && formData.email && (
                <CheckoutLoyalty
                  storeId={store.id}
                  customerEmail={formData.email}
                  orderSubtotal={subtotal}
                  onPointsRedeemed={(discount, points) => {
                    setLoyaltyDiscount(discount);
                    setLoyaltyPointsUsed(points);
                  }}
                  onPointsRemoved={() => {
                    setLoyaltyDiscount(0);
                    setLoyaltyPointsUsed(0);
                  }}
                  redeemedPoints={loyaltyPointsUsed}
                  redeemedDiscount={loyaltyDiscount}
                />
              )}

              {/* Totals */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Delivery</span>
                  <span>
                    {deliveryFee === 0 ? (
                      <Badge variant="secondary" className="bg-green-100 text-green-700">
                        FREE
                      </Badge>
                    ) : (
                      formatCurrency(deliveryFee)
                    )}
                  </span>
                </div>
                {loyaltyDiscount > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Loyalty Discount</span>
                    <span>-{formatCurrency(loyaltyDiscount)}</span>
                  </div>
                )}
                {dealsDiscount > 0 && (
                  <div className="space-y-1">
                    {appliedDeals.map(({ deal, discountAmount }) => (
                      <div key={deal.id} className="flex justify-between text-sm text-blue-600">
                        <span>{deal.name}</span>
                        <span>-{formatCurrency(discountAmount)}</span>
                      </div>
                    ))}
                  </div>
                )}
                {roundingAdjustment !== 0 && (
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Rounding Adjustment</span>
                    <span>{roundingAdjustment > 0 ? '+' : ''}{formatCurrency(roundingAdjustment)}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between text-lg font-bold">
                  <span>Total</span>
                  <span style={{ color: store.primary_color }}>{formatCurrency(total)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}





