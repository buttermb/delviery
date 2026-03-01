/**
 * Single Page Checkout
 * Streamlined one-page checkout experience
 */

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useParams, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { sanitizeFormInput, sanitizeEmail, sanitizePhoneInput, sanitizeTextareaInput } from '@/lib/utils/sanitize';
import { useShop } from '@/pages/shop/ShopLayout';
import { useLuxuryTheme } from '@/components/shop/luxury';
import { useShopCart } from '@/hooks/useShopCart';
import { useInventoryCheck } from '@/hooks/useInventoryCheck';
import ProductImage from '@/components/ProductImage';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Package,
  Truck,
  CreditCard,
  ShoppingCart,
  Loader2,
  AlertTriangle,
  AlertCircle,
  Check,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { humanizeError } from '@/lib/humanizeError';
import { STORAGE_KEYS } from '@/constants/storageKeys';
import { safeStorage } from '@/utils/safeStorage';
import { PostCheckoutConfirmationDialog } from '@/components/shop/PostCheckoutConfirmationDialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { logger } from '@/lib/logger';

const checkoutSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
  email: z.string().min(1, 'Email is required').email('Invalid email address').max(255),
  phone: z.string().max(20).optional().or(z.literal('')),
  street: z.string().min(1, 'Street address is required').max(200),
  apartment: z.string().max(100).optional().or(z.literal('')),
  city: z.string().min(1, 'City is required').max(100),
  state: z.string().max(50).optional().or(z.literal('')),
  zip: z.string().min(1, 'ZIP code is required').max(20),
  deliveryNotes: z.string().max(500).optional().or(z.literal('')),
  paymentMethod: z.string().min(1),
});

type CheckoutFormValues = z.infer<typeof checkoutSchema>;

