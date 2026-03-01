/**
 * Checkout Page
 * Multi-step checkout flow
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
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
  User,
  MapPin,
  CreditCard,
  ShoppingCart,
  Loader2,
  ChevronUp,
  ChevronDown,
  Truck,
  Store,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';
import { formatPhoneInput, normalizePhoneNumber, formatPhoneNumber } from '@/lib/utils/formatPhone';
import { CheckoutAddressAutocomplete } from '@/components/shop/CheckoutAddressAutocomplete';
import { CheckoutProgressIndicator } from '@/components/shop/CheckoutProgressIndicator';
import ExpressPaymentButtons from '@/components/shop/ExpressPaymentButtons';
import { PaymentMethodStep } from '@/components/shop/PaymentMethodStep';
import { CheckoutLoyalty } from '@/components/shop/CheckoutLoyalty';
import { CheckoutSignInDialog } from '@/components/shop/CheckoutSignInDialog';
import { useStoreStatus } from '@/hooks/useStoreStatus';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Clock, LogIn, Tag } from 'lucide-react';
import { isCustomerBlockedByEmail, FLAG_REASON_LABELS } from '@/hooks/useCustomerFlags';
import { humanizeError } from '@/lib/humanizeError';
import { STORAGE_KEYS } from '@/constants/storageKeys';
import { safeStorage } from '@/utils/safeStorage';
import { queryKeys } from '@/lib/queryKeys';
import { useReturningCustomerLookup } from '@/hooks/useReturningCustomerLookup';
import type { DeliveryZone } from '@/types/delivery-zone';
import ProductImage from '@/components/ProductImage';
import { PostCheckoutConfirmationDialog } from '@/components/shop/PostCheckoutConfirmationDialog';

// Email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Phone validation: normalize to 10-digit US format and check
function isValidUSPhone(value: string): boolean {
  return normalizePhoneNumber(value) !== null;
}
import { CheckoutCustomerInfoStep } from '@/components/shop/CheckoutCustomerInfoStep';

interface CheckoutData {
  // Contact
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  preferredContact: 'text' | 'phone' | 'email' | 'telegram';
  // Fulfillment
  fulfillmentMethod: 'delivery' | 'pickup';
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

/** Result of matching a customer ZIP against delivery zones */
interface ZoneMatchInfo {
  zone_name: string;
  delivery_fee: number;
  minimum_order: number;
  estimated_time_min: number;
  estimated_time_max: number;
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
  checkoutUrl?: string;
  telegramLink?: string;
  accountToken?: string;
  accountCustomer?: Record<string, unknown>;
  accountTenant?: Record<string, unknown>;
  telegramButtonLabel?: string;
}

interface UnavailableProduct {
  productId: string;
  productName: string;
  requested: number;
  available: number;
}

