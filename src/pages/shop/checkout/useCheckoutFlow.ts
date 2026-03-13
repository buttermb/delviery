/**
 * useCheckoutFlow Hook
 * Step navigation, form state, order submission, and all checkout logic
 */

import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';

import type { CheckoutData, DeliveryZone, PurchaseLimits, GiftCardValidationResult, OrderResult, UnavailableProduct } from './types';
import { EMAIL_REGEX, PHONE_REGEX, INITIAL_FORM_DATA, OutOfStockError } from './types';
import type { SupabaseRpc } from './types';

import { supabase } from '@/integrations/supabase/client';
import { useShop } from '../ShopLayout';
import { useShopCart } from '@/hooks/useShopCart';
import { useDeals } from '@/hooks/useDeals';
import { useStoreStatus } from '@/hooks/useStoreStatus';
import { useReturningCustomerLookup } from '@/hooks/useReturningCustomerLookup';
import { useStripePreconnect } from '@/hooks/useStripePreconnect';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import { formatCurrency } from '@/lib/formatters';
import { isCustomerBlockedByEmail, FLAG_REASON_LABELS } from '@/hooks/useCustomerFlags';
import { humanizeError } from '@/lib/humanizeError';
import { STORAGE_KEYS } from '@/constants/storageKeys';
import { safeStorage } from '@/utils/safeStorage';
import { queryKeys } from '@/lib/queryKeys';

