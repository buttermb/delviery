import { logger } from '@/lib/logger';
import { useState, useCallback, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  ShoppingCart, User, MapPin, CreditCard, Check, ArrowRight, ArrowLeft,
  Loader2, Package, Minus, Plus, Trash2, Phone, Mail, Home, 
  Truck, Store, Wallet, Banknote, Shield, Clock, ChevronRight,
  Sparkles, AlertCircle, CheckCircle
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showSuccessToast, showErrorToast } from '@/utils/toastHelpers';
import { useMenuCartStore } from '@/stores/menuCartStore';
import { formatWeight } from '@/utils/productHelpers';
import { cn } from '@/lib/utils';
import confetti from 'canvas-confetti';

interface CheckoutFlowProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  menuId: string;
  accessToken?: string;
  minOrder?: number;
  maxOrder?: number;
  onOrderComplete: () => void;
}

type CheckoutStep = 'cart' | 'contact' | 'delivery' | 'payment' | 'confirm';

const STEPS: { id: CheckoutStep; label: string; icon: React.ElementType }[] = [
  { id: 'cart', label: 'Cart', icon: ShoppingCart },
  { id: 'contact', label: 'Contact', icon: User },
  { id: 'delivery', label: 'Delivery', icon: Truck },
  { id: 'payment', label: 'Payment', icon: CreditCard },
  { id: 'confirm', label: 'Confirm', icon: Check },
];

const DELIVERY_METHODS = [
  { id: 'delivery', label: 'Delivery', icon: Truck, description: 'We deliver to your location' },
  { id: 'pickup', label: 'Pickup', icon: Store, description: 'Pick up at our location' },
];

const PAYMENT_METHODS = [
  { id: 'cash', label: 'Cash', icon: Banknote, description: 'Pay with cash on delivery/pickup' },
  { id: 'zelle', label: 'Zelle', icon: Wallet, description: 'Send payment via Zelle' },
  { id: 'cashapp', label: 'CashApp', icon: Wallet, description: 'Send payment via CashApp' },
];

