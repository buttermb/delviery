import { logger } from '@/lib/logger';
import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import { showErrorToast } from '@/utils/toastHelpers';
import { useMenuCartStore } from '@/stores/menuCartStore';
import { toast } from 'sonner';
import { useMenuPaymentSettings } from '@/hooks/usePaymentSettings';
import { publish } from '@/lib/eventBus';
import { queryKeys } from '@/lib/queryKeys';
import { STORAGE_KEYS } from '@/constants/storageKeys';
import { useReturningCustomerLookup } from '@/hooks/useReturningCustomerLookup';

import type { CheckoutFlowProps, CheckoutStep } from './checkout/types';
import { STEPS, buildPaymentMethods, isValidEmail } from './checkout/types';
import { StepProgress } from './checkout/StepProgress';
import { CartStep } from './checkout/CartStep';
import { DetailsStep } from './checkout/DetailsStep';
import { LocationStep } from './checkout/LocationStep';
import { PaymentStep } from './checkout/PaymentStep';
import { ConfirmStep } from './checkout/ConfirmStep';
import { OrderSuccess } from './checkout/OrderSuccess';

// Main Checkout Flow Component
export function ModernCheckoutFlow({
  open,
  onOpenChange,
  menuId,
  tenantId: tenantIdProp,
  accessToken: _accessToken,
  minOrder: _minOrder,
  maxOrder,
  onOrderComplete,
  products
}: CheckoutFlowProps) {
  const [currentStep, setCurrentStep] = useState<CheckoutStep>('cart');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    rememberMe: false,
    deliveryMethod: 'delivery',
    address: '',
    city: '',
    zipCode: '',
    landmark: '',
    gateCode: '',
    notes: '',
    paymentMethod: 'cash',
  });

  const queryClient = useQueryClient();
  const cartItems = useMenuCartStore((state) => state.items);
  const getTotal = useMenuCartStore((state) => state.getTotal);
  const _getItemCount = useMenuCartStore((state) => state.getItemCount);
  const clearCart = useMenuCartStore((state) => state.clearCart);

  // Fetch payment settings for this menu
  const { data: paymentSettings, isLoading: isLoadingPaymentSettings } = useMenuPaymentSettings(menuId);

  // Build payment methods from settings
  const paymentMethods = useMemo(() => {
    return buildPaymentMethods(paymentSettings);
  }, [paymentSettings]);

  const totalAmount = getTotal();
  const serviceFee = totalAmount * 0.05;
  const finalTotal = totalAmount + serviceFee;

  // Load saved data from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.CHECKOUT_CUSTOMER_DATA);
      if (saved) {
        const parsed = JSON.parse(saved);
        setFormData(prev => ({ ...prev, ...parsed }));
      }
    } catch {
      // Ignore errors
    }
  }, []);

  // Save data to localStorage when rememberMe is checked
  useEffect(() => {
    if (formData.rememberMe) {
      try {
        localStorage.setItem(STORAGE_KEYS.CHECKOUT_CUSTOMER_DATA, JSON.stringify({
          firstName: formData.firstName,
          lastName: formData.lastName,
          phone: formData.phone,
          email: formData.email,
          rememberMe: true,
        }));
      } catch {
        // Ignore errors
      }
    }
  }, [formData]);

  // Returning customer recognition by phone
  const {
    customer: returningCustomer,
    isRecognized,
    isSearching: isLookingUpCustomer,
  } = useReturningCustomerLookup({
    phone: formData.phone,
    tenantId: tenantIdProp,
    enabled: currentStep === 'details',
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
        address: prev.address || returningCustomer.address || '',
      }));
      toast.success('Welcome back!', {
        description: `We recognized your phone number, ${returningCustomer.firstName}.`,
      });
    }
  }, [returningCustomer]);

  const updateFormData = useCallback((field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setErrors(prev => ({ ...prev, [field]: '' }));
  }, []);

  const goToStep = useCallback((step: CheckoutStep) => {
    setCurrentStep(step);
  }, []);

  const validateDetails = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.firstName.trim()) newErrors.firstName = 'Required';
    if (!formData.lastName.trim()) newErrors.lastName = 'Required';
    if (formData.phone.replace(/\D/g, '').length < 10) newErrors.phone = 'Enter a valid phone number';
    if (formData.email && !isValidEmail(formData.email)) newErrors.email = 'Enter a valid email';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    // Validate max order quantity before submission
    const totalItemCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
    if (maxOrder != null && maxOrder > 0 && totalItemCount > maxOrder) {
      showErrorToast('Order Limit Exceeded', `Maximum ${maxOrder} items allowed per order. You have ${totalItemCount}.`);
      return;
    }

    setIsSubmitting(true);

    try {
      const orderItems = cartItems.map(item => ({
        product_id: item.productId,
        quantity: item.quantity,
        price: item.price,
      }));

      const fullAddress = formData.deliveryMethod === 'delivery'
        ? [formData.address, formData.city, formData.zipCode].filter(Boolean).join(', ')
        : '';

      // Map the UI payment method to API-compatible value
      const selectedPaymentMethod = paymentMethods.find(m => m.id === formData.paymentMethod);
      const apiPaymentMethod = selectedPaymentMethod?.apiValue || 'cash';

      // Calculate total for the API
      const totalAmount = getTotal() * 1.05; // Include 5% service fee

      let newOrderId: string | undefined;

      // Try edge function first, fall back to direct DB insert
      try {
        const { data, error } = await supabase.functions.invoke('menu-order-place', {
          body: {
            menu_id: menuId,
            order_items: orderItems,
            contact_phone: formData.phone.replace(/\D/g, ''),
            contact_email: formData.email || undefined,
            customer_name: `${formData.firstName} ${formData.lastName}`.trim(),
            payment_method: apiPaymentMethod,
            delivery_address: fullAddress || undefined,
            customer_notes: formData.notes || undefined,
            total_amount: totalAmount,
          }
        });

        if (error) throw error;

        if (data && typeof data === 'object' && 'error' in data && data.error) {
          const errorMessage = typeof data.error === 'string' ? data.error : 'Failed to place order';
          throw new Error(errorMessage);
        }

        newOrderId = data?.order_id;
      } catch (edgeFnErr: unknown) {
        // Edge function failed -- fall back to direct DB insert
        logger.warn('Edge function order placement failed, using direct insert', edgeFnErr, {
          component: 'ModernCheckoutFlow',
        });

        if (!tenantIdProp) {
          throw new Error('Unable to place order. Please try refreshing the page.');
        }

        const orderData = {
          items: orderItems.map(item => ({
            ...item,
            product_name: cartItems.find(ci => ci.productId === item.product_id)?.productName,
            subtotal: item.price * item.quantity,
          })),
          total: totalAmount,
          customer_name: `${formData.firstName} ${formData.lastName}`.trim(),
          contact_email: formData.email || undefined,
          delivery_method: formData.deliveryMethod,
          delivery_address: fullAddress || undefined,
          payment_method: apiPaymentMethod,
          notes: formData.notes || undefined,
        };

        const { data: insertResult, error: insertError } = await supabase
          .from('menu_orders')
          .insert({
            menu_id: menuId,
            tenant_id: tenantIdProp,
            contact_phone: formData.phone.replace(/\D/g, ''),
            total_amount: totalAmount,
            status: 'pending' as const,
            order_data: orderData as unknown as Json,
            payment_method: apiPaymentMethod,
            delivery_method: formData.deliveryMethod,
            delivery_address: fullAddress || undefined,
            customer_notes: formData.notes || undefined,
          })
          .select('id')
          .maybeSingle();

        if (insertError) throw insertError;
        newOrderId = insertResult?.id;
      }

      const orderId = newOrderId || crypto.randomUUID();
      setOrderId(orderId);
      clearCart();
      onOrderComplete(orderId, finalTotal);

      // Use provided tenantId for event publishing (avoids RLS issues with anon client)
      const tenantId = tenantIdProp;

      if (tenantId) {
        publish('order_created', {
          orderId,
          tenantId,
        });

        logger.info('Menu order event published', {
          orderId,
          tenantId,
          component: 'ModernCheckoutFlow',
        });

        queryClient.invalidateQueries({ queryKey: queryKeys.orders.live(tenantId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.stats(tenantId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.menuOrders.all });
        queryClient.invalidateQueries({ queryKey: queryKeys.badgeCounts.all });
        queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all });
      }

    } catch (err: unknown) {
      logger.error('Order submission error', err, { component: 'ModernCheckoutFlow' });
      const errorMessage = err instanceof Error ? err.message : 'Could not place order';
      showErrorToast('Order Failed', errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setOrderId(null);
    setCurrentStep('cart');
    onOpenChange(false);
  };

  // Reset step when sheet closes
  useEffect(() => {
    if (!open) {
      setCurrentStep('cart');
      setOrderId(null);
    }
  }, [open]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        className="w-full sm:max-w-lg flex flex-col p-0 h-[95vh] sm:h-full"
        side="bottom"
      >
        {/* Header */}
        {!orderId && (
          <SheetHeader className="px-4 py-3 border-b shrink-0">
            <SheetTitle className="text-lg flex items-center justify-between">
              <span>Checkout</span>
              <Badge variant="secondary" className="font-normal">
                ${finalTotal.toFixed(2)}
              </Badge>
            </SheetTitle>
          </SheetHeader>
        )}

        {/* Content */}
        <div className="flex-1 flex flex-col min-h-0">
          {orderId ? (
            <OrderSuccess
              orderId={orderId}
              formData={formData}
              onClose={handleClose}
              menuId={menuId}
            />
          ) : (
            <>
              {/* Step Progress */}
              <StepProgress
                steps={STEPS}
                currentStep={currentStep}
                onStepClick={goToStep}
              />

              {/* Step Content */}
              <div className="flex-1 min-h-0">
                {currentStep === 'cart' && (
                  <CartStep
                    onNext={() => goToStep('details')}
                    onClose={() => onOpenChange(false)}
                    products={products}
                    maxOrder={maxOrder}
                  />
                )}
                {currentStep === 'details' && (
                  <DetailsStep
                    formData={formData}
                    onUpdate={updateFormData}
                    onNext={() => {
                      if (validateDetails()) goToStep('location');
                    }}
                    onBack={() => goToStep('cart')}
                    errors={errors}
                    isRecognized={isRecognized}
                    isLookingUp={isLookingUpCustomer}
                    recognizedName={returningCustomer?.firstName}
                  />
                )}
                {currentStep === 'location' && (
                  <LocationStep
                    formData={formData}
                    onUpdate={updateFormData}
                    onNext={() => goToStep('payment')}
                    onBack={() => goToStep('details')}
                  />
                )}
                {currentStep === 'payment' && (
                  <PaymentStep
                    formData={formData}
                    totalAmount={finalTotal}
                    onUpdate={updateFormData}
                    onNext={() => goToStep('confirm')}
                    onBack={() => goToStep('location')}
                    paymentMethods={paymentMethods}
                    isLoadingSettings={isLoadingPaymentSettings}
                  />
                )}
                {currentStep === 'confirm' && (
                  <ConfirmStep
                    formData={formData}
                    onSubmit={handleSubmit}
                    onBack={() => goToStep('payment')}
                    onEdit={goToStep}
                    isSubmitting={isSubmitting}
                    paymentMethods={paymentMethods}
                  />
                )}
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default ModernCheckoutFlow;
