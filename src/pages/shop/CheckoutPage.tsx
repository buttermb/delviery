/**
 * Checkout Page
 * Multi-step checkout flow
 */

import { useState, useEffect } from 'react';
import { Link, useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useShop } from './ShopLayout';
import { useLuxuryTheme } from '@/components/shop/luxury';
import { useShopCart } from '@/hooks/useShopCart';
import { useDeals } from '@/hooks/useDeals';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
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
  Loader2,
  ChevronUp,
  ChevronDown
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { CheckoutAddressAutocomplete } from '@/components/shop/CheckoutAddressAutocomplete';
import ExpressPaymentButtons from '@/components/shop/ExpressPaymentButtons';
import { CheckoutLoyalty } from '@/components/shop/CheckoutLoyalty';
import { useStoreStatus } from '@/hooks/useStoreStatus';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Clock, Ban, Tag } from 'lucide-react';
import { isCustomerBlockedByEmail, FLAG_REASON_LABELS } from '@/hooks/useCustomerFlags';

// Email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Phone validation - accepts formats: (555) 123-4567, 555-123-4567, 5551234567, +1 555-123-4567
const PHONE_REGEX = /^[\+]?[(]?[0-9]{1,3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/;

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

// Extended store properties beyond base StoreInfo type
interface DeliveryZone {
  zip_code: string;
  fee?: number;
  min_order?: number;
}

interface PurchaseLimits {
  enabled?: boolean;
  max_per_order?: number;
  max_daily?: number;
  max_weekly?: number;
}

interface GiftCardValidationResult {
  is_valid: boolean;
  current_balance: number;
  message: string;
}

interface OrderResult {
  order_id: string;
  order_number: string;
  tracking_token?: string;
  total?: number;
}

// Helper type for calling untyped Supabase RPCs
type SupabaseRpc = (name: string, params: Record<string, unknown>) => Promise<{ data: unknown; error: { message?: string; code?: string } | null }>;

const STEPS = [
  { id: 1, name: 'Contact', icon: User },
  { id: 2, name: 'Delivery', icon: MapPin },
  { id: 3, name: 'Payment', icon: CreditCard },
  { id: 4, name: 'Review', icon: Check },
];

export function CheckoutPage() {
  const { storeSlug } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { store, setCartItemCount } = useShop();
  const { isLuxuryTheme, accentColor, cardBg, cardBorder, textPrimary, textMuted, inputBg, inputBorder, inputText } = useLuxuryTheme();
  // Check store status
  const { data: storeStatus } = useStoreStatus(store?.id);
  const isStoreClosed = storeStatus?.isOpen === false;

  // Handle cancelled Stripe checkout return
  useEffect(() => {
    if (searchParams.get('cancelled') === 'true') {
      toast('Payment cancelled', {
        description: 'Your payment was not completed. You can try again or choose a different payment method.',
      });
      // Remove the cancelled param from URL without navigation
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('cancelled');
      window.history.replaceState({}, '', `${window.location.pathname}${newParams.toString() ? '?' + newParams.toString() : ''}`);
    }
  }, [searchParams]);

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
  const [, setOrderRetryCount] = useState(0);

  // Idempotency key to prevent double orders on retry
  const [idempotencyKey] = useState(() => `order_${crypto.randomUUID()}`);

  // Express Checkout for returning customers
  const [hasSavedData, setHasSavedData] = useState(false);

  // Loyalty points state
  const [loyaltyDiscount, setLoyaltyDiscount] = useState(0);
  const [loyaltyPointsUsed, setLoyaltyPointsUsed] = useState(0);

  // Mobile order summary toggle
  const [mobileSummaryExpanded, setMobileSummaryExpanded] = useState(false);

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
          // Check if we have enough saved data for express checkout
          if (parsed.firstName && parsed.lastName && parsed.email && parsed.street && parsed.city && parsed.zip) {
            setHasSavedData(true);
          }
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

  // Use unified cart hook with coupon support
  const {
    cartItems,
    cartCount,
    subtotal,
    isInitialized,
    applyCoupon,
    appliedCoupon,
    removeCoupon,
    getCouponDiscount,
    validateCart
  } = useShopCart({
    storeId: store?.id,
    onCartChange: setCartItemCount,
  });

  // Coupon state
  const [couponCode, setCouponCode] = useState('');
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);

  // Redirect to cart if empty
  useEffect(() => {
    if (isInitialized && cartItems.length === 0) {
      toast('Your cart is empty', { description: 'Add some items before checkout.' });
      navigate(`/shop/${storeSlug}/cart`);
    }
  }, [isInitialized, cartItems.length, navigate, storeSlug]);

  // Validate cart on mount
  useEffect(() => {
    if (isInitialized && cartItems.length > 0 && store?.id) {
      validateCart();
    }
  }, [isInitialized, cartItems.length, store?.id]);

  // Fetch and calculate active deals
  const { totalDiscount: dealsDiscount } = useDeals(store?.id, cartItems, formData.email || undefined);

  // Apply coupon handler
  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return;
    setIsApplyingCoupon(true);
    setCouponError(null);

    const result = await applyCoupon(couponCode.trim(), subtotal);

    if (result.success) {
      toast.success('Coupon applied!', { description: `Saved ${formatCurrency(result.coupon?.calculated_discount || 0)}` });
      setCouponCode('');
    } else {
      setCouponError(result.error || 'Invalid coupon');
      toast.error('Invalid coupon', { description: result.error || 'This coupon cannot be applied.' });
    }
    setIsApplyingCoupon(false);
  };

  // Gift Cards
  const { appliedGiftCards, applyGiftCard, removeGiftCard, getGiftCardTotal } = useShopCart({
    storeId: store?.id,
  });
  const [giftCardCode, setGiftCardCode] = useState('');
  const [isCheckingGiftCard, setIsCheckingGiftCard] = useState(false);

  // Handle Gift Card Application
  const handleApplyGiftCard = async () => {
    if (!giftCardCode.trim() || !store?.id) return;
    setIsCheckingGiftCard(true);

    try {
      const { data, error } = await (supabase.rpc as unknown as SupabaseRpc)('validate_marketplace_gift_card', {
        p_store_id: store.id,
        p_code: giftCardCode.trim()
      });

      if (error) throw error;

      const giftCardResults = data as unknown as GiftCardValidationResult[] | null;
      if (giftCardResults && giftCardResults.length > 0) {
        const card = giftCardResults[0];
        if (card.is_valid) {
          applyGiftCard({
            code: giftCardCode.trim(),
            balance: card.current_balance
          });
          setGiftCardCode('');
          toast.success('Gift card applied!', { description: `Balance: $${card.current_balance}` });
        } else {
          toast.error('Invalid card', { description: card.message });
        }
      } else {
        toast.error('Invalid card', { description: 'Card not found' });
      }
    } catch {
      toast.error('Failed to validate gift card', { description: 'Please check the card number and try again.' });
    } finally {
      setIsCheckingGiftCard(false);
    }
  };

  // Get delivery fee based on zip code (from delivery zones or default)
  const getDeliveryFee = () => {
    if (subtotal >= (store?.free_delivery_threshold || 100)) return 0;

    // Check if zip matches a delivery zone
    const deliveryZones: DeliveryZone[] = ((store as unknown as { delivery_zones?: DeliveryZone[] })?.delivery_zones) || [];
    const matchingZone = deliveryZones.find((zone) => zone.zip_code === formData.zip);

    if (matchingZone) {
      return matchingZone.fee || store?.default_delivery_fee || 5;
    }

    // Fall back to default delivery fee
    return store?.default_delivery_fee || 5;
  };

  // Calculate totals
  const deliveryFee = getDeliveryFee();
  const couponDiscount = getCouponDiscount(subtotal);
  const freeShipping = appliedCoupon?.free_shipping === true;
  const effectiveDeliveryFee = freeShipping ? 0 : deliveryFee;
  const rawTotal = Math.max(0, subtotal + effectiveDeliveryFee - loyaltyDiscount - dealsDiscount - couponDiscount);

  // Cart rounding: round to nearest dollar if enabled
  const enableCartRounding = (store as unknown as { enable_cart_rounding?: boolean })?.enable_cart_rounding === true;
  const totalBeforeGiftCards = enableCartRounding ? Math.round(rawTotal) : rawTotal;
  const roundingAdjustment = enableCartRounding ? (totalBeforeGiftCards - rawTotal) : 0;

  // Calculate Gift Card Deductions
  const giftCardAmount = getGiftCardTotal(totalBeforeGiftCards);
  const total = Math.max(0, totalBeforeGiftCards - giftCardAmount);

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
          toast.error('Please fill in all required fields');
          return false;
        }
        if (!EMAIL_REGEX.test(formData.email)) {
          toast.error('Invalid email address', { description: 'Please enter a valid email.' });
          return false;
        }
        if (store?.checkout_settings?.require_phone && !formData.phone) {
          toast.error('Phone number is required');
          return false;
        }
        // Validate phone format if provided
        if (formData.phone && !PHONE_REGEX.test(formData.phone.replace(/\s/g, ''))) {
          toast.error('Invalid phone number', { description: 'Please enter a valid phone number.' });
          return false;
        }
        return true;
      case 2:
        if (!formData.street || !formData.city || !formData.zip) {
          toast.error('Please fill in your delivery address');
          return false;
        }
        // Validate delivery zone if zones are configured
        const deliveryZones: DeliveryZone[] = ((store as unknown as { delivery_zones?: DeliveryZone[] })?.delivery_zones) || [];
        if (deliveryZones.length > 0) {
          const matchingZone = deliveryZones.find((zone) => zone.zip_code === formData.zip);
          if (!matchingZone) {
            toast.error('Delivery not available', {
              description: `We don't currently deliver to zip code ${formData.zip}. Please try a different address.`,
            });
            return false;
          }
          // Check minimum order if zone has one
          if (matchingZone.min_order && subtotal < matchingZone.min_order) {
            toast.error('Minimum order not met', {
              description: `This delivery zone requires a minimum order of $${matchingZone.min_order}.`,
            });
            return false;
          }
        }
        return true;
      case 3:
        if (!formData.paymentMethod) {
          toast.error('Please select a payment method');
          return false;
        }
        return true;
      case 4:
        if (!agreeToTerms) {
          toast.error('Please agree to the terms to continue');
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
  const placeOrderMutation = useMutation({
    mutationFn: async () => {
      if (!store?.id) throw new Error('No store');

      // Check if customer is blocked from ordering
      if (formData.email && store.tenant_id) {
        const blockStatus = await isCustomerBlockedByEmail(store.tenant_id, formData.email);
        if (blockStatus.isBlocked) {
          const reasonLabel = blockStatus.flagReason ? FLAG_REASON_LABELS[blockStatus.flagReason] : 'Account Issue';
          throw new Error(
            `Your account has been restricted from placing orders. Reason: ${reasonLabel}. ` +
            `Please contact the store for assistance.`
          );
        }
      }

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
      const purchaseLimits = (store as unknown as { purchase_limits?: PurchaseLimits })?.purchase_limits;
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
          // Get customer's recent orders from storefront_orders table
          const weekAgo = new Date();
          weekAgo.setDate(weekAgo.getDate() - 7);

          const { data: recentOrders, error: ordersError } = await supabase
            .from('storefront_orders')
            .select('total, created_at')
            .eq('store_id', store.id)
            .eq('customer_email', formData.email)
            .gte('created_at', weekAgo.toISOString())
            .neq('status', 'cancelled');

          if (!ordersError && recentOrders) {
            const today = new Date().toISOString().split('T')[0];
            const orders = recentOrders as { total: number | null; created_at: string | null }[];

            // Calculate daily spending
            const dailyTotal = orders
              .filter(o => o.created_at?.startsWith(today))
              .reduce((sum, o) => sum + (o.total || 0), 0);

            // Calculate weekly spending
            const weeklyTotal = orders.reduce((sum, o) => sum + (o.total || 0), 0);

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

      // Calculate gift card usage for RPC
      // Attempt to place order with retries
      // Attempt to place order with retries
      const attemptOrder = async (attempt: number): Promise<OrderResult> => {
        try {
          if (!store?.id) throw new Error('Store ID missing');

          // Session ID for reservation (using guest email or random string if not available yet)
          const sessionId = formData.email || `guest_${Date.now()}`;

          // Skip inventory reservation if the RPC doesn't match expected signature
          // The existing reserve_inventory uses (p_menu_id, p_items) not per-product calls

          // 1. Create Order using the actual function signature
          const deliveryAddress = `${formData.street}${formData.apartment ? ', ' + formData.apartment : ''}, ${formData.city}, ${formData.state} ${formData.zip}`;

          const { data: orderId, error: orderError } = await supabase
            .rpc('create_marketplace_order', {
              p_store_id: store.id,
              p_customer_name: `${formData.firstName} ${formData.lastName}`,
              p_customer_email: formData.email,
              p_customer_phone: formData.phone || undefined,
              p_delivery_address: deliveryAddress,
              p_delivery_notes: formData.deliveryNotes || undefined,
              p_items: cartItems.map(item => ({
                product_id: item.productId,
                quantity: item.quantity,
                price: item.price,
                variant: item.variant
              })),
              p_subtotal: subtotal,
              p_tax: 0,
              p_delivery_fee: effectiveDeliveryFee,
              p_total: total,
              p_payment_method: formData.paymentMethod,
              p_idempotency_key: idempotencyKey // Prevent double orders on retry
            });

          if (orderError) {
            // Handle case where RPC function doesn't exist - don't retry
            if (orderError.message?.includes('function') || orderError.code === '42883') {
              throw new Error('Order system is not configured. Please contact the store.');
            }
            throw orderError;
          }

          if (!orderId) throw new Error('Failed to create order');

          // 2. Complete Reservations
          await (supabase.rpc as unknown as SupabaseRpc)('complete_reservation', {
            p_session_id: sessionId,
            p_order_id: orderId
          });

          // 3. Redeem Coupon
          if (appliedCoupon?.coupon_id) {
            await (supabase.rpc as unknown as SupabaseRpc)('redeem_coupon', { p_coupon_id: appliedCoupon.coupon_id });
          }

          // 4. Fetch order details (tracking token, order number, total)
          const { data: orderRow } = await supabase
            .from('storefront_orders')
            .select('order_number, tracking_token, total')
            .eq('id', orderId as string)
            .maybeSingle();

          return {
            order_id: orderId as string,
            order_number: (orderRow?.order_number as string) || (orderId as string),
            tracking_token: (orderRow?.tracking_token as string) || undefined,
            total: (orderRow?.total as number) || undefined,
          };

        } catch (err: unknown) {
          const errMessage = err instanceof Error ? err.message : String(err);
          const isNetworkError =
            errMessage.toLowerCase().includes('network') ||
              errMessage.toLowerCase().includes('fetch') ||
              errMessage.toLowerCase().includes('timeout') ||
              errMessage.toLowerCase().includes('failed to fetch');

          // Retry on network errors
          if (isNetworkError && attempt < 3) { // Hardcoded 3 for simplicity or import constant
            setOrderRetryCount(attempt);
            toast(`Connection issue, retrying (${attempt}/3)...`);
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
            product_id: item.productId,
            name: item.name,
            quantity: item.quantity,
            image_url: item.imageUrl,
          }));

          const origin = window.location.origin;
          const trackingParam = data.tracking_token ? `&token=${data.tracking_token}` : '';
          const successUrl = `${origin}/shop/${storeSlug}/order-confirmation?order=${data.order_id}${trackingParam}&total=${total}&session_id={CHECKOUT_SESSION_ID}`;
          const cancelUrl = `${origin}/shop/${storeSlug}/checkout?cancelled=true`;

          // Calculate total discount applied (coupon + loyalty + deals)
          const totalDiscountAmount = couponDiscount + loyaltyDiscount + dealsDiscount;

          const response = await supabase.functions.invoke('storefront-checkout', {
            body: {
              store_id: store.id,
              order_id: data.order_id,
              items: checkoutItems,
              customer_email: formData.email,
              customer_name: `${formData.firstName} ${formData.lastName}`,
              subtotal,
              delivery_fee: effectiveDeliveryFee,
              discount_amount: totalDiscountAmount,
              success_url: successUrl,
              cancel_url: cancelUrl,
            },
          });

          if (response.error) {
            throw new Error(response.error.message || 'Payment initialization failed');
          }

          const { url } = response.data;
          if (url) {
            // Clear cart before redirecting to Stripe (order already created)
            localStorage.removeItem(`shop_cart_${store.id}`);
            if (formStorageKey) {
              localStorage.removeItem(formStorageKey);
            }
            setCartItemCount(0);
            // Redirect to Stripe checkout
            window.location.href = url;
            return;
          }
        } catch (stripeError: unknown) {
          logger.error('Stripe checkout error', stripeError, { component: 'CheckoutPage' });
          const stripeErrMsg = stripeError instanceof Error ? stripeError.message : 'Unable to initialize payment. Please try again or choose a different payment method.';
          toast.error('Payment setup failed', {
            description: stripeErrMsg,
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
          tracking_url: data.tracking_token ? `${origin}/shop/${storeSlug}/order-tracking?token=${data.tracking_token}` : undefined,
        },
      }).catch((err) => {
        logger.warn('Failed to send order confirmation email', err, { component: 'CheckoutPage' });
        toast.warning('Order placed, but confirmation email could not be sent');
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
    onError: (error: Error) => {
      setOrderRetryCount(0);
      logger.error('Failed to place order', error, { component: 'CheckoutPage' });

      const errorMessage = error.message || 'Something went wrong. Please try again.';
      const isNetworkError = errorMessage.toLowerCase().includes('network') ||
        errorMessage.toLowerCase().includes('fetch') ||
        errorMessage.toLowerCase().includes('timeout');

      toast.error('Order failed', {
        description: isNetworkError
          ? 'Network connection issue. Check your connection and try again.'
          : errorMessage,
        action: {
          label: 'Retry',
          onClick: () => handlePlaceOrder(),
        },
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
    <div className={`container mx-auto px-4 py-8 max-w-5xl ${isLuxuryTheme ? 'min-h-dvh' : ''}`}>
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
                  <div className={`absolute top-4 sm:top-5 left-[calc(50%+16px)] sm:left-[calc(50%+20px)] w-[calc(100%-32px)] sm:w-[calc(100%-40px)] h-[2px] ${isLuxuryTheme ? 'bg-white/5' : 'bg-muted'}`}>
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
                  className={`relative w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center z-10 transition-all duration-300 ${isActive ? 'ring-2 ring-offset-2 sm:ring-offset-4 ring-offset-background scale-110' : ''
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
                    <Check className="w-4 h-4 sm:w-5 sm:h-5" />
                  ) : (
                    <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
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
                  className={`text-[10px] sm:text-xs uppercase tracking-wide sm:tracking-widest mt-2 sm:mt-4 font-semibold transition-colors duration-300 ${isActive ? 'text-primary' : (isLuxuryTheme ? 'text-white/20' : 'text-muted-foreground')
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

      {/* Mobile Order Summary - Collapsible (visible only on mobile) */}
      <div className="lg:hidden mb-6">
        <button
          onClick={() => setMobileSummaryExpanded(!mobileSummaryExpanded)}
          className={`w-full p-4 rounded-lg border flex items-center justify-between transition-colors ${isLuxuryTheme
            ? 'bg-white/5 border-white/10 text-white'
            : 'bg-muted/50 border-border'
            }`}
        >
          <div className="flex items-center gap-3">
            <ShoppingCart className="w-5 h-5" style={{ color: themeColor }} />
            <span className="font-medium">
              {cartCount} {cartCount === 1 ? 'item' : 'items'}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-bold" style={{ color: themeColor }}>
              {formatCurrency(total)}
            </span>
            {mobileSummaryExpanded ? (
              <ChevronUp className="w-5 h-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-5 h-5 text-muted-foreground" />
            )}
          </div>
        </button>

        <AnimatePresence>
          {mobileSummaryExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className={`p-4 mt-2 rounded-lg border space-y-3 ${isLuxuryTheme ? 'bg-white/5 border-white/10' : 'bg-card border-border'
                }`}>
                {/* Cart Items */}
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {cartItems.map((item) => (
                    <div key={item.productId} className="flex items-center justify-between text-sm">
                      <span className={`truncate max-w-[60%] ${isLuxuryTheme ? 'text-white/80' : ''}`}>
                        {item.quantity}× {item.name}
                      </span>
                      <span className={isLuxuryTheme ? 'text-white/60' : 'text-muted-foreground'}>
                        {formatCurrency(item.price * item.quantity)}
                      </span>
                    </div>
                  ))}
                </div>

                <Separator className={isLuxuryTheme ? 'bg-white/10' : ''} />

                {/* Summary */}
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className={isLuxuryTheme ? 'text-white/60' : 'text-muted-foreground'}>Subtotal</span>
                    <span className={isLuxuryTheme ? 'text-white' : ''}>{formatCurrency(subtotal)}</span>
                  </div>
                  {effectiveDeliveryFee > 0 && (
                    <div className="flex justify-between">
                      <span className={isLuxuryTheme ? 'text-white/60' : 'text-muted-foreground'}>Delivery</span>
                      <span className={isLuxuryTheme ? 'text-white' : ''}>{formatCurrency(effectiveDeliveryFee)}</span>
                    </div>
                  )}
                  {couponDiscount > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Discount</span>
                      <span>-{formatCurrency(couponDiscount)}</span>
                    </div>
                  )}
                </div>

                <Separator className={isLuxuryTheme ? 'bg-white/10' : ''} />

                <div className="flex justify-between font-bold">
                  <span className={isLuxuryTheme ? 'text-white' : ''}>Total</span>
                  <span style={{ color: themeColor }}>{formatCurrency(total)}</span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
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

          {/* Express Checkout for Returning Customers */}
          {hasSavedData && currentStep < 3 && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`mb-6 p-4 rounded-lg border ${isLuxuryTheme ? 'bg-white/5 border-white/10' : 'bg-primary/5 border-primary/20'}`}
            >
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-full ${isLuxuryTheme ? 'bg-white/10' : 'bg-primary/10'}`}>
                    <Check className={`w-4 h-4 ${isLuxuryTheme ? 'text-white' : 'text-primary'}`} />
                  </div>
                  <div>
                    <p className={`font-medium text-sm ${isLuxuryTheme ? 'text-white' : ''}`}>
                      Welcome back, {formData.firstName}!
                    </p>
                    <p className={`text-xs ${isLuxuryTheme ? 'text-white/60' : 'text-muted-foreground'}`}>
                      Your info is saved. Ready to checkout?
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => setCurrentStep(3)}
                  style={{ backgroundColor: themeColor }}
                  className="text-white"
                >
                  <ArrowRight className="w-4 h-4 mr-2" />
                  Express Checkout
                </Button>
              </div>
            </motion.div>
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
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              <div className="flex flex-col-reverse sm:flex-row justify-between gap-3 mt-8">
                {currentStep > 1 ? (
                  <Button variant="outline" onClick={prevStep} className="w-full sm:w-auto">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back
                  </Button>
                ) : (
                  <Link to={`/shop/${storeSlug}/cart`} className="w-full sm:w-auto">
                    <Button variant="outline" className="w-full sm:w-auto">
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Back to Cart
                    </Button>
                  </Link>
                )}

                {currentStep < 4 ? (
                  <Button
                    onClick={nextStep}
                    style={{ backgroundColor: store.primary_color }}
                    className="w-full sm:w-auto"
                  >
                    Continue
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                ) : (
                  <Button
                    onClick={handlePlaceOrder}
                    disabled={placeOrderMutation.isPending}
                    style={{ backgroundColor: store.primary_color }}
                    className="w-full sm:w-auto"
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

        {/* Order Summary Sidebar — hidden on mobile (collapsible summary above) */}
        <div className="hidden lg:block">
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
            </CardContent>
          </Card>

          {/* Order Summary — also hidden on mobile */}
          <Card className={isLuxuryTheme ? `${cardBg} ${cardBorder}` : ''}>
            <CardHeader>
              <CardTitle className={isLuxuryTheme ? 'text-white font-light' : ''}>Order Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Coupon Code Input */}
              {!appliedCoupon ? (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Coupon code"
                      value={couponCode}
                      onChange={(e) => { setCouponCode(e.target.value); setCouponError(null); }}
                      onKeyDown={(e) => e.key === 'Enter' && handleApplyCoupon()}
                      className={isLuxuryTheme ? `${inputBg} ${inputBorder} ${inputText}` : ''}
                    />
                    <Button
                      variant="outline"
                      onClick={handleApplyCoupon}
                      disabled={isApplyingCoupon || !couponCode.trim()}
                      className={isLuxuryTheme ? 'border-white/10 hover:bg-white/10 text-white' : ''}
                    >
                      {isApplyingCoupon ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Apply'}
                    </Button>
                  </div>
                  {couponError && (
                    <p className="text-xs text-red-500">{couponError}</p>
                  )}
                </div>
              ) : (
                <div className={`flex items-center justify-between p-3 rounded-lg ${isLuxuryTheme ? 'bg-green-500/10' : 'bg-green-50'}`}>
                  <div className="flex items-center gap-2">
                    <Tag className={`w-4 h-4 ${isLuxuryTheme ? 'text-green-400' : 'text-green-600'}`} />
                    <span className={`text-sm font-medium ${isLuxuryTheme ? 'text-green-400' : 'text-green-600'}`}>
                      {appliedCoupon.code}
                    </span>
                    <span className={`text-xs ${isLuxuryTheme ? 'text-green-400/60' : 'text-green-500'}`}>
                      (-{formatCurrency(couponDiscount)})
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { removeCoupon(); toast('Coupon removed'); }}
                    className={isLuxuryTheme ? 'text-red-400 hover:text-red-300 hover:bg-white/5' : 'text-red-500 hover:text-red-600'}
                  >
                    Remove
                  </Button>
                </div>
              )}

              {/* Gift Card Input */}
              <div className="flex gap-2">
                <Input
                  placeholder="Gift Card Code"
                  value={giftCardCode}
                  onChange={(e) => setGiftCardCode(e.target.value.toUpperCase())}
                  className={isLuxuryTheme ? `${inputBg} ${inputBorder} ${inputText}` : ''}
                />
                <Button
                  variant="outline"
                  onClick={handleApplyGiftCard}
                  disabled={isCheckingGiftCard || !giftCardCode.trim()}
                  className={isLuxuryTheme ? 'border-white/10 hover:bg-white/10 text-white' : ''}
                >
                  {isCheckingGiftCard ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Apply'}
                </Button>
              </div>

              {/* Applied Gift Cards */}
              {appliedGiftCards.length > 0 && (
                <div className="space-y-2">
                  {appliedGiftCards.map(card => (
                    <div key={card.code} className={`flex items-center justify-between p-2 rounded text-sm ${isLuxuryTheme ? 'bg-white/5' : 'bg-muted/50'}`}>
                      <div className="flex items-center gap-2">
                        <CreditCard className="w-3 h-3 text-emerald-500" />
                        <span className="font-mono">{card.code}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-emerald-500">-{formatCurrency(Math.min(card.balance, totalBeforeGiftCards))}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-muted-foreground hover:text-destructive"
                          onClick={() => removeGiftCard(card.code)}
                        >
                          <ArrowLeft className="w-3 h-3 rotate-45" /> {/* Use X icon if available, iterating quickly */}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <Separator className={isLuxuryTheme ? 'bg-white/5' : ''} />

              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className={textMuted}>Subtotal</span>
                  <span className={isLuxuryTheme ? textPrimary : ''}>{formatCurrency(subtotal)}</span>
                </div>
                {deliveryFee > 0 && (
                  <div className="flex justify-between">
                    <span className={textMuted}>Delivery</span>
                    <span className={isLuxuryTheme ? textPrimary : ''}>{formatCurrency(deliveryFee)}</span>
                  </div>
                )}
                {dealsDiscount > 0 && (
                  <div className="flex justify-between text-green-500">
                    <span>Deals & Discounts</span>
                    <span>-{formatCurrency(dealsDiscount)}</span>
                  </div>
                )}
                {couponDiscount > 0 && (
                  <div className="flex justify-between text-green-500">
                    <span>Coupon</span>
                    <span>-{formatCurrency(couponDiscount)}</span>
                  </div>
                )}
                {loyaltyDiscount > 0 && (
                  <div className="flex justify-between text-green-500">
                    <span>Loyalty Points</span>
                    <span>-{formatCurrency(loyaltyDiscount)}</span>
                  </div>
                )}
                {enableCartRounding && roundingAdjustment !== 0 && (
                  <div className="flex justify-between text-blue-500 text-sm">
                    <span>Rounding Adjustment</span>
                    <span>{roundingAdjustment > 0 ? '+' : ''}{formatCurrency(roundingAdjustment)}</span>
                  </div>
                )}
                {giftCardAmount > 0 && (
                  <div className="flex justify-between text-emerald-500 font-medium">
                    <span>Gift Card</span>
                    <span>-{formatCurrency(giftCardAmount)}</span>
                  </div>
                )}
                <Separator className={isLuxuryTheme ? 'bg-white/5' : ''} />
                <div className="flex justify-between text-lg font-bold">
                  <span className={isLuxuryTheme ? textPrimary : ''}>Total</span>
                  <span style={{ color: themeColor }}>{formatCurrency(total)}</span>
                </div>
              </div>

              {/* Only show Payment method step if total > 0 */}
              {total === 0 && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-center">
                  <p className="text-emerald-500 font-medium text-sm">Order fully covered by Gift Card</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Sticky Mobile Checkout Bar */}
      <div className="fixed bottom-0 left-0 right-0 lg:hidden bg-background/95 backdrop-blur-md border-t p-4 z-50">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground">Order Total</p>
            <p className="text-lg font-bold" style={{ color: themeColor }}>{formatCurrency(total)}</p>
          </div>
          {currentStep < 4 ? (
            <Button
              onClick={nextStep}
              disabled={placeOrderMutation.isPending}
              style={{ backgroundColor: themeColor }}
              className="flex-1 max-w-[180px] text-white"
            >
              Continue
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          ) : (
            <Button
              onClick={handlePlaceOrder}
              disabled={placeOrderMutation.isPending || !agreeToTerms}
              style={{ backgroundColor: themeColor }}
              className="flex-1 max-w-[180px] text-white"
            >
              {placeOrderMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                'Place Order'
              )}
            </Button>
          )}
        </div>
      </div>
      {/* Spacer for mobile sticky bar */}
      <div className="h-24 lg:hidden" />
    </div>
  );
}

export default CheckoutPage;