class OutOfStockError extends Error {
  unavailableProducts: UnavailableProduct[];
  constructor(unavailableProducts: UnavailableProduct[]) {
    const names = unavailableProducts.map(p => p.productName).join(', ');
    super(`Some items are out of stock: ${names}`);
    this.name = 'OutOfStockError';
    this.unavailableProducts = unavailableProducts;
  }
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
  const { storeSlug } = useParams<{ storeSlug: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { store, setCartItemCount } = useShop();
  const { isLuxuryTheme, accentColor, cardBg, cardBorder, textPrimary, textMuted, inputBg, inputBorder, inputText } = useLuxuryTheme();
  // Check store status
  const { data: storeStatus } = useStoreStatus(store?.id);
  const isStoreClosed = storeStatus?.isOpen === false;

  // Fetch delivery zones for the store's tenant
  const { data: deliveryZones = [] } = useQuery({
    queryKey: queryKeys.deliveryZones.byTenant(store?.tenant_id),
    queryFn: async () => {
      if (!store?.tenant_id) return [];
      const { data, error } = await supabase
        .from('delivery_zones')
        .select('*')
        .eq('tenant_id', store.tenant_id)
        .eq('is_active', true)
        .order('priority', { ascending: false });
      if (error) {
        logger.warn('Failed to fetch delivery zones', error, { component: 'CheckoutPage' });
        return [];
      }
      return (data ?? []) as DeliveryZone[];
    },
    enabled: !!store?.tenant_id,
    staleTime: 5 * 60 * 1000,
  });

  // ZIP code zone validation state
  const [matchedZone, setMatchedZone] = useState<ZoneMatchInfo | null>(null);
  const [zipValidationStatus, setZipValidationStatus] = useState<'idle' | 'checking' | 'valid' | 'invalid'>('idle');
  const zipCheckTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced ZIP zone validation
  const validateZipAgainstZones = useCallback((zip: string) => {
    if (zipCheckTimerRef.current) {
      clearTimeout(zipCheckTimerRef.current);
    }

    // Reset if empty or too short
    if (!zip || zip.length < 5) {
      setZipValidationStatus('idle');
      setMatchedZone(null);
      return;
    }

    setZipValidationStatus('checking');

    zipCheckTimerRef.current = setTimeout(() => {
      // First check against delivery_zones table via client-side ZIP match
      const normalizedZip = zip.trim();
      const match = deliveryZones.find(zone =>
        zone.zip_codes.some(zc => zc === normalizedZip)
      );

      if (match) {
        setMatchedZone({
          zone_name: match.name,
          delivery_fee: match.delivery_fee,
          minimum_order: match.minimum_order,
          estimated_time_min: match.estimated_time_min,
          estimated_time_max: match.estimated_time_max,
        });
        setZipValidationStatus('valid');
      } else if (deliveryZones.length > 0) {
        // Zones exist but no match — ZIP not in any zone
        setMatchedZone(null);
        setZipValidationStatus('invalid');
      } else {
        // No zones configured — allow all ZIPs
        setMatchedZone(null);
        setZipValidationStatus('idle');
      }
    }, 400);
  }, [deliveryZones]);

  // Trigger ZIP validation when zip changes
  useEffect(() => {
    if (formData.fulfillmentMethod === 'delivery') {
      validateZipAgainstZones(formData.zip);
    }
    return () => {
      if (zipCheckTimerRef.current) clearTimeout(zipCheckTimerRef.current);
    };
  }, [formData.zip, formData.fulfillmentMethod, validateZipAgainstZones]);

  // Reset zone validation when switching to pickup
  useEffect(() => {
    if (formData.fulfillmentMethod === 'pickup') {
      setZipValidationStatus('idle');
      setMatchedZone(null);
    }
  }, [formData.fulfillmentMethod]);

  // Check if Stripe is configured — hide card option if not
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
    staleTime: 5 * 60 * 1000, // cache for 5 minutes
  });

  // Handle cancelled Stripe checkout return
  useEffect(() => {
    if (searchParams.get('cancelled') === 'true') {
      toast.warning('Payment cancelled', {
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
    preferredContact: 'text',
    fulfillmentMethod: 'delivery',
    street: '',
    apartment: '',
    city: '',
    state: '',
    zip: '',
    deliveryNotes: '',
    paymentMethod: 'cash',
  });
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [ageVerified, setAgeVerified] = useState(false);
  const [venmoConfirmed, setVenmoConfirmed] = useState(false);
  const [zelleConfirmed, setZelleConfirmed] = useState(false);
  const [createAccount, setCreateAccount] = useState(false);
  const [accountPassword, setAccountPassword] = useState('');
  const [showErrors, setShowErrors] = useState(false);
  const [signInOpen, setSignInOpen] = useState(false);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [, setOrderRetryCount] = useState(0);

  // Double-submit guard — state disables button immediately on click
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Step 1 form validation (set by CheckoutCustomerInfoStep)
  const step1ValidateRef = useRef<(() => Promise<boolean>) | null>(null);
  const handleStep1Validate = useCallback((validateFn: () => Promise<boolean>) => {
    step1ValidateRef.current = validateFn;
  }, []);
  // Post-checkout confirmation popup state
  const [showConfirmationPopup, setShowConfirmationPopup] = useState(false);
  const [completedOrderData, setCompletedOrderData] = useState<{
    orderNumber: string;
    trackingToken?: string;
    total?: number;
    telegramLink?: string | null;
  } | null>(null);

  // Fast double-click guard — ref updates synchronously, before React re-renders with isPending
  const isSubmittingRef = useRef(false);

  // Idempotency key persisted to sessionStorage to survive page refresh during submission
  const [idempotencyKey] = useState(() => {
    const storageKey = `checkout_idempotency_${storeSlug || ''}`;
    try {
      const existing = sessionStorage.getItem(storageKey);
      if (existing) return existing;
      const newKey = `order_${crypto.randomUUID()}`;
      sessionStorage.setItem(storageKey, newKey);
      return newKey;
    } catch {
      // sessionStorage unavailable (e.g. private browsing)
      return `order_${crypto.randomUUID()}`;
    }
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

  // Use unified cart hook with coupon and gift card support
  const {
    cartItems,
    cartCount,
    subtotal,
    isInitialized,
    clearCart,
    applyCoupon,
    appliedCoupon,
    removeCoupon,
    getCouponDiscount,
    syncCartPrices,
    removeItem,
    appliedGiftCards,
    applyGiftCard,
    removeGiftCard,
    getGiftCardTotal,
    checkInventoryAvailability,
  } = useShopCart({
    storeId: store?.id,
    onCartChange: setCartItemCount,
  });

  // Coupon state
  const [couponCode, setCouponCode] = useState('');
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);

  // Cart validation state
  const [isValidatingCart, setIsValidatingCart] = useState(false);
  const [cartValidationIssues, setCartValidationIssues] = useState<string[]>([]);
  const cartValidationRanRef = useRef(false);

  // Redirect to cart if empty
  useEffect(() => {
    if (isInitialized && cartItems.length === 0) {
      toast.warning('Your cart is empty', { description: 'Add some items before checkout.' });
      navigate(`/shop/${storeSlug}/cart`);
    }
  }, [isInitialized, cartItems.length, navigate, storeSlug]);

  // Validate cart items on checkout page load: check existence, stock, and prices
  useEffect(() => {
    if (!isInitialized || cartItems.length === 0 || !store?.id || cartValidationRanRef.current) return;
    cartValidationRanRef.current = true;

    const validateOnMount = async () => {
      setIsValidatingCart(true);
      const issues: string[] = [];

      try {
        // 1. Check which products still exist and get current prices/stock
        const productIds = cartItems.map(item => item.productId);
        const { data: products, error } = await supabase
          .from('products')
          .select('id, name, price, in_stock')
          .in('id', productIds);

        if (error) {
          logger.warn('Cart validation query failed', error, { component: 'CheckoutPage' });
          // Don't block checkout on validation failure
          setIsValidatingCart(false);
          return;
        }

        const productMap = new Map(products?.map(p => [p.id, p]) ?? []);
        const itemsToRemove: string[] = [];

        // 2. Find deleted products (no longer in DB)
        for (const item of cartItems) {
          const product = productMap.get(item.productId);
          if (!product) {
            itemsToRemove.push(item.productId);
            issues.push(`"${item.name}" is no longer available and was removed from your cart.`);
          }
        }

        // 3. Remove deleted items
        for (const productId of itemsToRemove) {
          removeItem(productId);
        }

        // 4. Sync prices (updates cart in-place for changed prices)
        const priceResult = await syncCartPrices();
        if (priceResult.changed) {
          for (const change of priceResult.priceChanges) {
            issues.push(`"${change.name}" price updated from ${formatCurrency(change.oldPrice)} to ${formatCurrency(change.newPrice)}.`);
          }
        }

        // 5. Check inventory availability
        const stockResult = await checkInventoryAvailability();
        if (!stockResult.valid) {
          for (const item of stockResult.outOfStock) {
            if (item.available <= 0) {
              issues.push(`"${item.name}" is out of stock.`);
            } else {
              issues.push(`"${item.name}" — only ${item.available} available (you requested ${item.requested}).`);
            }
          }
        }

        // Show toast summary if there were any issues
        if (issues.length > 0) {
          toast.warning('Cart updated', {
            description: 'Some items in your cart were updated. Please review before placing your order.',
          });
        }
      } catch (e) {
        logger.error('Cart validation failed on checkout mount', e, { component: 'CheckoutPage' });
      } finally {
        setCartValidationIssues(issues);
        setIsValidatingCart(false);
      }
    };

    validateOnMount();
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

  // Get delivery fee based on matched zone or store default
  const getDeliveryFee = () => {
    if (subtotal >= (store?.free_delivery_threshold || Infinity)) return 0;

    // Use matched zone fee if available
    if (matchedZone) {
      return matchedZone.delivery_fee;
    }

    // Fall back to default delivery fee
    return store?.default_delivery_fee || 0;
  };

  // Calculate totals
  const deliveryFee = getDeliveryFee();
  const couponDiscount = getCouponDiscount(subtotal);
  const freeShipping = appliedCoupon?.free_shipping === true;
  const effectiveDeliveryFee = formData.fulfillmentMethod === 'pickup' ? 0 : (freeShipping ? 0 : deliveryFee);
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
  const validateStep = async (): Promise<boolean> => {
    switch (currentStep) {
      case 1: {
        // Delegate to React Hook Form validation via ref
        if (step1ValidateRef.current) {
          const isValid = await step1ValidateRef.current();
          if (!isValid) {
            toast.error('Please fix the errors above');
          }
          return isValid;
        }
        if (!EMAIL_REGEX.test(formData.email)) {
          toast.error('Invalid email address', { description: 'Please enter a valid email.' });
          return false;
        }
        if (store?.checkout_settings?.require_phone && !formData.phone) {
          toast.error('Phone number is required');
          return false;
        }
        // Validate phone format if provided — must be 10-digit US number
        if (formData.phone && !isValidUSPhone(formData.phone)) {
          toast.error('Invalid phone number', { description: 'Please enter a valid 10-digit US phone number.' });
          return false;
        }
        // Validate password if creating account
        if (createAccount && accountPassword.length < 8) {
          toast.error('Password too short', { description: 'Password must be at least 8 characters.' });
          return false;
        }
        return true;
        return false;
      }
      case 2:
        if (!formData.fulfillmentMethod) {
          toast.error('Please select a fulfillment method');
          return false;
        }
        // Pickup doesn't need address validation
        if (formData.fulfillmentMethod === 'pickup') return true;
        if (!formData.street || !formData.city || !formData.zip) {
          toast.error('Please fill in your delivery address');
          return false;
        }
        // Validate delivery zone if zones are configured
        if (deliveryZones.length > 0) {
          if (zipValidationStatus === 'checking') {
            toast.error('Please wait while we verify your delivery area');
            return false;
          }
          if (zipValidationStatus === 'invalid' || !matchedZone) {
            toast.error('Delivery not available', {
              description: `We don't currently deliver to ZIP code ${formData.zip}. Please try a different address or choose pickup.`,
            });
            return false;
          }
          // Check minimum order for the matched zone
          if (matchedZone.minimum_order > 0 && subtotal < matchedZone.minimum_order) {
            toast.error('Minimum order not met', {
              description: `Delivery to ${matchedZone.zone_name} requires a minimum order of ${formatCurrency(matchedZone.minimum_order)}.`,
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
        if (!ageVerified) {
          toast.error('Please confirm you are 21 or older');
          return false;
        }
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
  const nextStep = async () => {
    const isValid = await validateStep();
    if (isValid) {
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
        // Check max per order limit
        if (purchaseLimits.max_per_order && total > purchaseLimits.max_per_order) {
          throw new Error(
            `Order exceeds maximum limit of ${formatCurrency(purchaseLimits.max_per_order)} per transaction. ` +
            `Your order total is ${formatCurrency(total)}.`
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
              .reduce((sum, o) => sum + (o.total ?? 0), 0);

            // Calculate weekly spending
            const weeklyTotal = orders.reduce((sum, o) => sum + (o.total ?? 0), 0);

            // Check daily limit
            if (purchaseLimits.max_daily && (dailyTotal + total) > purchaseLimits.max_daily) {
              const remaining = Math.max(0, purchaseLimits.max_daily - dailyTotal);
              throw new Error(
                `You've reached your daily purchase limit of ${formatCurrency(purchaseLimits.max_daily)}. ` +
                `You can spend ${formatCurrency(remaining)} more today.`
              );
            }

            // Check weekly limit
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

      // Primary path: edge function checkout (handles order, customer, stock, Telegram, Stripe)
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
                phone: normalizePhoneNumber(formData.phone) || undefined,
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
              createAccount: createAccount || undefined,
              password: createAccount ? accountPassword : undefined,
            },
          });

          if (error) {
            const errorName = (error as { name?: string }).name || '';
            const isFetchError = errorName === 'FunctionsFetchError' || errorName === 'FunctionsRelayError';

            if (isFetchError) {
              return null; // Trigger fallback
            }

            const errorBody = data as Record<string, unknown> | null;
            const errorMessage = (errorBody?.error as string) || error.message || 'Checkout failed';

            if (errorMessage === 'Internal server error') {
              return null; // Trigger fallback
            }

            // Parse structured out-of-stock response from edge function
            if (errorMessage === 'Insufficient stock' && Array.isArray(errorBody?.unavailableProducts)) {
              const items = errorBody.unavailableProducts as UnavailableProduct[];
              throw new OutOfStockError(items);
            }

            throw new Error(errorMessage); // Business error — propagate
          }

          const responseData = data as Record<string, unknown>;

          // Redeem coupon client-side (edge function doesn't handle coupons)
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
            accountToken: (responseData.accountToken as string) || undefined,
            accountCustomer: (responseData.accountCustomer as Record<string, unknown>) || undefined,
            accountTenant: (responseData.accountTenant as Record<string, unknown>) || undefined,
            telegramButtonLabel: (responseData.telegramButtonLabel as string) || undefined,
          };
        } catch (err: unknown) {
          // Re-throw known Error instances (business errors from edge function)
          if (err instanceof Error) throw err;
          // Unknown errors — trigger fallback
          return null;
        }
      };

      // Fallback path: direct RPC (if edge function is unavailable)
      const attemptOrder = async (attempt: number): Promise<OrderResult> => {
        try {
          if (!store?.id) throw new Error('Store ID missing');

          // Session ID for reservation (using guest email or random string if not available yet)
          const sessionId = formData.email || `guest_${Date.now()}`;

          // Skip inventory reservation if the RPC doesn't match expected signature
          // The existing reserve_inventory uses (p_menu_id, p_items) not per-product calls

          // 1. Create Order using the actual function signature
          const deliveryAddress = formData.fulfillmentMethod === 'pickup'
            ? null
            : `${formData.street}${formData.apartment ? ', ' + formData.apartment : ''}, ${formData.city}, ${formData.state} ${formData.zip}`;

          const { data: orderId, error: orderError } = await supabase
            .rpc('create_marketplace_order', {
              p_store_id: store.id,
              p_customer_name: `${formData.firstName} ${formData.lastName}`,
              p_customer_email: formData.email,
              p_customer_phone: normalizePhoneNumber(formData.phone) || undefined,
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
              p_idempotency_key: idempotencyKey, // Prevent double orders on retry
              p_preferred_contact_method: formData.preferredContact || undefined,
              p_fulfillment_method: formData.fulfillmentMethod,
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
            total: (orderRow?.total as number) ?? undefined,
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

      // Telegram fallback: edge function checkout handles Telegram server-side,
      // but the RPC fallback path skips it. Fire-and-forget call to the Telegram
      // edge function so the seller still gets notified.
      if (store?.tenant_id) {
        supabase.functions.invoke('forward-order-telegram', {
          body: {
            orderId: fallbackResult.order_id,
            tenantId: store.tenant_id,
            orderNumber: fallbackResult.order_number,
            customerName: `${formData.firstName} ${formData.lastName}`,
            customerPhone: normalizePhoneNumber(formData.phone) || null,
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

      // Account creation fallback: edge function path handles it server-side,
      // but the RPC fallback path skips it. Fire-and-forget client call.
      if (createAccount && accountPassword && store?.tenant_id && formData.email) {
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
        }).catch((err) => {
          logger.warn('Fallback account creation failed — completing as guest', err, { component: 'CheckoutPage' });
        });
      }

      return fallbackResult;
    },
    onSuccess: async (data) => {
      setOrderRetryCount(0);
      // Clear idempotency key — order succeeded, future checkouts get a fresh key
      try { sessionStorage.removeItem(`checkout_idempotency_${storeSlug || ''}`); } catch { /* ignore */ }

      // If edge function returned a Stripe checkout URL, redirect directly
      if (data.checkoutUrl) {
        clearCart();
        if (formStorageKey) {
          safeStorage.removeItem(formStorageKey);
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
      } else if (formData.paymentMethod === 'cashapp') {
        toast.success('Cash App payment received!', {
          description: `Order #${data.order_number} placed successfully.`,
        });
      } else if (formData.paymentMethod === 'card') {
        toast.info('Order placed! The store will follow up regarding payment.');
      }
      // Clear cart and saved form data
      clearCart();
      if (formStorageKey) {
        safeStorage.removeItem(formStorageKey);
      }

      // Send order confirmation email (fire and forget) — only if email was provided
      if (formData.email) {
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
            tracking_url: data.tracking_token ? `${origin}/shop/${storeSlug}/track/${data.tracking_token}` : undefined,
          },
        }).catch((err) => {
          logger.warn('Failed to send order confirmation email', err, { component: 'CheckoutPage' });
        });
      }

      // Create customer account if opted in (fire and forget — order already placed)
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
            phone: normalizePhoneNumber(formData.phone) || null,
            tenantId: store.tenant_id,
          }),
        }).then(async (response) => {
          if (response.status === 409) {
            // Email already exists — order already completed, just inform the user
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
      // Auto-login if account was created during checkout (edge function handles creation)
      if (data.accountToken && data.accountCustomer && data.accountTenant) {
        try {
          safeStorage.setItem(STORAGE_KEYS.CUSTOMER_ACCESS_TOKEN, data.accountToken);
          safeStorage.setItem(STORAGE_KEYS.CUSTOMER_USER, JSON.stringify(data.accountCustomer));
          safeStorage.setItem(STORAGE_KEYS.CUSTOMER_TENANT_DATA, JSON.stringify(data.accountTenant));
          toast.success('Account created! You are now logged in.');
        } catch (err) {
          logger.warn('Auto-login after account creation failed', err, { component: 'CheckoutPage' });
          toast.success('Account created! You can log in to view your order history.');
        }
      } else if (createAccount) {
        // Edge function path didn't create the account (e.g., email already exists or fallback path)
        // Gracefully complete as guest
        logger.info('Account creation was requested but not completed by checkout handler', null, { component: 'CheckoutPage' });
      }

      // Navigate to confirmation
      navigate(`/shop/${storeSlug}/order-confirmation`, {
        state: {
          orderNumber: data.order_number,
          trackingToken: data.tracking_token,
          total: data.total,
          telegramLink: data.telegramLink,
          telegramButtonLabel: data.telegramButtonLabel,
        },
      // Show confirmation popup before navigating
      setCompletedOrderData({
        orderNumber: data.order_number,
        trackingToken: data.tracking_token,
        total: data.total,
        telegramLink: data.telegramLink,
      });
      setShowConfirmationPopup(true);
    },
    onError: (error: Error) => {
      setOrderRetryCount(0);
      logger.error('Failed to place order', error, { component: 'CheckoutPage' });

      // Handle out-of-stock errors — remove unavailable items and let user continue
      if (error instanceof OutOfStockError) {
        const { unavailableProducts } = error;
        for (const product of unavailableProducts) {
          if (product.available <= 0) {
            // Completely out of stock — remove from cart
            removeItem(product.productId);
            toast.error(`Sorry, ${product.productName} is no longer available.`);
          } else {
            // Insufficient quantity — remove and let user re-add with correct quantity
            removeItem(product.productId);
            toast.error(
              `Sorry, ${product.productName} is no longer available in the requested quantity.`,
              { description: `Only ${product.available} left in stock.` },
            );
          }
        }

        // If cart still has items, stay on checkout for user to continue
        const remainingCount = cartItems.length - unavailableProducts.length;
        if (remainingCount > 0) {
          toast.info('Your cart has been updated. You can continue with the remaining items.');
          setCurrentStep(4); // Stay on review step
        }
        // If cart is now empty, the existing redirect effect (line ~236) will handle navigation
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
      setIsSubmitting(false);
    },
  });

  // Handle place order — state guard prevents double submission
  const handlePlaceOrder = () => {
    if (isSubmitting || placeOrderMutation.isPending) return;
    if (validateStep()) {
      setIsSubmitting(true);
  // Handle place order — ref guard prevents fast double-click
  const handlePlaceOrder = async () => {
    if (isSubmittingRef.current || placeOrderMutation.isPending) return;
    const isValid = await validateStep();
    if (isValid) {
      isSubmittingRef.current = true;
      placeOrderMutation.mutate();
    }
  };

  if (!store) return null;

  const themeColor = isLuxuryTheme ? accentColor : store.primary_color;

  return (
    <div className={`container mx-auto px-3 sm:px-4 py-4 sm:py-8 max-w-5xl ${isLuxuryTheme ? 'min-h-dvh' : ''}`}>
      {/* Visual Progress Indicator */}
      <CheckoutProgressIndicator
        steps={STEPS}
        currentStep={currentStep}
        themeColor={themeColor}
        isLuxuryTheme={isLuxuryTheme}
        onStepClick={(stepId) => setCurrentStep(stepId)}
      />

      {/* Mobile Order Summary - Collapsible (visible only on mobile) */}
      <div className="lg:hidden mb-4 sm:mb-6">
        <button
          onClick={() => setMobileSummaryExpanded(!mobileSummaryExpanded)}
          className={`w-full p-3 sm:p-4 rounded-lg border flex items-center justify-between transition-colors ${isLuxuryTheme
            ? 'bg-white/5 border-white/10 text-white'
            : 'bg-muted/50 border-border'
            }`}
        >
          <div className="flex items-center gap-2 sm:gap-3">
            <ShoppingCart className="w-4 h-4 sm:w-5 sm:h-5" style={{ color: themeColor }} />
            <span className="font-medium text-sm sm:text-base">
              {cartCount} {cartCount === 1 ? 'item' : 'items'}
            </span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="font-bold text-sm sm:text-base" style={{ color: themeColor }}>
              {formatCurrency(total)}
            </span>
            {mobileSummaryExpanded ? (
              <ChevronUp className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
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
              <div className={`p-3 sm:p-4 mt-2 rounded-lg border space-y-2 sm:space-y-3 ${isLuxuryTheme ? 'bg-white/5 border-white/10' : 'bg-card border-border'
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-8">
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

          {/* Cart Validation Loading */}
          {isValidatingCart && (
            <Alert className="border-blue-500/50 bg-blue-500/10 mb-6">
              <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
              <AlertTitle className="text-blue-500">Verifying your cart</AlertTitle>
              <AlertDescription className="text-blue-500/90">
                Checking item availability and prices...
              </AlertDescription>
            </Alert>
          )}

          {/* Cart Validation Issues */}
          {!isValidatingCart && cartValidationIssues.length > 0 && (
            <Alert className="border-yellow-500/50 bg-yellow-500/10 mb-6">
              <AlertCircle className="h-4 w-4 text-yellow-500" />
              <AlertTitle className="text-yellow-500">Cart updated</AlertTitle>
              <AlertDescription className="text-yellow-500/90">
                <ul className="list-disc list-inside mt-1 space-y-1">
                  {cartValidationIssues.map((issue, i) => (
                    <li key={i}>{issue}</li>
                  ))}
                </ul>
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
            <CardContent className="px-3 sm:px-6 pt-4 sm:pt-6 overflow-hidden">
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
                    <div className="flex items-center justify-between mb-3 sm:mb-4">
                      <h2 className={`text-lg sm:text-xl font-semibold ${isLuxuryTheme ? 'text-white font-light' : ''}`}>Contact Information</h2>
                      {!isSignedIn && (
                        <button
                          type="button"
                          onClick={() => setSignInOpen(true)}
                          className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                        >
                          <LogIn className="h-4 w-4" />
                          Sign in
                        </button>
                      )}
                      {isSignedIn && (
                        <span className="inline-flex items-center gap-1.5 text-sm text-green-600">
                          <Check className="h-4 w-4" />
                          Signed in
                        </span>
                      )}
                    </div>
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
                      <div className="relative">
                        <Input
                          id="phone"
                          name="phone"
                          type="tel"
                          value={formData.phone}
                          onChange={(e) => updateField('phone', formatPhoneInput(e.target.value))}
                          placeholder="(555) 123-4567"
                          maxLength={14}
                          className={showErrors && formData.phone && !isValidUSPhone(formData.phone) ? "border-red-500 focus-visible:ring-red-500" : ""}
                        />
                        {isLookingUpCustomer && (
                          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                        )}
                        {isRecognized && !isLookingUpCustomer && (
                          <Check className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500" />
                        )}
                      </div>
                      {showErrors && formData.phone && !isValidUSPhone(formData.phone) && (
                        <p className="text-xs text-red-500">Please enter a valid 10-digit US phone number</p>
                      )}
                      {isRecognized && (
                        <p className="text-xs text-green-600">Welcome back, {returningCustomer?.firstName}!</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label>Preferred Contact Method</Label>
                      <RadioGroup
                        value={formData.preferredContact}
                        onValueChange={(value) => updateField('preferredContact', value)}
                        className="flex gap-4"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="text" id="contact-text" />
                          <Label htmlFor="contact-text" className="cursor-pointer">Text</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="phone" id="contact-phone" />
                          <Label htmlFor="contact-phone" className="cursor-pointer">Call</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="email" id="contact-email" />
                          <Label htmlFor="contact-email" className="cursor-pointer">Email</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="telegram" id="contact-telegram" />
                          <Label htmlFor="contact-telegram" className="cursor-pointer">Telegram</Label>
                        </div>
                      </RadioGroup>
                    </div>

                    {/* Guest vs Account Creation Toggle */}
                    {!isSignedIn && (
                      <>
                        <Separator />
                        <div className="space-y-3">
                          <p className="text-sm text-muted-foreground">
                            Checking out as a guest. Want to save your info for next time?
                          </p>
                          <div className="flex items-start gap-2">
                            <Checkbox
                              id="create-account"
                              checked={createAccount}
                              onCheckedChange={(checked) => {
                                setCreateAccount(checked as boolean);
                                if (!checked) setAccountPassword('');
                              }}
                            />
                            <div>
                              <Label htmlFor="create-account" className="cursor-pointer font-medium">
                                Create an account
                              </Label>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                Save your info and view order history
                              </p>
                            </div>
                          </div>
                          {createAccount && (
                            <div className="space-y-2 pl-6">
                              <Label htmlFor="account-password">Password *</Label>
                              <Input
                                id="account-password"
                                type="password"
                                value={accountPassword}
                                onChange={(e) => setAccountPassword(e.target.value)}
                                placeholder="At least 8 characters"
                                autoComplete="new-password"
                                minLength={8}
                                className={showErrors && createAccount && accountPassword.length < 8 ? "border-red-500 focus-visible:ring-red-500" : ""}
                              />
                              {showErrors && createAccount && accountPassword.length < 8 && (
                                <p className="text-xs text-red-500">Password must be at least 8 characters</p>
                              )}
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </motion.div>
                  <CheckoutCustomerInfoStep
                    initialValues={{
                      firstName: formData.firstName,
                      lastName: formData.lastName,
                      phone: formData.phone,
                      email: formData.email,
                      preferredContact: formData.preferredContact,
                    }}
                    createAccount={createAccount}
                    accountPassword={accountPassword}
                    isLuxuryTheme={isLuxuryTheme}
                    isLookingUpCustomer={isLookingUpCustomer}
                    isRecognized={isRecognized}
                    returningCustomer={returningCustomer}
                    onFieldChange={(field, value) => updateField(field as keyof CheckoutData, value)}
                    onCreateAccountChange={(checked) => {
                      setCreateAccount(checked);
                      if (!checked) setAccountPassword('');
                    }}
                    onAccountPasswordChange={setAccountPassword}
                    onValidate={handleStep1Validate}
                  />
                )}

                {/* Step 2: Fulfillment Method & Delivery Address */}
                {currentStep === 2 && (
                  <motion.div
                    key="step2"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-4"
                  >
                    <h2 className={`text-lg sm:text-xl font-semibold mb-3 sm:mb-4 ${isLuxuryTheme ? 'text-white font-light' : ''}`}>How would you like to receive your order?</h2>

                    {/* Fulfillment Method Selector */}
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
                          formData.fulfillmentMethod === 'delivery'
                            ? isLuxuryTheme
                              ? 'border-white/30 bg-white/10 ring-1 ring-white/20'
                              : 'ring-2 ring-offset-1'
                            : isLuxuryTheme
                              ? 'border-white/10 hover:border-white/20 text-white/60'
                              : 'border-border hover:border-primary/50'
                        }`}
                        style={formData.fulfillmentMethod === 'delivery' ? {
                          borderColor: themeColor,
                          backgroundColor: isLuxuryTheme ? undefined : `${themeColor}10`,
                          ringColor: themeColor,
                        } : undefined}
                        onClick={() => updateField('fulfillmentMethod', 'delivery')}
                        data-testid="fulfillment-delivery-button"
                      >
                        <Truck className="h-6 w-6" style={formData.fulfillmentMethod === 'delivery' ? { color: themeColor } : undefined} />
                        <span className={`font-semibold ${isLuxuryTheme ? 'text-white' : ''}`}>Delivery</span>
                        <span className={`text-xs ${isLuxuryTheme ? 'text-white/40' : 'text-muted-foreground'}`}>We deliver to you</span>
                      </button>
                      <button
                        type="button"
                        className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
                          formData.fulfillmentMethod === 'pickup'
                            ? isLuxuryTheme
                              ? 'border-white/30 bg-white/10 ring-1 ring-white/20'
                              : 'ring-2 ring-offset-1'
                            : isLuxuryTheme
                              ? 'border-white/10 hover:border-white/20 text-white/60'
                              : 'border-border hover:border-primary/50'
                        }`}
                        style={formData.fulfillmentMethod === 'pickup' ? {
                          borderColor: themeColor,
                          backgroundColor: isLuxuryTheme ? undefined : `${themeColor}10`,
                          ringColor: themeColor,
                        } : undefined}
                        onClick={() => updateField('fulfillmentMethod', 'pickup')}
                        data-testid="fulfillment-pickup-button"
                      >
                        <Store className="h-6 w-6" style={formData.fulfillmentMethod === 'pickup' ? { color: themeColor } : undefined} />
                        <span className={`font-semibold ${isLuxuryTheme ? 'text-white' : ''}`}>Pickup</span>
                        <span className={`text-xs ${isLuxuryTheme ? 'text-white/40' : 'text-muted-foreground'}`}>Pick up at store</span>
                      </button>
                    </div>

                    {/* Pickup Info */}
                    {formData.fulfillmentMethod === 'pickup' && (
                      <Card className={isLuxuryTheme ? 'bg-white/5 border-white/10' : 'bg-muted/50'} data-testid="pickup-info-card">
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <Store className="h-5 w-5 mt-0.5" style={{ color: themeColor }} />
                            <div>
                              <p className={`font-semibold ${isLuxuryTheme ? 'text-white' : ''}`}>Pickup at {store?.store_name || 'our store'}</p>
                              <p className={`text-sm mt-1 ${isLuxuryTheme ? 'text-white/60' : 'text-muted-foreground'}`}>
                                You will receive pickup details after your order is confirmed.
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Address fields — only shown for delivery */}
                    {formData.fulfillmentMethod === 'delivery' && (
                      <>
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
                          <div className="relative">
                            <Input
                              id="zip"
                              name="zip"
                              value={formData.zip}
                              onChange={(e) => updateField('zip', e.target.value)}
                              placeholder="10001"
                              maxLength={10}
                              className={
                                zipValidationStatus === 'invalid'
                                  ? 'border-red-500 focus-visible:ring-red-500 pr-10'
                                  : zipValidationStatus === 'valid'
                                    ? 'border-green-500 focus-visible:ring-green-500 pr-10'
                                    : zipValidationStatus === 'checking'
                                      ? 'pr-10'
                                      : ''
                              }
                            />
                            {zipValidationStatus === 'checking' && (
                              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                            )}
                            {zipValidationStatus === 'valid' && (
                              <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500" />
                            )}
                            {zipValidationStatus === 'invalid' && (
                              <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-red-500" />
                            )}
                          </div>

                          {/* Zone match info */}
                          {zipValidationStatus === 'valid' && matchedZone && (
                            <div className={`flex items-start gap-2 p-3 rounded-lg text-sm ${isLuxuryTheme ? 'bg-green-500/10 border border-green-500/20' : 'bg-green-50 border border-green-200'}`}>
                              <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                              <div className={isLuxuryTheme ? 'text-green-400' : 'text-green-700'}>
                                <p className="font-medium">Delivery available — {matchedZone.zone_name}</p>
                                <p className={`text-xs mt-0.5 ${isLuxuryTheme ? 'text-green-400/70' : 'text-green-600'}`}>
                                  {matchedZone.delivery_fee > 0
                                    ? `${formatCurrency(matchedZone.delivery_fee)} delivery fee`
                                    : 'Free delivery'}
                                  {' · '}
                                  Est. {matchedZone.estimated_time_min}–{matchedZone.estimated_time_max} min
                                  {matchedZone.minimum_order > 0 && ` · ${formatCurrency(matchedZone.minimum_order)} minimum`}
                                </p>
                              </div>
                            </div>
                          )}

                          {/* No match error */}
                          {zipValidationStatus === 'invalid' && (
                            <div className={`flex items-start gap-2 p-3 rounded-lg text-sm ${isLuxuryTheme ? 'bg-red-500/10 border border-red-500/20' : 'bg-red-50 border border-red-200'}`}>
                              <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                              <div className={isLuxuryTheme ? 'text-red-400' : 'text-red-700'}>
                                <p className="font-medium">Sorry, we don&apos;t deliver to this area</p>
                                <p className={`text-xs mt-0.5 ${isLuxuryTheme ? 'text-red-400/70' : 'text-red-600'}`}>
                                  Try a different ZIP code or choose pickup instead.
                                </p>
                              </div>
                            </div>
                          )}

                          {/* Minimum order warning */}
                          {zipValidationStatus === 'valid' && matchedZone && matchedZone.minimum_order > 0 && subtotal < matchedZone.minimum_order && (
                            <div className={`flex items-start gap-2 p-3 rounded-lg text-sm ${isLuxuryTheme ? 'bg-yellow-500/10 border border-yellow-500/20' : 'bg-yellow-50 border border-yellow-200'}`}>
                              <AlertCircle className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                              <div className={isLuxuryTheme ? 'text-yellow-400' : 'text-yellow-700'}>
                                <p className="font-medium">
                                  Minimum order of {formatCurrency(matchedZone.minimum_order)} required
                                </p>
                                <p className={`text-xs mt-0.5 ${isLuxuryTheme ? 'text-yellow-400/70' : 'text-yellow-600'}`}>
                                  Add {formatCurrency(matchedZone.minimum_order - subtotal)} more to qualify for delivery to this area.
                                </p>
                              </div>
                            </div>
                          )}
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
                      </>
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
                  >
                    <PaymentMethodStep
                      paymentMethods={store.payment_methods || ['cash']}
                      selectedMethod={formData.paymentMethod}
                      onMethodChange={(method) => updateField('paymentMethod', method)}
                      isStripeConfigured={isStripeConfigured}
                      checkoutSettings={store.checkout_settings}
                      venmoConfirmed={venmoConfirmed}
                      onVenmoConfirmedChange={setVenmoConfirmed}
                      zelleConfirmed={zelleConfirmed}
                      onZelleConfirmedChange={setZelleConfirmed}
                    />
                    <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4">Payment Method</h2>

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
                      onValueChange={(value) => {
                        updateField('paymentMethod', value);
                        if (value !== 'venmo') setVenmoConfirmed(false);
                        if (value !== 'zelle') setZelleConfirmed(false);
                      }}
                      className="space-y-2 sm:space-y-3"
                    >
                      {(store.payment_methods || ['cash']).filter((method: string) =>
                        method !== 'card' || isStripeConfigured !== false
                      ).map((method: string) => (
                        <div
                          key={method}
                          className="flex items-center space-x-3 p-3 sm:p-4 border rounded-lg cursor-pointer hover:bg-muted/50 w-full"
                          onClick={() => {
                            updateField('paymentMethod', method);
                            if (method !== 'venmo') setVenmoConfirmed(false);
                            if (method !== 'zelle') setZelleConfirmed(false);
                          }}
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

                    {/* Venmo payment details */}
                    {formData.paymentMethod === 'venmo' && (
                      <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                        {store.checkout_settings?.venmo_handle && (
                          <div className="space-y-2">
                            <p className="text-sm font-medium">
                              Send payment to{' '}
                              <span className="font-bold">{store.checkout_settings?.venmo_handle}</span>
                            </p>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="gap-2"
                              onClick={() => {
                                navigator.clipboard.writeText(store.checkout_settings?.venmo_handle || '');
                                toast.success('Venmo handle copied!');
                              }}
                            >
                              <Copy className="h-3 w-3" />
                              Copy Venmo handle
                            </Button>
                          </div>
                        )}
                        <div className="flex items-start gap-2 pt-2">
                          <Checkbox
                            id="venmo-confirmed"
                            checked={venmoConfirmed}
                            onCheckedChange={(checked) => setVenmoConfirmed(checked as boolean)}
                          />
                          <Label htmlFor="venmo-confirmed" className="text-sm cursor-pointer">
                            I&apos;ve sent payment via Venmo
                          </Label>
                        </div>
                      </div>
                    )}

                    {/* Zelle payment details */}
                    {formData.paymentMethod === 'zelle' && (
                      <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                        {store.checkout_settings?.zelle_email && (
                          <div className="space-y-2">
                            <p className="text-sm font-medium">
                              Send Zelle payment to{' '}
                              <span className="font-bold">{store.checkout_settings?.zelle_email}</span>
                            </p>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="gap-2"
                              onClick={() => {
                                navigator.clipboard.writeText(store.checkout_settings?.zelle_email || '');
                                toast.success('Zelle contact copied!');
                              }}
                            >
                              <Copy className="h-3 w-3" />
                              Copy Zelle contact
                            </Button>
                          </div>
                        )}
                        <div className="flex items-start gap-2 pt-2">
                          <Checkbox
                            id="zelle-confirmed"
                            checked={zelleConfirmed}
                            onCheckedChange={(checked) => setZelleConfirmed(checked as boolean)}
                          />
                          <Label htmlFor="zelle-confirmed" className="text-sm cursor-pointer">
                            I&apos;ve sent payment via Zelle
                          </Label>
                        </div>
                      </div>
                    )}

                    {/* Card payment info */}
                    {formData.paymentMethod === 'card' && (
                      <div className="flex items-start gap-3 p-4 border rounded-lg bg-muted/30">
                        <CreditCard className="h-5 w-5 mt-0.5 flex-shrink-0 text-muted-foreground" />
                        <div className="space-y-1">
                          <p className="text-sm font-medium">Secure card payment</p>
                          <p className="text-xs text-muted-foreground">
                            You&apos;ll be redirected to Stripe&apos;s secure checkout to complete your payment after reviewing your order.
                          </p>
                        </div>
                      </div>
                    )}
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
                    <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4">Review Your Order</h2>

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
                        {formatPhoneNumber(formData.phone)}
                        {formData.preferredContact && (
                          <>
                            <br />
                            Preferred contact: {formData.preferredContact.charAt(0).toUpperCase() + formData.preferredContact.slice(1)}
                          </>
                        )}
                        {isSignedIn && (
                          <>
                            <br />
                            <span className="text-green-600">Signed in</span>
                          </>
                        )}
                        {!isSignedIn && createAccount && (
                          <>
                            <br />
                            <span className="text-primary">Creating account with this email</span>
                          </>
                        )}
                      </p>
                    </div>

                    <Separator />

                    {/* Fulfillment Summary */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-medium">
                          {formData.fulfillmentMethod === 'pickup' ? 'Pickup' : 'Delivery Address'}
                        </h3>
                        <Button variant="ghost" size="sm" onClick={() => setCurrentStep(2)}>
                          Edit
                        </Button>
                      </div>
                      {formData.fulfillmentMethod === 'pickup' ? (
                        <p className="text-sm text-muted-foreground" data-testid="review-pickup-summary">
                          Pickup at {store?.store_name || 'store'}
                        </p>
                      ) : (
                        <>
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
                        </>
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
                        {formData.paymentMethod === 'cash' && 'Cash'}
                        {formData.paymentMethod === 'venmo' && 'Venmo'}
                        {formData.paymentMethod === 'zelle' && 'Zelle'}
                        {formData.paymentMethod === 'card' && 'Credit / Debit Card'}
                        {formData.paymentMethod === 'cashapp' && 'Cash App'}
                        {!['cash', 'venmo', 'zelle', 'card', 'cashapp'].includes(formData.paymentMethod) && formData.paymentMethod}
                      </p>
                    </div>

                    <Separator />

                    {/* Age Verification */}
                    <div className="flex items-start gap-2">
                      <Checkbox
                        id="age-verify"
                        checked={ageVerified}
                        onCheckedChange={(checked) => setAgeVerified(checked as boolean)}
                      />
                      <Label htmlFor="age-verify" className="text-sm text-muted-foreground">
                        I confirm that I am 21 years of age or older and legally eligible to purchase cannabis products.
                      </Label>
                    </div>

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

              {/* Navigation Buttons — hidden on mobile (sticky bar handles it), visible on sm+ */}
              <div className="hidden sm:flex flex-row justify-between gap-3 mt-8">
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
                    disabled={isSubmitting || placeOrderMutation.isPending || !agreeToTerms || !ageVerified}
                    style={{ backgroundColor: store.primary_color }}
                  >
                    {isSubmitting || placeOrderMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        {formData.paymentMethod === 'card' ? 'Redirecting to payment...' : 'Processing...'}
                      </>
                    ) : isStoreClosed ? (
                      <>
                        <Clock className="w-4 h-4 mr-2" />
                        Place Pre-Order
                      </>
                    ) : formData.paymentMethod === 'card' ? (
                      <>
                        <CreditCard className="w-4 h-4 mr-2" />
                        Pay with Card
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4 mr-2" />
                        Place Order
                      </>
                    )}
                  </Button>
                )}
              </div>

              {/* Mobile-only back link (above sticky bar) */}
              <div className="sm:hidden mt-4">
                {currentStep > 1 ? (
                  <Button variant="ghost" size="sm" onClick={prevStep} className="text-muted-foreground">
                    <ArrowLeft className="w-4 h-4 mr-1" />
                    Back
                  </Button>
                ) : (
                  <Link to={`/shop/${storeSlug}/cart`}>
                    <Button variant="ghost" size="sm" className="text-muted-foreground">
                      <ArrowLeft className="w-4 h-4 mr-1" />
                      Back to Cart
                    </Button>
                  </Link>
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
                      <ProductImage
                        src={item.imageUrl}
                        alt={item.name}
                        className="w-full h-full"
                      />
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
                      aria-label="Coupon code"
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
                    onClick={() => { removeCoupon(); toast.success('Coupon removed'); }}
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
                  aria-label="Gift card code"
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
                          aria-label="Remove gift card"
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
                {formData.fulfillmentMethod === 'delivery' && effectiveDeliveryFee > 0 && (
                  <div className="flex justify-between" data-testid="order-summary-delivery-fee">
                    <span className={textMuted}>Delivery</span>
                    <span className={isLuxuryTheme ? textPrimary : ''}>{formatCurrency(effectiveDeliveryFee)}</span>
                  </div>
                )}
                {formData.fulfillmentMethod === 'pickup' && (
                  <div className="flex justify-between" data-testid="order-summary-pickup-free">
                    <span className={textMuted}>Pickup</span>
                    <span className="text-green-600">FREE</span>
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
                <div className="flex justify-between text-lg font-bold" data-testid="order-summary-total">
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
      <div className="fixed bottom-0 left-0 right-0 lg:hidden bg-background/95 backdrop-blur-md border-t px-3 sm:px-4 py-3 sm:py-4 z-50" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
        {currentStep < 4 ? (
          <div className="flex items-center gap-3">
            <div className="min-w-0">
              <p className="text-[10px] sm:text-xs text-muted-foreground">Total</p>
              <p className="text-base sm:text-lg font-bold" style={{ color: themeColor }}>{formatCurrency(total)}</p>
            </div>
            <Button
              onClick={nextStep}
              disabled={placeOrderMutation.isPending}
              style={{ backgroundColor: themeColor }}
              className="flex-1 h-12 text-white text-base"
            >
              Continue
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Order Total</span>
              <span className="font-bold text-base" style={{ color: themeColor }}>{formatCurrency(total)}</span>
            </div>
            <Button
              onClick={handlePlaceOrder}
              disabled={isSubmitting || placeOrderMutation.isPending || !agreeToTerms || !ageVerified}
              style={{ backgroundColor: themeColor }}
              className="w-full h-12 text-white text-base font-semibold"
            >
              {isSubmitting || placeOrderMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {formData.paymentMethod === 'card' ? 'Redirecting to payment...' : 'Processing...'}
                </>
              ) : isStoreClosed ? (
                <>
                  <Clock className="w-4 h-4 mr-2" />
                  Place Pre-Order — {formatCurrency(total)}
                </>
              ) : formData.paymentMethod === 'card' ? (
                <>
                  <CreditCard className="w-4 h-4 mr-2" />
                  Pay with Card — {formatCurrency(total)}
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Place Order — {formatCurrency(total)}
                </>
              )}
            </Button>
          </div>
        )}
      </div>
      {/* Spacer for mobile sticky bar */}
      <div className="h-28 lg:hidden" />

      {/* Sign In Dialog */}
      {store?.tenant_id && (
        <CheckoutSignInDialog
          open={signInOpen}
          onOpenChange={setSignInOpen}
          tenantId={store.tenant_id}
          onSignInSuccess={(customer) => {
            setFormData((prev) => ({
              ...prev,
              firstName: customer.firstName || prev.firstName,
              lastName: customer.lastName || prev.lastName,
              email: customer.email || prev.email,
              phone: customer.phone || prev.phone,
            }));
            setIsSignedIn(true);
            setCreateAccount(false);
            setAccountPassword('');
          }}
        />
      )}
      {/* Post-checkout confirmation popup */}
      <PostCheckoutConfirmationDialog
        open={showConfirmationPopup}
        orderNumber={completedOrderData?.orderNumber ?? ''}
        telegramLink={completedOrderData?.telegramLink}
        storePrimaryColor={store?.primary_color ?? '#22c55e'}
        storeName={store?.store_name ?? ''}
        onViewOrderDetails={() => {
          setShowConfirmationPopup(false);
          navigate(`/shop/${storeSlug}/order-confirmation`, {
            state: {
              orderNumber: completedOrderData?.orderNumber,
              trackingToken: completedOrderData?.trackingToken,
              total: completedOrderData?.total,
              telegramLink: completedOrderData?.telegramLink,
            },
          });
        }}
      />
    </div>
  );
}

export default CheckoutPage;