export function useCheckoutFlow() {
  const { storeSlug } = useParams<{ storeSlug: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { store, setCartItemCount } = useShop();

  // Check store status
  const { data: storeStatus } = useStoreStatus(store?.id);
  const isStoreClosed = storeStatus?.isOpen === false;

  // Check if Stripe is configured
  const { data: isStripeConfigured } = useQuery({
    queryKey: queryKeys.marketplaceStores.stripeConfigured(store?.id),
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as unknown as SupabaseRpc)(
        'is_store_stripe_configured',
        { p_store_id: store!.id }
      );
      if (error) return false;
      return Boolean(data);
    },
    enabled: !!store?.id,
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });

  // Preconnect to Stripe when card payment is available
  useStripePreconnect(isStripeConfigured === true);

  // Handle cancelled Stripe checkout return
  useEffect(() => {
    if (searchParams.get('cancelled') === 'true') {
      toast.warning('Payment cancelled', {
        description: 'Your payment was not completed. You can try again or choose a different payment method.',
      });
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('cancelled');
      window.history.replaceState({}, '', `${window.location.pathname}${newParams.toString() ? '?' + newParams.toString() : ''}`);
    }
  }, [searchParams]);

  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<CheckoutData>({ ...INITIAL_FORM_DATA });
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [venmoConfirmed, setVenmoConfirmed] = useState(false);
  const [zelleConfirmed, setZelleConfirmed] = useState(false);
  const [createAccount, setCreateAccount] = useState(false);
  const [accountPassword, setAccountPassword] = useState('');
  const [showErrors, setShowErrors] = useState(false);
  const [, setOrderRetryCount] = useState(0);

  // Fast double-click guard
  const isSubmittingRef = useRef(false);

  // Idempotency key persisted to sessionStorage
  const [idempotencyKey] = useState(() => {
    const storageKey = `checkout_idempotency_${storeSlug || ''}`;
    const existing = sessionStorage.getItem(storageKey);
    if (existing) return existing;
    const newKey = `order_${crypto.randomUUID()}`;
    sessionStorage.setItem(storageKey, newKey);
    return newKey;
  });

  // Express Checkout for returning customers
  const [hasSavedData, setHasSavedData] = useState(false);

  // Loyalty points state
  const [loyaltyDiscount, setLoyaltyDiscount] = useState(0);
  const [loyaltyPointsUsed, setLoyaltyPointsUsed] = useState(0);

  // Mobile order summary toggle
  const [mobileSummaryExpanded, setMobileSummaryExpanded] = useState(false);

  // Form persistence key
  const formStorageKey = store?.id ? `${STORAGE_KEYS.SHOP_CHECKOUT_FORM_PREFIX}${store.id}` : null;

  // Load saved form data on mount
  useEffect(() => {
    if (formStorageKey) {
      try {
        const saved = safeStorage.getItem(formStorageKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          setFormData((prev) => ({ ...prev, ...parsed }));
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
        safeStorage.setItem(formStorageKey, JSON.stringify(formData));
      } catch {
        // Ignore storage errors
      }
    }
  }, [formData, formStorageKey]);

  // Returning customer recognition by phone
  const {
    customer: returningCustomer,
    isRecognized,
    isSearching: isLookingUpCustomer,
  } = useReturningCustomerLookup({
    phone: formData.phone,
    tenantId: store?.tenant_id,
    enabled: currentStep === 1,
  });

  // Auto-fill form when returning customer is recognized
  const lastRecognizedIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (returningCustomer && returningCustomer.customerId !== lastRecognizedIdRef.current) {
      lastRecognizedIdRef.current = returningCustomer.customerId;
      setFormData((prev) => ({
        ...prev,
        firstName: prev.firstName || returningCustomer.firstName,
        lastName: prev.lastName || returningCustomer.lastName,
        email: prev.email || returningCustomer.email || '',
        street: prev.street || returningCustomer.address || '',
        preferredContact: (returningCustomer.preferredContact as CheckoutData['preferredContact']) || prev.preferredContact,
      }));
      toast.success('Welcome back!', {
        description: `We recognized your phone number, ${returningCustomer.firstName}.`,
      });
    }
  }, [returningCustomer]);

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
    validateCart,
    syncCartPrices,
    removeItem,
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
      toast.warning('Your cart is empty', { description: 'Add some items before checkout.' });
      navigate(`/shop/${storeSlug}/cart`);
    }
  }, [isInitialized, cartItems.length, navigate, storeSlug]);

  // Validate cart and sync prices on mount
  useEffect(() => {
    if (isInitialized && cartItems.length > 0 && store?.id) {
      validateCart();
      syncCartPrices().then(result => {
        if (result.changed) {
          toast.warning('Some prices have been updated', {
            description: 'Your cart has been refreshed with the latest prices.',
          });
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- validateCart is defined below; only run when cart/store changes
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
      toast.success('Coupon applied!', { description: `Saved ${formatCurrency(result.coupon?.calculated_discount ?? 0)}` });
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
    } catch (error) {
      toast.error('Failed to validate gift card', { description: humanizeError(error) });
    } finally {
      setIsCheckingGiftCard(false);
    }
  };

  // Get delivery fee based on zip code
  const getDeliveryFee = () => {
    if (subtotal >= (store?.free_delivery_threshold || 100)) return 0;

    const deliveryZones: DeliveryZone[] = ((store as unknown as { delivery_zones?: DeliveryZone[] })?.delivery_zones) ?? [];
    const matchingZone = deliveryZones.find((zone) => zone.zip_code === formData.zip);

    if (matchingZone) {
      return matchingZone.fee || store?.default_delivery_fee || 5;
    }

    return store?.default_delivery_fee || 5;
  };

  // Calculate totals
  const deliveryFee = getDeliveryFee();
  const couponDiscount = getCouponDiscount(subtotal);
  const freeShipping = appliedCoupon?.free_shipping === true;
  const effectiveDeliveryFee = formData.fulfillmentMethod === 'pickup' ? 0 : (freeShipping ? 0 : deliveryFee);
  const rawTotal = Math.max(0, subtotal + effectiveDeliveryFee - loyaltyDiscount - dealsDiscount - couponDiscount);

  // Cart rounding
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
        if (formData.phone && !PHONE_REGEX.test(formData.phone.replace(/\s/g, ''))) {
          toast.error('Invalid phone number', { description: 'Please enter a valid phone number.' });
          return false;
        }
        if (createAccount && accountPassword.length < 8) {
          toast.error('Password too short', { description: 'Password must be at least 8 characters.' });
          return false;
        }
        return true;
      case 2: {
        if (!formData.fulfillmentMethod) {
          toast.error('Please select a fulfillment method');
          return false;
        }
        if (formData.fulfillmentMethod === 'pickup') return true;
        if (!formData.street || !formData.city || !formData.zip) {
          toast.error('Please fill in your delivery address');
          return false;
        }
        const deliveryZones: DeliveryZone[] = ((store as unknown as { delivery_zones?: DeliveryZone[] })?.delivery_zones) ?? [];
        if (deliveryZones.length > 0) {
          const matchingZone = deliveryZones.find((zone) => zone.zip_code === formData.zip);
          if (!matchingZone) {
            toast.error('Delivery not available', {
              description: `We don't currently deliver to zip code ${formData.zip}. Please try a different address.`,
            });
            return false;
          }
          if (matchingZone.min_order && subtotal < matchingZone.min_order) {
            toast.error('Minimum order not met', {
              description: `This delivery zone requires a minimum order of $${matchingZone.min_order}.`,
            });
            return false;
          }
        }
        return true;
      }
      case 3:
        if (!formData.paymentMethod) {
          toast.error('Please select a payment method');
          return false;
        }
        if (formData.paymentMethod === 'venmo' && !venmoConfirmed) {
          toast.error('Please confirm you\'ve sent payment via Venmo');
          return false;
        }
        if (formData.paymentMethod === 'zelle' && !zelleConfirmed) {
          toast.error('Please confirm you\'ve sent payment via Zelle');
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
      } else if (products) {
        const unavailable: UnavailableProduct[] = [];
        for (const item of cartItems) {
          const product = products.find((p) => p.id === item.productId);
          if (product) {
            const available = product.available_quantity ?? product.stock_quantity ?? 0;
            if (available < item.quantity) {
              unavailable.push({
                productId: item.productId,
                productName: item.name,
                requested: item.quantity,
                available,
              });
            }
          }
        }
        if (unavailable.length > 0) {
          throw new OutOfStockError(unavailable);
        }
      }

      // Validate purchase limits
      const purchaseLimits = (store as unknown as { purchase_limits?: PurchaseLimits })?.purchase_limits;
      if (purchaseLimits?.enabled) {
        if (purchaseLimits.max_per_order && total > purchaseLimits.max_per_order) {
          throw new Error(
            `Order exceeds maximum limit of ${formatCurrency(purchaseLimits.max_per_order)} per transaction. ` +
            `Your order total is ${formatCurrency(total)}.`
          );
        }

        if (formData.email && (purchaseLimits.max_daily || purchaseLimits.max_weekly)) {
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

            const dailyTotal = orders
              .filter(o => o.created_at?.startsWith(today))
              .reduce((sum, o) => sum + (o.total ?? 0), 0);

            const weeklyTotal = orders.reduce((sum, o) => sum + (o.total ?? 0), 0);

            if (purchaseLimits.max_daily && (dailyTotal + total) > purchaseLimits.max_daily) {
              const remaining = Math.max(0, purchaseLimits.max_daily - dailyTotal);
              throw new Error(
                `You've reached your daily purchase limit of ${formatCurrency(purchaseLimits.max_daily)}. ` +
                `You can spend ${formatCurrency(remaining)} more today.`
              );
            }

            if (purchaseLimits.max_weekly && (weeklyTotal + total) > purchaseLimits.max_weekly) {
              const remaining = Math.max(0, purchaseLimits.max_weekly - weeklyTotal);
              throw new Error(
                `You've reached your weekly purchase limit of ${formatCurrency(purchaseLimits.max_weekly)}. ` +
                `You can spend ${formatCurrency(remaining)} more this week.`
              );
            }
          }
        }
      }

      // Primary path: edge function checkout
      const tryEdgeFunction = async (): Promise<OrderResult | null> => {
        try {
          const edgeDeliveryAddress = formData.fulfillmentMethod === 'pickup'
            ? undefined
            : `${formData.street}${formData.apartment ? ', ' + formData.apartment : ''}, ${formData.city}, ${formData.state} ${formData.zip}`;
          const edgeOrigin = window.location.origin;
          const totalDiscountAmount = couponDiscount + loyaltyDiscount + dealsDiscount;

          const { data, error } = await supabase.functions.invoke('storefront-checkout', {
            body: {
              storeSlug,
              items: cartItems.map(item => ({
                product_id: item.productId,
                quantity: item.quantity,
                variant: item.variant,
                price: item.price,
              })),
              customerInfo: {
                firstName: formData.firstName,
                lastName: formData.lastName,
                email: formData.email,
                phone: formData.phone || undefined,
              },
              fulfillmentMethod: formData.fulfillmentMethod,
              paymentMethod: formData.paymentMethod,
              deliveryAddress: edgeDeliveryAddress,
              preferredContactMethod: formData.preferredContact || undefined,
              notes: formData.deliveryNotes || undefined,
              discountAmount: totalDiscountAmount > 0 ? totalDiscountAmount : undefined,
              successUrl: formData.paymentMethod === 'card'
                ? `${edgeOrigin}/shop/${storeSlug}/order-confirmation?session_id={CHECKOUT_SESSION_ID}`
                : undefined,
              cancelUrl: formData.paymentMethod === 'card'
                ? `${edgeOrigin}/shop/${storeSlug}/checkout?cancelled=true`
                : undefined,
              idempotencyKey,
              clientTotal: total,
            },
          });

          if (error) {
            const errorName = (error as { name?: string }).name || '';
            const isFetchError = errorName === 'FunctionsFetchError' || errorName === 'FunctionsRelayError';

            if (isFetchError) {
              return null;
            }

            const errorBody = data as Record<string, unknown> | null;
            const errorMessage = (errorBody?.error as string) || error.message || 'Checkout failed';

            if (errorMessage === 'Internal server error') {
              return null;
            }

            if (errorMessage === 'Insufficient stock' && Array.isArray(errorBody?.unavailableProducts)) {
              const items = errorBody.unavailableProducts as UnavailableProduct[];
              throw new OutOfStockError(items);
            }

            throw new Error(errorMessage);
          }

          const responseData = data as Record<string, unknown>;

          if (appliedCoupon?.coupon_id) {
            await (supabase.rpc as unknown as SupabaseRpc)('redeem_coupon', { p_coupon_id: appliedCoupon.coupon_id });
          }

          return {
            order_id: responseData.orderId as string,
            order_number: (responseData.orderNumber as string) || (responseData.orderId as string),
            tracking_token: (responseData.trackingToken as string) || undefined,
            total: responseData.serverTotal as number,
            checkoutUrl: responseData.checkoutUrl as string | undefined,
            telegramLink: (responseData.telegramLink as string) || undefined,
          };
        } catch (err: unknown) {
          if (err instanceof Error) throw err;
          return null;
        }
      };

      // Fallback path: direct RPC
      const attemptOrder = async (attempt: number): Promise<OrderResult> => {
        try {
          if (!store?.id) throw new Error('Store ID missing');

          const sessionId = formData.email || `guest_${Date.now()}`;

          const deliveryAddress = formData.fulfillmentMethod === 'pickup'
            ? null
            : `${formData.street}${formData.apartment ? ', ' + formData.apartment : ''}, ${formData.city}, ${formData.state} ${formData.zip}`;

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
              p_idempotency_key: idempotencyKey,
              p_preferred_contact_method: formData.preferredContact || undefined,
              p_fulfillment_method: formData.fulfillmentMethod,
            });

          if (orderError) {
            if (orderError.message?.includes('function') || orderError.code === '42883') {
              throw new Error('Order system is not configured. Please contact the store.');
            }
            throw orderError;
          }

          if (!orderId) throw new Error('Failed to create order');

          await (supabase.rpc as unknown as SupabaseRpc)('complete_reservation', {
            p_session_id: sessionId,
            p_order_id: orderId
          });

          if (appliedCoupon?.coupon_id) {
            await (supabase.rpc as unknown as SupabaseRpc)('redeem_coupon', { p_coupon_id: appliedCoupon.coupon_id });
          }

          const { data: orderRow } = await supabase
            .from('storefront_orders')
            .select('order_number, tracking_token, total')
            .eq('id', orderId as string)
            .maybeSingle();

          return {
            order_id: orderId as string,
            order_number: (orderRow?.order_number as string) || (orderId as string),
            tracking_token: (orderRow?.tracking_token as string) || undefined,
            total: (orderRow?.total as number) ?? undefined,
          };

        } catch (err: unknown) {
          const errMessage = err instanceof Error ? err.message : String(err);
          const isNetworkError =
            errMessage.toLowerCase().includes('network') ||
              errMessage.toLowerCase().includes('fetch') ||
              errMessage.toLowerCase().includes('timeout') ||
              errMessage.toLowerCase().includes('failed to fetch');

          if (isNetworkError && attempt < 3) {
            setOrderRetryCount(attempt);
            toast.warning(`Connection issue, retrying (${attempt}/3)...`);
            await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt - 1)));
            return attemptOrder(attempt + 1);
          }

          logger.error('Order RPC error', err, { attempt, component: 'CheckoutPage' });
          throw err;
        }
      };

      // Try edge function first, fallback to direct RPC if unavailable
      const edgeResult = await tryEdgeFunction();
      if (edgeResult) return edgeResult;

      logger.warn('Edge function unavailable, using client-side fallback', null, { component: 'CheckoutPage' });
      const fallbackResult = await attemptOrder(1);

      // Telegram fallback notification
      if (store?.tenant_id) {
        supabase.functions.invoke('forward-order-telegram', {
          body: {
            orderId: fallbackResult.order_id,
            tenantId: store.tenant_id,
            orderNumber: fallbackResult.order_number,
            customerName: `${formData.firstName} ${formData.lastName}`,
            customerPhone: formData.phone || null,
            orderTotal: fallbackResult.total ?? total,
            items: cartItems.map((item) => ({
              productName: item.name,
              quantity: item.quantity,
              price: item.price * item.quantity,
            })),
            storeName: store.store_name || 'Store',
            fulfillmentMethod: formData.fulfillmentMethod,
          },
        }).catch((err) => {
          logger.warn('Telegram fallback notification failed — skipping', err, { component: 'CheckoutPage' });
        });
      }

      return fallbackResult;
    },
    onSuccess: async (data) => {
      setOrderRetryCount(0);
      sessionStorage.removeItem(`checkout_idempotency_${storeSlug || ''}`);

      // If edge function returned a Stripe checkout URL, redirect directly
      if (data.checkoutUrl) {
        if (store?.id) {
          safeStorage.removeItem(`${STORAGE_KEYS.SHOP_CART_PREFIX}${store.id}`);
          if (formStorageKey) {
            safeStorage.removeItem(formStorageKey);
          }
          setCartItemCount(0);
        }
        window.location.href = data.checkoutUrl;
        return;
      }

      // Show confirmation toast based on payment method
      if (formData.paymentMethod === 'cash') {
        toast.success("Thanks! You'll be contacted.", {
          description: `Order #${data.order_number} placed successfully.`,
        });
      } else if (formData.paymentMethod === 'venmo') {
        toast.success('Venmo payment received!', {
          description: `Order #${data.order_number} placed successfully.`,
        });
      } else if (formData.paymentMethod === 'zelle') {
        toast.success('Zelle payment received!', {
          description: `Order #${data.order_number} placed successfully.`,
        });
      } else if (formData.paymentMethod === 'card') {
        toast.info('Order placed! The store will follow up regarding payment.');
      }

      // Clear cart and saved form data
      if (store?.id) {
        safeStorage.removeItem(`${STORAGE_KEYS.SHOP_CART_PREFIX}${store.id}`);
        if (formStorageKey) {
          safeStorage.removeItem(formStorageKey);
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

      // Create customer account if opted in
      if (createAccount && accountPassword && store?.tenant_id) {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
        fetch(`${supabaseUrl}/functions/v1/customer-auth?action=signup`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseAnonKey}`,
            'apikey': supabaseAnonKey,
          },
          body: JSON.stringify({
            email: formData.email,
            password: accountPassword,
            firstName: formData.firstName,
            lastName: formData.lastName,
            phone: formData.phone || null,
            tenantId: store.tenant_id,
          }),
        }).then(async (response) => {
          if (response.status === 409) {
            toast.info('An account with this email already exists. You can log in to view your orders.');
          } else if (!response.ok) {
            const errBody = await response.json().catch(() => ({}));
            logger.warn('Account creation failed', errBody, { component: 'CheckoutPage' });
          } else {
            toast.success('Account created! You can now log in to view your order history.');
          }
        }).catch((err) => {
          logger.warn('Account creation failed', err, { component: 'CheckoutPage' });
        });
      }

      // Navigate to confirmation
      navigate(`/shop/${storeSlug}/order-confirmation`, {
        state: {
          orderNumber: data.order_number,
          trackingToken: data.tracking_token,
          total: data.total,
          telegramLink: data.telegramLink,
        },
      });
    },
    onError: (error: Error) => {
      setOrderRetryCount(0);
      logger.error('Failed to place order', error, { component: 'CheckoutPage' });

      // Handle out-of-stock errors
      if (error instanceof OutOfStockError) {
        const { unavailableProducts } = error;
        for (const product of unavailableProducts) {
          if (product.available <= 0) {
            removeItem(product.productId);
            toast.error(`Sorry, ${product.productName} is no longer available.`);
          } else {
            removeItem(product.productId);
            toast.error(
              `Sorry, ${product.productName} is no longer available in the requested quantity.`,
              { description: `Only ${product.available} left in stock.` },
            );
          }
        }

        const remainingCount = cartItems.length - unavailableProducts.length;
        if (remainingCount > 0) {
          toast.info('Your cart has been updated. You can continue with the remaining items.');
          setCurrentStep(4);
        }
        return;
      }

      const errorMessage = error.message || '';
      const lowerMsg = errorMessage.toLowerCase();
      const isRetryableError =
        lowerMsg.includes('network') ||
        lowerMsg.includes('fetch') ||
        lowerMsg.includes('timeout') ||
        lowerMsg.includes('internal server error') ||
        lowerMsg.includes('500') ||
        lowerMsg.includes('failed to create order') ||
        errorMessage === '';

      toast.error('Order failed', {
        description: isRetryableError
          ? 'Something went wrong. Please try again.'
          : errorMessage,
        action: {
          label: 'Retry',
          onClick: () => handlePlaceOrder(),
        },
      });
    },
    onSettled: () => {
      isSubmittingRef.current = false;
    },
  });

  // Handle place order
  const handlePlaceOrder = () => {
    if (isSubmittingRef.current || placeOrderMutation.isPending) return;
    if (validateStep()) {
      isSubmittingRef.current = true;
      placeOrderMutation.mutate();
    }
  };

  return {
    // Navigation
    storeSlug,
    store,
    currentStep,
    setCurrentStep,
    nextStep,
    prevStep,

    // Form state
    formData,
    updateField,
    showErrors,
    agreeToTerms,
    setAgreeToTerms,
    venmoConfirmed,
    setVenmoConfirmed,
    zelleConfirmed,
    setZelleConfirmed,
    createAccount,
    setCreateAccount,
    accountPassword,
    setAccountPassword,

    // Cart
    cartItems,
    cartCount,
    subtotal,

    // Pricing
    effectiveDeliveryFee,
    couponDiscount,
    dealsDiscount,
    loyaltyDiscount,
    loyaltyPointsUsed,
    setLoyaltyDiscount,
    setLoyaltyPointsUsed,
    enableCartRounding,
    roundingAdjustment,
    totalBeforeGiftCards,
    giftCardAmount,
    total,

    // Coupons
    couponCode,
    setCouponCode,
    isApplyingCoupon,
    couponError,
    setCouponError,
    handleApplyCoupon,
    appliedCoupon,
    removeCoupon,

    // Gift Cards
    giftCardCode,
    setGiftCardCode,
    isCheckingGiftCard,
    handleApplyGiftCard,
    appliedGiftCards,
    removeGiftCard,

    // Store status
    isStoreClosed,
    storeStatus,
    isStripeConfigured,

    // Returning customer
    hasSavedData,
    returningCustomer,
    isRecognized,
    isLookingUpCustomer,

    // Mobile
    mobileSummaryExpanded,
    setMobileSummaryExpanded,

    // Order
    placeOrderMutation,
    handlePlaceOrder,
  };
}