export function SinglePageCheckout() {
  const { storeSlug } = useParams<{ storeSlug: string }>();
  const navigate = useNavigate();
  const { store, setCartItemCount } = useShop();
  const { isLuxuryTheme, accentColor } = useLuxuryTheme();
  const { checkCartStock } = useInventoryCheck();

  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [stockIssues, setStockIssues] = useState<Array<{ productName: string; available: number; requested: number }>>([]);
  const [isCheckingStock, setIsCheckingStock] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof CheckoutFormData, string>>>({});
  const [orderRetryCount, setOrderRetryCount] = useState(0);

  // Post-checkout confirmation popup state
  const [showConfirmationPopup, setShowConfirmationPopup] = useState(false);
  const [completedOrderId, setCompletedOrderId] = useState<string | null>(null);

  const form = useForm<CheckoutFormValues>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
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
    },
  });

  // Cart hook
  const { cartItems, subtotal, clearCart, isInitialized } = useShopCart({
    storeId: store?.id,
    onCartChange: setCartItemCount,
  });

  // Load saved form data
  const formStorageKey = store?.id ? `${STORAGE_KEYS.SHOP_CHECKOUT_FORM_PREFIX}${store.id}` : null;

  useEffect(() => {
    if (formStorageKey) {
      try {
        const saved = safeStorage.getItem(formStorageKey);
        if (saved) {
          const parsed = JSON.parse(saved) as Partial<CheckoutFormValues>;
          form.reset({ ...form.getValues(), ...parsed });
        }
      } catch (e) { logger.warn('[Checkout] Failed to load saved form data', { error: e }); }
    }
  }, [formStorageKey]);

  // Save form data on change
  const watchedValues = form.watch();
  useEffect(() => {
    if (formStorageKey && watchedValues.email) {
      try {
        safeStorage.setItem(formStorageKey, JSON.stringify(formData));
        localStorage.setItem(formStorageKey, JSON.stringify(watchedValues));
      } catch (e) { logger.warn('[Checkout] Failed to save form data', { error: e }); }
    }
  }, [watchedValues, formStorageKey]);

  // Check stock on mount
  useEffect(() => {
    if (isInitialized && cartItems.length > 0) {
      checkStock();
    }
  }, [isInitialized, cartItems.length]);

  // Redirect if cart empty
  useEffect(() => {
    if (isInitialized && cartItems.length === 0) {
      toast.warning('Your cart is empty');
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

  // Helper: detect network errors worth retrying
  const isNetworkError = (err: unknown): boolean => {
    const msg = err instanceof Error ? err.message : String(err);
    const lower = msg.toLowerCase();
    return lower.includes('network') ||
      lower.includes('fetch') ||
      lower.includes('timeout') ||
      lower.includes('failed to fetch') ||
      lower.includes('load failed') ||
      msg === '';
  };

  // Place order mutation with retry logic
  // Place order mutation
  const placeOrderMutation = useMutation({
    mutationFn: async (values: CheckoutFormValues) => {
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

      const sanitizedFirstName = sanitizeFormInput(values.firstName, 100);
      const sanitizedLastName = sanitizeFormInput(values.lastName, 100);
      const sanitizedStreet = sanitizeFormInput(values.street, 200);
      const sanitizedApt = values.apartment ? sanitizeFormInput(values.apartment, 100) : '';
      const sanitizedCity = sanitizeFormInput(values.city, 100);
      const sanitizedState = sanitizeFormInput(values.state || '', 50);
      const sanitizedZip = sanitizeFormInput(values.zip, 20);

      // Submit with retry on network errors
      const MAX_RETRIES = 3;
      const submitWithRetry = async (attempt: number): Promise<{ order_id: string }> => {
        try {
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
      const { data: orderId, error } = await supabase.rpc('create_marketplace_order', {
        p_store_id: store.id,
        p_items: orderItems,
        p_customer_name: `${sanitizedFirstName} ${sanitizedLastName}`,
        p_customer_email: sanitizeEmail(values.email),
        p_customer_phone: values.phone ? sanitizePhoneInput(values.phone) : null,
        p_delivery_address: `${sanitizedStreet}${sanitizedApt ? ', ' + sanitizedApt : ''}, ${sanitizedCity}, ${sanitizedState} ${sanitizedZip}`,
        p_delivery_notes: values.deliveryNotes ? sanitizeTextareaInput(values.deliveryNotes, 500) : null,
        p_subtotal: subtotal,
        p_tax: 0,
        p_delivery_fee: deliveryFee,
        p_total: total,
        p_payment_method: values.paymentMethod,
      });

          if (error) throw error;
          if (!orderId) throw new Error('Failed to create order');

          return { order_id: orderId as string };
        } catch (err: unknown) {
          if (isNetworkError(err) && attempt < MAX_RETRIES) {
            setOrderRetryCount(attempt);
            toast.warning(`Connection issue, retrying (${attempt}/${MAX_RETRIES})...`, {
              description: 'Your cart is safe. Retrying automatically.',
            });
            await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt - 1)));
            return submitWithRetry(attempt + 1);
          }
          logger.error('Order submission error', err, { attempt, component: 'SinglePageCheckout' });
          throw err;
        }
      };

      return submitWithRetry(1);
      return { order_id: orderId, formValues: values };
    },
    onSuccess: async (data) => {
      // Clear cart and form
      clearCart();
      if (formStorageKey) {
        safeStorage.removeItem(formStorageKey);
      setOrderRetryCount(0);
      // Clear cart and form only on success — never on failure
      if (store?.id) {
        safeStorage.removeItem(`${STORAGE_KEYS.SHOP_CART_PREFIX}${store.id}`);
        if (formStorageKey) safeStorage.removeItem(formStorageKey);
        setCartItemCount(0);
      }

      const values = data.formValues;

      // Send order confirmation email (fire and forget)
      if (values.email) {
        supabase.functions.invoke('send-order-confirmation', {
          body: {
            order_id: data.order_id,
            customer_email: values.email,
            customer_name: `${values.firstName} ${values.lastName}`.trim(),
            order_number: data.order_id,
            items: cartItems.map((item) => ({
              name: item.name,
              quantity: item.quantity,
              price: item.price,
            })),
            subtotal,
            delivery_fee: deliveryFee,
            total,
            store_name: store?.store_name || 'Store',
          },
        }).catch((err) => {
          logger.warn('Failed to send order confirmation email', err, { component: 'SinglePageCheckout' });
        });
      }

      // Show confirmation popup before navigating
      setCompletedOrderId(data.order_id);
      setShowConfirmationPopup(true);
    },
    onError: (error: Error) => {
      setOrderRetryCount(0);
      logger.error('Order failed', error, { component: 'SinglePageCheckout' });

      const isRetryable = isNetworkError(error) ||
        error.message.toLowerCase().includes('internal server error') ||
        error.message.toLowerCase().includes('500');

      // Cart is preserved — user can retry without losing anything
      toast.error(
        isRetryable ? 'Connection error' : 'Order failed',
        {
          description: isRetryable
            ? 'Could not reach the server. Your cart is saved — tap Retry when ready.'
            : humanizeError(error, 'Something went wrong'),
          duration: 10000,
          action: {
            label: 'Retry',
            onClick: () => handleSubmit(),
          },
        },
      );
    },
  });

  const handleSubmit = (values: CheckoutFormValues) => {
    if (!agreeToTerms) {
      toast.error('Please agree to the terms');
      return;
    }

    if (stockIssues.length > 0) {
      toast.error('Some items are out of stock');
      return;
    }

    placeOrderMutation.mutate(values);
  };

  if (!store) return null;

  const themeColor = isLuxuryTheme ? accentColor : store.primary_color;

  return (
    <div className="container mx-auto px-4 py-4 sm:py-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3 sm:gap-4 mb-4 sm:mb-6">
        <Button
          variant="ghost"
          size="icon"
          className="min-w-[44px] min-h-[44px]"
          onClick={() => navigate(`/shop/${storeSlug}/cart`)}
          aria-label="Back to cart"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Checkout</h1>
          <p className="text-muted-foreground text-xs sm:text-sm">
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

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 sm:gap-6">
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name *</Label>
                  <Input
                    id="firstName"
                    autoComplete="given-name"
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
                    autoComplete="family-name"
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
                  autoComplete="email"
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
                  autoComplete="tel"
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
                  autoComplete="street-address"
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
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div className="space-y-2 col-span-2 sm:col-span-1">
                  <Label htmlFor="city">City *</Label>
                  <Input
                    id="city"
                    autoComplete="address-level2"
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
                    autoComplete="address-level1"
                    value={formData.state}
                    onChange={(e) => updateField('state', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="zip">ZIP *</Label>
                  <Input
                    id="zip"
                    autoComplete="postal-code"
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
                  <div key={`${item.productId}-${item.variant ?? ''}`} className="flex gap-3">
                    <div className="w-14 h-14 bg-muted rounded flex-shrink-0 overflow-hidden">
                      <ProductImage
                        src={item.imageUrl}
                        alt={item.name}
                        className="w-full h-full"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.name}</p>
                      <p className="text-xs text-muted-foreground">Qty: {item.quantity}</p>
                    </div>
                    <p className="text-sm font-medium">{formatCurrency(item.price * item.quantity)}</p>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)}>
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 sm:gap-6">
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="firstName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel required>First Name</FormLabel>
                          <FormControl>
                            <Input {...field} autoComplete="given-name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="lastName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel required>Last Name</FormLabel>
                          <FormControl>
                            <Input {...field} autoComplete="family-name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel required>Email</FormLabel>
                        <FormControl>
                          <Input {...field} type="email" autoComplete="email" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone (optional)</FormLabel>
                        <FormControl>
                          <Input {...field} type="tel" autoComplete="tel" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
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
                  <FormField
                    control={form.control}
                    name="street"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel required>Street Address</FormLabel>
                        <FormControl>
                          <Input {...field} autoComplete="street-address" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="apartment"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Apt, Suite, etc. (optional)</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="city"
                      render={({ field }) => (
                        <FormItem className="col-span-2 sm:col-span-1">
                          <FormLabel required>City</FormLabel>
                          <FormControl>
                            <Input {...field} autoComplete="address-level2" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="state"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>State</FormLabel>
                          <FormControl>
                            <Input {...field} autoComplete="address-level1" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="zip"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel required>ZIP</FormLabel>
                          <FormControl>
                            <Input {...field} autoComplete="postal-code" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="deliveryNotes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Delivery Notes (optional)</FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            placeholder="Gate code, building instructions..."
                            rows={2}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
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
                  <FormField
                    control={form.control}
                    name="paymentMethod"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <RadioGroup
                            value={field.value}
                            onValueChange={field.onChange}
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
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
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
                      <div key={`${item.productId}-${item.variant ?? ''}`} className="flex gap-3">
                        <div className="w-14 h-14 bg-muted rounded flex-shrink-0">
                          {item.imageUrl ? (
                            <img
                              src={item.imageUrl}
                              alt={item.name}
                              className="w-full h-full object-cover rounded"
                              loading="lazy"
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
                    type="submit"
                    className="w-full h-12 text-base"
                    style={{ backgroundColor: themeColor }}
                    disabled={
                      placeOrderMutation.isPending ||
                      stockIssues.length > 0 ||
                      isCheckingStock
                    }
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

              {/* Error banner after failed attempt */}
              {placeOrderMutation.isError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Order could not be placed</AlertTitle>
                  <AlertDescription>
                    {isNetworkError(placeOrderMutation.error)
                      ? 'We had trouble connecting to the server. Your cart and information are saved — you can try again.'
                      : humanizeError(placeOrderMutation.error)}
                  </AlertDescription>
                </Alert>
              )}

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
                    {orderRetryCount > 0 ? `Retrying (${orderRetryCount}/3)...` : 'Processing...'}
                  </>
                ) : placeOrderMutation.isError ? (
                  <>
                    <AlertCircle className="w-5 h-5 mr-2" />
                    Retry Order • {formatCurrency(total)}
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
                </CardContent>
              </Card>
            </div>
          </div>
        </form>
      </Form>

      {/* Sticky Mobile Checkout Bar */}
      <div className="fixed bottom-0 left-0 right-0 lg:hidden bg-background/95 backdrop-blur-md border-t p-4 z-50">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="text-lg font-bold" style={{ color: themeColor }}>
              {formatCurrency(total)}
            </p>
          </div>
          <Button
            className="flex-1 max-w-[200px] h-12 text-sm"
            style={{ backgroundColor: themeColor }}
            disabled={
              placeOrderMutation.isPending ||
              stockIssues.length > 0 ||
              isCheckingStock
            }
            onClick={form.handleSubmit(handleSubmit)}
          >
            {placeOrderMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {orderRetryCount > 0 ? `Retrying (${orderRetryCount}/3)...` : 'Processing...'}
              </>
            ) : placeOrderMutation.isError ? (
              <>
                <AlertCircle className="w-4 h-4 mr-2" />
                Retry Order
              </>
            ) : (
              <>
                <Check className="w-4 h-4 mr-2" />
                Place Order
              </>
            )}
          </Button>
        </div>
      </div>
      {/* Spacer for mobile sticky bar */}
      <div className="h-24 lg:hidden" />

      {/* Post-checkout confirmation popup */}
      <PostCheckoutConfirmationDialog
        open={showConfirmationPopup}
        orderNumber={completedOrderId ?? ''}
        storePrimaryColor={store?.primary_color ?? '#22c55e'}
        storeName={store?.store_name ?? ''}
        onViewOrderDetails={() => {
          setShowConfirmationPopup(false);
          navigate(`/shop/${storeSlug}/order-confirmation`, {
            state: { orderId: completedOrderId },
          });
        }}
      />
    </div>
  );
}

export default SinglePageCheckout;
