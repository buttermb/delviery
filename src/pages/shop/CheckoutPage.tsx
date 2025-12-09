// @ts-nocheck
/**
 * Checkout Page
 * Multi-step checkout flow
 */

import { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useShop } from './ShopLayout';
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

interface CartItem {
  productId: string;
  quantity: number;
  price: number;
  name: string;
  imageUrl: string | null;
}

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
  const { toast } = useToast();

  const [currentStep, setCurrentStep] = useState(1);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
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

  // Load cart from localStorage
  useEffect(() => {
    if (store?.id) {
      const savedCart = localStorage.getItem(`shop_cart_${store.id}`);
      if (savedCart) {
        try {
          const items = JSON.parse(savedCart);
          if (items.length === 0) {
            navigate(`/shop/${storeSlug}/cart`);
          } else {
            setCartItems(items);
          }
        } catch {
          navigate(`/shop/${storeSlug}/cart`);
        }
      } else {
        navigate(`/shop/${storeSlug}/cart`);
      }
    }
  }, [store?.id, navigate, storeSlug]);

  // Calculate totals
  const subtotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const freeDeliveryThreshold = store?.free_delivery_threshold || 100;
  const deliveryFee = subtotal >= freeDeliveryThreshold ? 0 : (store?.default_delivery_fee || 5);
  const total = subtotal + deliveryFee;

  // Update form field
  const updateField = (field: keyof CheckoutData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Validate current step
  const validateStep = () => {
    switch (currentStep) {
      case 1:
        if (!formData.firstName || !formData.lastName || !formData.email) {
          toast({ title: 'Please fill in all required fields', variant: 'destructive' });
          return false;
        }
        if (store?.checkout_settings?.require_phone && !formData.phone) {
          toast({ title: 'Phone number is required', variant: 'destructive' });
          return false;
        }
        return true;
      case 2:
        if (!formData.street || !formData.city || !formData.zip) {
          toast({ title: 'Please fill in your delivery address', variant: 'destructive' });
          return false;
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

  // Place order mutation
  const placeOrderMutation = useMutation({
    mutationFn: async () => {
      if (!store?.id) throw new Error('No store');

      // Prepare items for order
      const orderItems = cartItems.map((item) => ({
        product_id: item.productId,
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        image_url: item.imageUrl,
      }));

      const { data, error } = await supabase.rpc('create_marketplace_order', {
        p_store_id: store.id,
        p_items: orderItems,
        p_customer_name: `${formData.firstName} ${formData.lastName}`,
        p_customer_email: formData.email,
        p_customer_phone: formData.phone,
        p_delivery_address: {
          street: formData.street,
          apartment: formData.apartment,
          city: formData.city,
          state: formData.state,
          zip: formData.zip,
        },
        p_delivery_notes: formData.deliveryNotes,
        p_payment_method: formData.paymentMethod,
      });

      if (error) throw error;

      const result = data?.[0];
      if (!result?.success) {
        throw new Error(result?.error_message || 'Failed to place order');
      }

      return result;
    },
    onSuccess: (data) => {
      // Clear cart
      if (store?.id) {
        localStorage.removeItem(`shop_cart_${store.id}`);
        setCartItemCount(0);
      }
      // Navigate to confirmation
      navigate(`/shop/${storeSlug}/order-confirmation`, {
        state: {
          orderNumber: data.order_number,
          trackingToken: data.tracking_token,
          total: data.total,
        },
      });
    },
    onError: (error) => {
      logger.error('Failed to place order', error, { component: 'CheckoutPage' });
      toast({
        title: 'Order failed',
        description: 'Something went wrong. Please try again.',
        variant: 'destructive',
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

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      {/* Steps */}
      <div className="mb-8">
        <nav className="flex justify-between">
          {STEPS.map((step, index) => {
            const Icon = step.icon;
            const isActive = currentStep === step.id;
            const isComplete = currentStep > step.id;

            return (
              <div
                key={step.id}
                className={`flex-1 flex flex-col items-center relative ${
                  index < STEPS.length - 1 ? 'after:content-[\"\"] after:absolute after:top-5 after:left-[calc(50%+20px)] after:w-[calc(100%-40px)] after:h-0.5 after:bg-muted' : ''
                } ${isComplete ? 'after:bg-primary' : ''}`}
              >
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center z-10 ${
                    isActive
                      ? 'ring-2 ring-offset-2'
                      : ''
                  }`}
                  style={{
                    backgroundColor: isComplete || isActive ? store.primary_color : undefined,
                    color: isComplete || isActive ? 'white' : undefined,
                    ringColor: isActive ? store.primary_color : undefined,
                  }}
                >
                  {isComplete ? (
                    <Check className="w-5 h-5" />
                  ) : (
                    <Icon className="w-5 h-5" />
                  )}
                </div>
                <span
                  className={`text-sm mt-2 font-medium ${
                    isActive ? '' : 'text-muted-foreground'
                  }`}
                  style={{ color: isActive ? store.primary_color : undefined }}
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
          <Card>
            <CardContent className="pt-6">
              {/* Step 1: Contact Information */}
              {currentStep === 1 && (
                <div className="space-y-4">
                  <h2 className="text-xl font-semibold mb-4">Contact Information</h2>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="firstName">First Name *</Label>
                      <Input
                        id="firstName"
                        value={formData.firstName}
                        onChange={(e) => updateField('firstName', e.target.value)}
                        placeholder="John"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName">Last Name *</Label>
                      <Input
                        id="lastName"
                        value={formData.lastName}
                        onChange={(e) => updateField('lastName', e.target.value)}
                        placeholder="Doe"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => updateField('email', e.target.value)}
                      placeholder="john@example.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">
                      Phone {store.checkout_settings?.require_phone ? '*' : '(Optional)'}
                    </Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => updateField('phone', e.target.value)}
                      placeholder="(555) 123-4567"
                    />
                  </div>
                </div>
              )}

              {/* Step 2: Delivery Address */}
              {currentStep === 2 && (
                <div className="space-y-4">
                  <h2 className="text-xl font-semibold mb-4">Delivery Address</h2>
                  <div className="space-y-2">
                    <Label htmlFor="street">Street Address *</Label>
                    <Input
                      id="street"
                      value={formData.street}
                      onChange={(e) => updateField('street', e.target.value)}
                      placeholder="123 Main St"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="apartment">Apartment, Suite, etc. (Optional)</Label>
                    <Input
                      id="apartment"
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
                        value={formData.city}
                        onChange={(e) => updateField('city', e.target.value)}
                        placeholder="New York"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="state">State</Label>
                      <Input
                        id="state"
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
                </div>
              )}

              {/* Step 3: Payment Method */}
              {currentStep === 3 && (
                <div className="space-y-4">
                  <h2 className="text-xl font-semibold mb-4">Payment Method</h2>
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
                </div>
              )}

              {/* Step 4: Review Order */}
              {currentStep === 4 && (
                <div className="space-y-6">
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
                </div>
              )}

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
                        Place Order
                        <Check className="w-4 h-4 ml-2" />
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