// Step Progress Indicator
function StepProgress({ 
  steps, 
  currentStep,
  onStepClick 
}: { 
  steps: typeof STEPS;
  currentStep: CheckoutStep;
  onStepClick?: (step: CheckoutStep) => void;
}) {
  const currentIndex = steps.findIndex(s => s.id === currentStep);
  
  return (
    <div className="flex items-center justify-between px-2 py-3">
      {steps.map((step, index) => {
        const Icon = step.icon;
        const isActive = index === currentIndex;
        const isComplete = index < currentIndex;
        const isClickable = isComplete && onStepClick;
        
        return (
          <div key={step.id} className="flex items-center flex-1">
            <button
              onClick={() => isClickable && onStepClick(step.id)}
              disabled={!isClickable}
              className={cn(
                "flex flex-col items-center gap-1 transition-all",
                isClickable && "cursor-pointer hover:opacity-80"
              )}
            >
              <div className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center transition-all",
                isActive && "bg-primary text-primary-foreground shadow-lg shadow-primary/30 scale-110",
                isComplete && "bg-emerald-500 text-white",
                !isActive && !isComplete && "bg-muted text-muted-foreground"
              )}>
                {isComplete ? (
                  <Check className="h-5 w-5" />
                ) : (
                  <Icon className="h-5 w-5" />
                )}
              </div>
              <span className={cn(
                "text-xs font-medium",
                isActive && "text-primary",
                isComplete && "text-emerald-600",
                !isActive && !isComplete && "text-muted-foreground"
              )}>
                {step.label}
              </span>
            </button>
            {index < steps.length - 1 && (
              <div className={cn(
                "flex-1 h-0.5 mx-2",
                index < currentIndex ? "bg-emerald-500" : "bg-muted"
              )} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// Cart Step Component
function CartStep({ 
  onNext 
}: { 
  onNext: () => void;
}) {
  const cartItems = useMenuCartStore((state) => state.items);
  const removeItem = useMenuCartStore((state) => state.removeItem);
  const updateQuantity = useMenuCartStore((state) => state.updateQuantity);
  const getTotal = useMenuCartStore((state) => state.getTotal);
  const getItemCount = useMenuCartStore((state) => state.getItemCount);

  const totalAmount = getTotal();
  const totalItems = getItemCount();

  if (cartItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <ShoppingCart className="h-16 w-16 text-muted-foreground mb-4 opacity-30" />
        <h3 className="text-lg font-semibold mb-2">Your cart is empty</h3>
        <p className="text-muted-foreground text-sm">Add some products to continue</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-2">
        {cartItems.map((item) => (
          <Card key={`${item.productId}-${item.weight}`} className="p-3">
            <div className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{item.productName}</div>
                <div className="flex items-center gap-2 mt-1">
                  {item.weight && (
                    <Badge variant="secondary" className="text-xs">
                      {formatWeight(item.weight)}
                    </Badge>
                  )}
                  <span className="text-sm text-muted-foreground">
                    ${item.price.toFixed(2)} each
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="icon"
                  variant="outline"
                  className="h-8 w-8"
                  onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                >
                  <Minus className="h-3 w-3" />
                </Button>
                <span className="w-8 text-center font-medium">{item.quantity}</span>
                <Button
                  size="icon"
                  variant="outline"
                  className="h-8 w-8"
                  onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                >
                  <Plus className="h-3 w-3" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-red-500 hover:text-red-600"
                  onClick={() => removeItem(item.productId)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="text-right font-bold text-primary mt-2">
              ${(item.price * item.quantity).toFixed(2)}
            </div>
          </Card>
        ))}
      </div>

      <div className="border-t pt-4 space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground">Subtotal ({totalItems} items)</span>
          <span className="font-semibold">${totalAmount.toFixed(2)}</span>
        </div>
        <div className="flex justify-between items-center text-lg font-bold">
          <span>Total</span>
          <span className="text-primary">${totalAmount.toFixed(2)}</span>
        </div>
      </div>

      <Button onClick={onNext} className="w-full h-12 text-lg" size="lg">
        Continue to Contact
        <ArrowRight className="h-5 w-5 ml-2" />
      </Button>
    </div>
  );
}

// Contact Step Component
function ContactStep({ 
  formData,
  onUpdate,
  onNext,
  onBack 
}: { 
  formData: { name: string; phone: string; email: string };
  onUpdate: (field: string, value: string) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const isValid = formData.name.trim() && formData.phone.trim();

  return (
    <div className="space-y-4">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            Full Name *
          </Label>
          <Input
            id="name"
            placeholder="Enter your name"
            value={formData.name}
            onChange={(e) => onUpdate('name', e.target.value)}
            className="h-12"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone" className="flex items-center gap-2">
            <Phone className="h-4 w-4" />
            Phone Number *
          </Label>
          <Input
            id="phone"
            type="tel"
            placeholder="(555) 123-4567"
            value={formData.phone}
            onChange={(e) => onUpdate('phone', e.target.value)}
            className="h-12"
          />
          <p className="text-xs text-muted-foreground">
            We'll text you order updates
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="email" className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Email (optional)
          </Label>
          <Input
            id="email"
            type="email"
            placeholder="your@email.com"
            value={formData.email}
            onChange={(e) => onUpdate('email', e.target.value)}
            className="h-12"
          />
        </div>
      </div>

      <div className="flex gap-3 pt-4">
        <Button variant="outline" onClick={onBack} className="h-12">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <Button 
          onClick={onNext} 
          disabled={!isValid}
          className="flex-1 h-12 text-lg"
        >
          Continue
          <ArrowRight className="h-5 w-5 ml-2" />
        </Button>
      </div>
    </div>
  );
}

// Delivery Step Component
function DeliveryStep({ 
  formData,
  onUpdate,
  onNext,
  onBack 
}: { 
  formData: { deliveryMethod: string; address: string; notes: string };
  onUpdate: (field: string, value: string) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const needsAddress = formData.deliveryMethod === 'delivery';
  const isValid = formData.deliveryMethod && (!needsAddress || formData.address.trim());

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {DELIVERY_METHODS.map((method) => {
          const Icon = method.icon;
          const isSelected = formData.deliveryMethod === method.id;
          
          return (
            <Card 
              key={method.id}
              className={cn(
                "cursor-pointer transition-all",
                isSelected 
                  ? "border-primary bg-primary/5 ring-2 ring-primary" 
                  : "hover:border-primary/50"
              )}
              onClick={() => onUpdate('deliveryMethod', method.id)}
            >
              <CardContent className="p-4 flex items-center gap-4">
                <div className={cn(
                  "w-12 h-12 rounded-full flex items-center justify-center",
                  isSelected ? "bg-primary text-primary-foreground" : "bg-muted"
                )}>
                  <Icon className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <div className="font-semibold">{method.label}</div>
                  <div className="text-sm text-muted-foreground">{method.description}</div>
                </div>
                {isSelected && (
                  <Check className="h-5 w-5 text-primary" />
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {needsAddress && (
        <div className="space-y-2 pt-2">
          <Label htmlFor="address" className="flex items-center gap-2">
            <Home className="h-4 w-4" />
            Delivery Address *
          </Label>
          <Textarea
            id="address"
            placeholder="Enter your full delivery address"
            value={formData.address}
            onChange={(e) => onUpdate('address', e.target.value)}
            rows={3}
            className="resize-none"
          />
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="notes" className="flex items-center gap-2">
          <Package className="h-4 w-4" />
          Special Instructions (optional)
        </Label>
        <Textarea
          id="notes"
          placeholder="Any special requests or instructions..."
          value={formData.notes}
          onChange={(e) => onUpdate('notes', e.target.value)}
          rows={2}
          className="resize-none"
        />
      </div>

      <div className="flex gap-3 pt-4">
        <Button variant="outline" onClick={onBack} className="h-12">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <Button 
          onClick={onNext} 
          disabled={!isValid}
          className="flex-1 h-12 text-lg"
        >
          Continue
          <ArrowRight className="h-5 w-5 ml-2" />
        </Button>
      </div>
    </div>
  );
}

// Payment Step Component
function PaymentStep({ 
  formData,
  onUpdate,
  onNext,
  onBack 
}: { 
  formData: { paymentMethod: string };
  onUpdate: (field: string, value: string) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const isValid = !!formData.paymentMethod;

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {PAYMENT_METHODS.map((method) => {
          const Icon = method.icon;
          const isSelected = formData.paymentMethod === method.id;
          
          return (
            <Card 
              key={method.id}
              className={cn(
                "cursor-pointer transition-all",
                isSelected 
                  ? "border-primary bg-primary/5 ring-2 ring-primary" 
                  : "hover:border-primary/50"
              )}
              onClick={() => onUpdate('paymentMethod', method.id)}
            >
              <CardContent className="p-4 flex items-center gap-4">
                <div className={cn(
                  "w-12 h-12 rounded-full flex items-center justify-center",
                  isSelected ? "bg-primary text-primary-foreground" : "bg-muted"
                )}>
                  <Icon className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <div className="font-semibold">{method.label}</div>
                  <div className="text-sm text-muted-foreground">{method.description}</div>
                </div>
                {isSelected && (
                  <Check className="h-5 w-5 text-primary" />
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Alert className="bg-amber-500/10 border-amber-500/20">
        <Shield className="h-4 w-4 text-amber-500" />
        <AlertDescription className="text-amber-700 dark:text-amber-300">
          Your order details are encrypted and secure. Payment will be collected upon {formData.paymentMethod === 'cash' ? 'delivery/pickup' : 'confirmation'}.
        </AlertDescription>
      </Alert>

      <div className="flex gap-3 pt-4">
        <Button variant="outline" onClick={onBack} className="h-12">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <Button 
          onClick={onNext} 
          disabled={!isValid}
          className="flex-1 h-12 text-lg"
        >
          Review Order
          <ArrowRight className="h-5 w-5 ml-2" />
        </Button>
      </div>
    </div>
  );
}

// Confirm Step Component
function ConfirmStep({ 
  formData,
  onSubmit,
  onBack,
  isSubmitting
}: { 
  formData: {
    name: string;
    phone: string;
    email: string;
    deliveryMethod: string;
    address: string;
    notes: string;
    paymentMethod: string;
    agreeToTerms: boolean;
  };
  onSubmit: () => void;
  onBack: () => void;
  isSubmitting: boolean;
}) {
  const cartItems = useMenuCartStore((state) => state.items);
  const getTotal = useMenuCartStore((state) => state.getTotal);
  const getItemCount = useMenuCartStore((state) => state.getItemCount);
  
  const [agreed, setAgreed] = useState(false);

  const totalAmount = getTotal();
  const totalItems = getItemCount();

  const deliveryLabel = DELIVERY_METHODS.find(m => m.id === formData.deliveryMethod)?.label;
  const paymentLabel = PAYMENT_METHODS.find(m => m.id === formData.paymentMethod)?.label;

  return (
    <div className="space-y-4">
      {/* Order Summary */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <ShoppingCart className="h-4 w-4" />
            Order Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {cartItems.map((item) => (
            <div key={`${item.productId}-${item.weight}`} className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                {item.quantity}x {item.productName}
                {item.weight && ` (${formatWeight(item.weight)})`}
              </span>
              <span className="font-medium">${(item.price * item.quantity).toFixed(2)}</span>
            </div>
          ))}
          <div className="border-t pt-2 mt-2 flex justify-between font-bold">
            <span>Total ({totalItems} items)</span>
            <span className="text-primary">${totalAmount.toFixed(2)}</span>
          </div>
        </CardContent>
      </Card>

      {/* Contact Info */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <User className="h-4 w-4" />
            Contact
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-1">
          <div><span className="text-muted-foreground">Name:</span> {formData.name}</div>
          <div><span className="text-muted-foreground">Phone:</span> {formData.phone}</div>
          {formData.email && (
            <div><span className="text-muted-foreground">Email:</span> {formData.email}</div>
          )}
        </CardContent>
      </Card>

      {/* Delivery & Payment */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="p-3 text-center">
            <Truck className="h-6 w-6 mx-auto mb-1 text-primary" />
            <div className="text-xs text-muted-foreground">Delivery</div>
            <div className="font-semibold text-sm">{deliveryLabel}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <CreditCard className="h-6 w-6 mx-auto mb-1 text-primary" />
            <div className="text-xs text-muted-foreground">Payment</div>
            <div className="font-semibold text-sm">{paymentLabel}</div>
          </CardContent>
        </Card>
      </div>

      {formData.address && (
        <Card>
          <CardContent className="p-3">
            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div className="text-sm">{formData.address}</div>
            </div>
          </CardContent>
        </Card>
      )}

      {formData.notes && (
        <Card>
          <CardContent className="p-3">
            <div className="flex items-start gap-2">
              <Package className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div className="text-sm text-muted-foreground">{formData.notes}</div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Legal Agreement */}
      <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
        <Checkbox
          id="terms"
          checked={agreed}
          onCheckedChange={(checked) => setAgreed(checked === true)}
          className="mt-0.5"
        />
        <label htmlFor="terms" className="text-xs text-muted-foreground cursor-pointer">
          I confirm this order is for personal use only. I am 21+ years of age and agree to the terms of service. I understand that providing false information may result in order cancellation.
        </label>
      </div>

      <div className="flex gap-3 pt-2">
        <Button variant="outline" onClick={onBack} disabled={isSubmitting} className="h-12">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <Button 
          onClick={onSubmit} 
          disabled={!agreed || isSubmitting}
          className="flex-1 h-12 text-lg bg-gradient-to-r from-primary to-emerald-600 hover:from-primary/90 hover:to-emerald-600/90"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              Placing Order...
            </>
          ) : (
            <>
              <Check className="h-5 w-5 mr-2" />
              Place Order
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

// Success State Component
function OrderSuccess({ 
  orderId,
  onClose 
}: { 
  orderId: string;
  onClose: () => void;
}) {
  useEffect(() => {
    // Trigger confetti
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 }
    });
  }, []);

  return (
    <div className="text-center py-8 space-y-6">
      <div className="relative inline-block">
        <div className="absolute inset-0 bg-emerald-500/20 rounded-full blur-xl animate-pulse" />
        <div className="relative w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-2xl shadow-emerald-500/30">
          <CheckCircle className="h-12 w-12 text-white" />
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-emerald-600">Order Placed!</h2>
        <p className="text-muted-foreground">
          Your order has been submitted successfully
        </p>
      </div>

      <Card className="bg-muted/50">
        <CardContent className="p-4">
          <div className="text-sm text-muted-foreground mb-1">Order Reference</div>
          <div className="font-mono text-lg font-bold">{orderId.slice(0, 8).toUpperCase()}</div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4" />
          <span>You'll receive a text with updates</span>
        </div>
        
        <Button onClick={onClose} className="w-full h-12" size="lg">
          Done
        </Button>
      </div>
    </div>
  );
}

// Main Checkout Flow Component
export function ModernCheckoutFlow({
  open,
  onOpenChange,
  menuId,
  accessToken,
  minOrder,
  maxOrder,
  onOrderComplete
}: CheckoutFlowProps) {
  const [currentStep, setCurrentStep] = useState<CheckoutStep>('cart');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    deliveryMethod: 'pickup',
    address: '',
    notes: '',
    paymentMethod: 'cash',
    agreeToTerms: false,
  });

  const cartItems = useMenuCartStore((state) => state.items);
  const getTotal = useMenuCartStore((state) => state.getTotal);
  const getItemCount = useMenuCartStore((state) => state.getItemCount);
  const clearCart = useMenuCartStore((state) => state.clearCart);

  const totalItems = getItemCount();
  const totalAmount = getTotal();

  // Validation
  const hasMinOrderError = minOrder && totalItems < minOrder;
  const hasMaxOrderError = maxOrder && totalItems > maxOrder;

  const updateFormData = useCallback((field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  const goToStep = useCallback((step: CheckoutStep) => {
    setCurrentStep(step);
  }, []);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    
    try {
      const orderItems = cartItems.map(item => ({
        product_id: item.productId,
        quantity: item.quantity,
        price: item.price,
        weight: item.weight
      }));

      const { data, error } = await supabase.functions.invoke('menu-order-place', {
        body: {
          menu_id: menuId,
          access_token: accessToken,
          order_items: orderItems,
          contact_phone: formData.phone,
          contact_name: formData.name,
          contact_email: formData.email,
          delivery_method: formData.deliveryMethod,
          payment_method: formData.paymentMethod,
          delivery_address: formData.address,
          customer_notes: formData.notes
        }
      });

      if (error) throw error;

      if (data && typeof data === 'object' && 'error' in data && data.error) {
        const errorMessage = typeof data.error === 'string' ? data.error : 'Failed to place order';
        throw new Error(errorMessage);
      }

      const newOrderId = data?.order_id || crypto.randomUUID();
      setOrderId(newOrderId);
      clearCart();
      onOrderComplete();
      
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
    setFormData({
      name: '',
      phone: '',
      email: '',
      deliveryMethod: 'pickup',
      address: '',
      notes: '',
      paymentMethod: 'cash',
      agreeToTerms: false,
    });
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
        className="w-full sm:max-w-lg flex flex-col p-0"
        side="bottom"
      >
        {/* Header */}
        <SheetHeader className="px-4 py-3 border-b">
          <SheetTitle className="text-lg">
            {orderId ? 'Order Complete' : 'Checkout'}
          </SheetTitle>
        </SheetHeader>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {orderId ? (
            <div className="p-4">
              <OrderSuccess orderId={orderId} onClose={handleClose} />
            </div>
          ) : (
            <>
              {/* Step Progress */}
              <StepProgress 
                steps={STEPS} 
                currentStep={currentStep}
                onStepClick={goToStep}
              />

              {/* Order Constraints Warning */}
              {(hasMinOrderError || hasMaxOrderError) && (
                <div className="px-4">
                  <Alert variant="destructive" className="py-2">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-sm">
                      {hasMinOrderError && `Minimum order: ${minOrder} items`}
                      {hasMaxOrderError && `Maximum order: ${maxOrder} items`}
                    </AlertDescription>
                  </Alert>
                </div>
              )}

              {/* Step Content */}
              <div className="p-4">
                {currentStep === 'cart' && (
                  <CartStep onNext={() => goToStep('contact')} />
                )}
                {currentStep === 'contact' && (
                  <ContactStep
                    formData={formData}
                    onUpdate={updateFormData}
                    onNext={() => goToStep('delivery')}
                    onBack={() => goToStep('cart')}
                  />
                )}
                {currentStep === 'delivery' && (
                  <DeliveryStep
                    formData={formData}
                    onUpdate={updateFormData}
                    onNext={() => goToStep('payment')}
                    onBack={() => goToStep('contact')}
                  />
                )}
                {currentStep === 'payment' && (
                  <PaymentStep
                    formData={formData}
                    onUpdate={updateFormData}
                    onNext={() => goToStep('confirm')}
                    onBack={() => goToStep('delivery')}
                  />
                )}
                {currentStep === 'confirm' && (
                  <ConfirmStep
                    formData={formData}
                    onSubmit={handleSubmit}
                    onBack={() => goToStep('payment')}
                    isSubmitting={isSubmitting}
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
