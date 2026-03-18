import { logger } from '@/lib/logger';
import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ShoppingCart, User, MapPin, CreditCard, Check, ArrowRight, ArrowLeft,
  Loader2, Package, Minus, Plus, Trash2, Phone, Mail, Home,
  Truck, Store, Wallet, Banknote, Shield, Clock,
  CheckCircle, Bitcoin, Zap, Coins, Copy,
  Navigation, Tag, ChevronDown, Edit2, Calendar, Share2, MessageCircle,
  Locate, Building, KeyRound as Key
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import { showErrorToast } from '@/utils/toastHelpers';
import { useMenuCartStore } from '@/stores/menuCartStore';
import { formatWeight } from '@/utils/productHelpers';
import { cn } from '@/lib/utils';
import confetti from 'canvas-confetti';
import { toast } from 'sonner';
import { humanizeError } from '@/lib/humanizeError';
import { useMenuPaymentSettings, type PaymentSettings } from '@/hooks/usePaymentSettings';
import { publish } from '@/lib/eventBus';
import { queryKeys } from '@/lib/queryKeys';
import { STORAGE_KEYS } from '@/constants/storageKeys';
import { useReturningCustomerLookup } from '@/hooks/useReturningCustomerLookup';

interface CheckoutFlowProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  menuId: string;
  tenantId?: string;
  accessToken?: string;
  minOrder?: number;
  maxOrder?: number;
  onOrderComplete: (orderId?: string, orderTotal?: number) => void;
  products?: Array<{ id: string; name: string; image_url?: string }>;
}

type CheckoutStep = 'cart' | 'details' | 'location' | 'payment' | 'confirm';

const STEPS: { id: CheckoutStep; label: string; icon: React.ElementType }[] = [
  { id: 'cart', label: 'Cart', icon: ShoppingCart },
  { id: 'details', label: 'Details', icon: User },
  { id: 'location', label: 'Location', icon: MapPin },
  { id: 'payment', label: 'Payment', icon: CreditCard },
  { id: 'confirm', label: 'Confirm', icon: Check },
];

const DELIVERY_METHODS = [
  { id: 'delivery', label: 'Delivery', icon: Truck, description: 'We deliver to your location', eta: '30-60 min' },
  { id: 'pickup', label: 'Pickup', icon: Store, description: 'Pick up at our location', eta: '15-20 min' },
];

// Payment method type
type PaymentMethod = {
  id: string;
  label: string;
  icon: React.ElementType;
  description: string;
  category: 'traditional' | 'crypto';
  apiValue: 'cash' | 'card' | 'crypto' | 'other';
  address?: string;
  username?: string;
  instructions?: string;
};

// Default payment methods (used as fallback when settings not loaded)
const DEFAULT_PAYMENT_METHODS: PaymentMethod[] = [
  { id: 'cash', label: 'Cash', icon: Banknote, description: 'Pay on delivery/pickup', category: 'traditional', apiValue: 'cash' },
];

// Build payment methods from settings
function buildPaymentMethods(settings: PaymentSettings | null | undefined) {
  const methods: Array<{
    id: string;
    label: string;
    icon: React.ElementType;
    description: string;
    category: 'traditional' | 'crypto';
    apiValue: 'cash' | 'card' | 'crypto' | 'other';
    address?: string;
    username?: string;
    instructions?: string;
  }> = [];

  if (!settings) {
    // Return default cash if no settings
    return DEFAULT_PAYMENT_METHODS;
  }

  // Traditional payments
  if (settings.accept_cash) {
    methods.push({
      id: 'cash',
      label: 'Cash',
      icon: Banknote,
      description: settings.cash_instructions || 'Pay on delivery/pickup',
      category: 'traditional',
      apiValue: 'cash',
      instructions: settings.cash_instructions || undefined,
    });
  }

  if (settings.accept_zelle) {
    methods.push({
      id: 'zelle',
      label: 'Zelle',
      icon: Wallet,
      description: settings.zelle_username || settings.zelle_phone 
        ? `Send to ${settings.zelle_username || settings.zelle_phone}`
        : 'Send via Zelle',
      category: 'traditional',
      apiValue: 'other',
      username: settings.zelle_username || settings.zelle_phone || undefined,
      instructions: settings.zelle_instructions || undefined,
    });
  }

  if (settings.accept_cashapp) {
    methods.push({
      id: 'cashapp',
      label: 'CashApp',
      icon: Wallet,
      description: settings.cashapp_username 
        ? `Send to ${settings.cashapp_username}`
        : 'Send via CashApp',
      category: 'traditional',
      apiValue: 'other',
      username: settings.cashapp_username || undefined,
      instructions: settings.cashapp_instructions || undefined,
    });
  }

  // Crypto payments
  if (settings.accept_bitcoin && settings.bitcoin_address) {
    methods.push({
      id: 'bitcoin',
      label: 'Bitcoin',
      icon: Bitcoin,
      description: 'Pay with BTC',
      category: 'crypto',
      apiValue: 'crypto',
      address: settings.bitcoin_address,
      instructions: settings.crypto_instructions || undefined,
    });
  }

  if (settings.accept_lightning && settings.lightning_address) {
    methods.push({
      id: 'lightning',
      label: 'Lightning',
      icon: Zap,
      description: 'Instant BTC via Lightning',
      category: 'crypto',
      apiValue: 'crypto',
      address: settings.lightning_address,
      instructions: settings.crypto_instructions || undefined,
    });
  }

  if (settings.accept_ethereum && settings.ethereum_address) {
    methods.push({
      id: 'ethereum',
      label: 'Ethereum',
      icon: Coins,
      description: 'Pay with ETH',
      category: 'crypto',
      apiValue: 'crypto',
      address: settings.ethereum_address,
      instructions: settings.crypto_instructions || undefined,
    });
  }

  if (settings.accept_usdt && settings.usdt_address) {
    methods.push({
      id: 'usdt',
      label: 'USDT',
      icon: Coins,
      description: 'Pay with Tether',
      category: 'crypto',
      apiValue: 'crypto',
      address: settings.usdt_address,
      instructions: settings.crypto_instructions || undefined,
    });
  }

  // If no methods enabled, default to cash
  if (methods.length === 0) {
    return DEFAULT_PAYMENT_METHODS;
  }

  return methods;
}

// PaymentMethod type is defined above (line 58)

// Format phone number as user types
const formatPhoneNumber = (value: string) => {
  const numbers = value.replace(/\D/g, '');
  if (numbers.length <= 3) return numbers;
  if (numbers.length <= 6) return `(${numbers.slice(0, 3)}) ${numbers.slice(3)}`;
  return `(${numbers.slice(0, 3)}) ${numbers.slice(3, 6)}-${numbers.slice(6, 10)}`;
};

// Validate email
const isValidEmail = (email: string) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

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
  const progress = ((currentIndex + 1) / steps.length) * 100;
  
  return (
    <div className="space-y-3 px-4 py-3">
      {/* Progress bar */}
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div 
          className="h-full bg-gradient-to-r from-primary to-emerald-500 transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
      
      {/* Step indicators */}
      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const isActive = index === currentIndex;
          const isComplete = index < currentIndex;
          const isClickable = isComplete && onStepClick;
          
          return (
            <button
              key={step.id}
              onClick={() => isClickable && onStepClick(step.id)}
              disabled={!isClickable}
              className={cn(
                "flex flex-col items-center gap-1 transition-all",
                isClickable && "cursor-pointer hover:opacity-80"
              )}
            >
              <div className={cn(
                "w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300",
                isActive && "bg-primary text-primary-foreground shadow-lg shadow-primary/30 scale-110",
                isComplete && "bg-emerald-500 text-white",
                !isActive && !isComplete && "bg-muted text-muted-foreground"
              )}>
                {isComplete ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Icon className="h-4 w-4" />
                )}
              </div>
              <span className={cn(
                "text-[10px] font-medium hidden sm:block",
                isActive && "text-primary",
                isComplete && "text-emerald-600",
                !isActive && !isComplete && "text-muted-foreground"
              )}>
                {step.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Swipeable Cart Item
function SwipeableCartItem({
  item,
  product,
  onUpdateQuantity,
  onRemove
}: {
  item: { productId: string; productName: string; weight?: string; price: number; quantity: number };
  product?: { image_url?: string };
  onUpdateQuantity: (qty: number) => void;
  onRemove: () => void;
}) {
  const [swipeX, setSwipeX] = useState(0);
  const [startX, setStartX] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const deleteThreshold = -80;

  const handleTouchStart = (e: React.TouchEvent) => {
    setStartX(e.touches[0].clientX);
    setIsSwiping(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isSwiping) return;
    const diff = e.touches[0].clientX - startX;
    setSwipeX(Math.min(0, Math.max(-100, diff)));
  };

  const handleTouchEnd = () => {
    setIsSwiping(false);
    if (swipeX < deleteThreshold) {
      onRemove();
    }
    setSwipeX(0);
  };

  return (
    <div className="relative overflow-hidden rounded-xl">
      {/* Delete background */}
      <div className="absolute inset-y-0 right-0 w-24 bg-red-500 flex items-center justify-center">
        <Trash2 className="h-6 w-6 text-white" />
      </div>
      
      {/* Card content */}
      <Card 
        className="relative bg-card transition-transform touch-pan-y"
        style={{ transform: `translateX(${swipeX}px)` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <CardContent className="p-3">
          <div className="flex gap-3">
            {/* Product Image */}
            {product?.image_url ? (
              <div className="w-16 h-16 rounded-lg overflow-hidden bg-muted shrink-0">
                <img
                  src={product.image_url}
                  alt={item.productName}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
            ) : (
              <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center shrink-0">
                <Package className="h-6 w-6 text-primary/50" />
              </div>
            )}
            
            <div className="flex-1 min-w-0">
              <div className="font-semibold truncate">{item.productName}</div>
              <div className="flex items-center gap-2 mt-1">
                {item.weight && (
                  <Badge variant="secondary" className="text-xs">
                    {formatWeight(item.weight)}
                  </Badge>
                )}
                <span className="text-sm text-muted-foreground">
                  ${item.price.toFixed(2)}
                </span>
              </div>
              
              {/* Quantity controls */}
              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-1 bg-muted rounded-full p-0.5">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 rounded-full"
                    onClick={() => onUpdateQuantity(item.quantity - 1)}
                    aria-label="Decrease quantity"
                  >
                    <Minus className="h-3 w-3" />
                  </Button>
                  <span className="w-8 text-center font-bold text-sm">{item.quantity}</span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 rounded-full"
                    onClick={() => onUpdateQuantity(item.quantity + 1)}
                    aria-label="Increase quantity"
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
                <div className="font-bold text-primary">
                  ${(item.price * item.quantity).toFixed(2)}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Enhanced Cart Step
function CartStep({ 
  onNext,
  onClose,
  products
}: { 
  onNext: () => void;
  onClose: () => void;
  products?: Array<{ id: string; name: string; image_url?: string }>;
}) {
  const cartItems = useMenuCartStore((state) => state.items);
  const removeItem = useMenuCartStore((state) => state.removeItem);
  const updateQuantity = useMenuCartStore((state) => state.updateQuantity);
  const getTotal = useMenuCartStore((state) => state.getTotal);
  const getItemCount = useMenuCartStore((state) => state.getItemCount);
  
  const [promoCode, setPromoCode] = useState('');
  const [promoApplied, setPromoApplied] = useState(false);
  const [promoDiscount, setPromoDiscount] = useState(0);

  const totalAmount = getTotal();
  const totalItems = getItemCount();
  const serviceFee = totalAmount * 0.05; // 5% service fee
  const finalTotal = totalAmount + serviceFee - promoDiscount;

  const handleApplyPromo = () => {
    // Mock promo code validation
    if (promoCode.toUpperCase() === 'FIRST10') {
      setPromoDiscount(totalAmount * 0.1);
      setPromoApplied(true);
      toast.success('Promo code applied! 10% off');
    } else if (promoCode.toUpperCase() === 'SAVE20') {
      setPromoDiscount(20);
      setPromoApplied(true);
      toast.success('Promo code applied! $20 off');
    } else {
      toast.error('Invalid promo code');
    }
  };

  if (cartItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center px-4">
        <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-4">
          <ShoppingCart className="h-10 w-10 text-muted-foreground" />
        </div>
        <h3 className="text-xl font-bold mb-2">Your cart is empty</h3>
        <p className="text-muted-foreground mb-6">Add some products to get started</p>
        <Button onClick={onClose} variant="outline" className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Continue Shopping
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Scrollable items */}
      <div className="flex-1 overflow-y-auto px-4 py-2 space-y-3">
        {cartItems.map((item) => {
          const product = products?.find(p => p.id === item.productId);
          return (
            <SwipeableCartItem
              key={`${item.productId}-${item.weight}`}
              item={item}
              product={product}
              onUpdateQuantity={(qty) => {
                if (qty <= 0) {
                  removeItem(item.productId);
                } else {
                  updateQuantity(item.productId, qty);
                }
              }}
              onRemove={() => removeItem(item.productId)}
            />
          );
        })}
        
        {/* Add more items button */}
        <Button 
          variant="outline" 
          className="w-full gap-2 border-dashed"
          onClick={onClose}
        >
          <Plus className="h-4 w-4" />
          Add More Items
        </Button>
      </div>

      {/* Fixed bottom section */}
      <div className="border-t bg-card/95 backdrop-blur-sm px-4 py-4 space-y-4">
        {/* Promo code */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Promo code"
              value={promoCode}
              onChange={(e) => setPromoCode(e.target.value)}
              className="pl-10 h-11"
              disabled={promoApplied}
              aria-label="Promo code"
            />
          </div>
          <Button 
            onClick={handleApplyPromo}
            disabled={!promoCode || promoApplied}
            variant={promoApplied ? "secondary" : "default"}
            className="h-11"
          >
            {promoApplied ? <Check className="h-4 w-4" /> : 'Apply'}
          </Button>
        </div>

        {/* Price breakdown */}
        <div className="space-y-2 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <span>Subtotal ({totalItems} items)</span>
            <span>${totalAmount.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Service fee</span>
            <span>${serviceFee.toFixed(2)}</span>
          </div>
          {promoDiscount > 0 && (
            <div className="flex justify-between text-emerald-600">
              <span>Promo discount</span>
              <span>-${promoDiscount.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between text-lg font-bold pt-2 border-t">
            <span>Total</span>
            <span className="text-primary">${finalTotal.toFixed(2)}</span>
          </div>
        </div>

        {/* Continue button */}
        <Button 
          onClick={onNext} 
          className="w-full h-14 text-lg font-semibold gap-2 bg-gradient-to-r from-primary to-emerald-600 hover:from-primary/90 hover:to-emerald-600/90"
          size="lg"
        >
          Continue to Details
          <ArrowRight className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}

// Customer Details Step
function DetailsStep({
  formData,
  onUpdate,
  onNext,
  onBack,
  errors,
  isRecognized,
  isLookingUp,
  recognizedName,
}: {
  formData: {
    firstName: string;
    lastName: string;
    phone: string;
    email: string;
    rememberMe: boolean;
  };
  onUpdate: (field: string, value: string | boolean) => void;
  onNext: () => void;
  onBack: () => void;
  errors: Record<string, string>;
  isRecognized?: boolean;
  isLookingUp?: boolean;
  recognizedName?: string;
}) {
  const isValid = formData.firstName.trim() && formData.lastName.trim() && 
                  formData.phone.replace(/\D/g, '').length >= 10 &&
                  (!formData.email || isValidEmail(formData.email));

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
        <div className="text-center mb-6">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
            <User className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-xl font-bold">Your Details</h2>
          <p className="text-sm text-muted-foreground">We need this to process your order</p>
        </div>

        {/* Name fields */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="firstName" className="text-sm font-medium">
              First Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="firstName"
              autoComplete="given-name"
              placeholder="John"
              value={formData.firstName}
              onChange={(e) => onUpdate('firstName', e.target.value)}
              className={cn("h-12", errors.firstName && "border-red-500")}
            />
            {errors.firstName && (
              <p className="text-xs text-red-500">{errors.firstName}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="lastName" className="text-sm font-medium">
              Last Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="lastName"
              autoComplete="family-name"
              placeholder="Doe"
              value={formData.lastName}
              onChange={(e) => onUpdate('lastName', e.target.value)}
              className={cn("h-12", errors.lastName && "border-red-500")}
            />
            {errors.lastName && (
              <p className="text-xs text-red-500">{errors.lastName}</p>
            )}
          </div>
        </div>

        {/* Phone */}
        <div className="space-y-2">
          <Label htmlFor="phone" className="text-sm font-medium flex items-center gap-2">
            <Phone className="h-4 w-4" />
            Phone Number <span className="text-red-500">*</span>
          </Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
              +1
            </span>
            <Input
              id="phone"
              type="tel"
              autoComplete="tel"
              placeholder="(555) 123-4567"
              value={formData.phone}
              onChange={(e) => onUpdate('phone', formatPhoneNumber(e.target.value))}
              className={cn("h-12 pl-10 pr-10", errors.phone && "border-red-500")}
              maxLength={14}
            />
            {isLookingUp && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
            )}
            {isRecognized && !isLookingUp && (
              <CheckCircle className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500" />
            )}
          </div>
          {errors.phone ? (
            <p className="text-xs text-red-500">{errors.phone}</p>
          ) : isRecognized ? (
            <p className="text-xs text-green-600">Welcome back, {recognizedName}!</p>
          ) : (
            <p className="text-xs text-muted-foreground">We'll text you order updates</p>
          )}
        </div>

        {/* Email */}
        <div className="space-y-2">
          <Label htmlFor="email" className="text-sm font-medium flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Email (optional)
          </Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="john@example.com"
            value={formData.email}
            onChange={(e) => onUpdate('email', e.target.value)}
            className={cn("h-12", errors.email && "border-red-500")}
          />
          {errors.email && (
            <p className="text-xs text-red-500">{errors.email}</p>
          )}
        </div>

        {/* Remember me */}
        <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
          <Checkbox
            id="rememberMe"
            checked={formData.rememberMe}
            onCheckedChange={(checked) => onUpdate('rememberMe', checked === true)}
          />
          <label htmlFor="rememberMe" className="text-sm cursor-pointer">
            Remember my details for next time
          </label>
        </div>
      </div>

      {/* Bottom buttons */}
      <div className="border-t bg-card px-4 py-4 flex gap-3">
        <Button variant="outline" onClick={onBack} className="h-12 px-6" aria-label="Go back">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Button 
          onClick={onNext} 
          disabled={!isValid}
          className="flex-1 h-12 text-lg font-semibold"
        >
          Continue
          <ArrowRight className="h-5 w-5 ml-2" />
        </Button>
      </div>
    </div>
  );
}

// Location Step
function LocationStep({ 
  formData,
  onUpdate,
  onNext,
  onBack
}: { 
  formData: {
    deliveryMethod: string;
    address: string;
    city: string;
    zipCode: string;
    landmark: string;
    gateCode: string;
    notes: string;
  };
  onUpdate: (field: string, value: string) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const [isLocating, setIsLocating] = useState(false);
  const needsAddress = formData.deliveryMethod === 'delivery';
  const isValid = formData.deliveryMethod && (!needsAddress || (formData.address.trim() && formData.city.trim()));

  const handleGetLocation = () => {
    setIsLocating(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async () => {
          // In production, use reverse geocoding API
          toast.success('Location detected! Please verify the address.');
          setIsLocating(false);
        },
        () => {
          toast.error('Could not get your location');
          setIsLocating(false);
        }
      );
    } else {
      toast.error('Geolocation not supported');
      setIsLocating(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
        <div className="text-center mb-6">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
            <MapPin className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-xl font-bold">Delivery Method</h2>
          <p className="text-sm text-muted-foreground">How would you like to receive your order?</p>
        </div>

        {/* Delivery method cards */}
        <div className="grid grid-cols-2 gap-3">
          {DELIVERY_METHODS.map((method) => {
            const Icon = method.icon;
            const isSelected = formData.deliveryMethod === method.id;
            
            return (
              <Card 
                key={method.id}
                className={cn(
                  "cursor-pointer transition-all",
                  isSelected 
                    ? "border-primary bg-primary/5 ring-2 ring-primary shadow-lg" 
                    : "hover:border-primary/50"
                )}
                onClick={() => onUpdate('deliveryMethod', method.id)}
              >
                <CardContent className="p-4 text-center">
                  <div className={cn(
                    "w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-2",
                    isSelected ? "bg-primary text-primary-foreground" : "bg-muted"
                  )}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <div className="font-semibold">{method.label}</div>
                  <div className="text-xs text-muted-foreground mt-1">{method.eta}</div>
                  {isSelected && (
                    <Badge className="mt-2 bg-primary/20 text-primary">Selected</Badge>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Address fields for delivery */}
        {needsAddress && (
          <div className="space-y-4 pt-4 border-t">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Drop-off Location</h3>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleGetLocation}
                disabled={isLocating}
                className="gap-2"
              >
                {isLocating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Locate className="h-4 w-4" />
                )}
                Use My Location
              </Button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address" className="flex items-center gap-2">
                <Home className="h-4 w-4" />
                Street Address <span className="text-red-500">*</span>
              </Label>
              <Input
                id="address"
                placeholder="123 Main Street, Apt 4B"
                value={formData.address}
                onChange={(e) => onUpdate('address', e.target.value)}
                className="h-12"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="city" className="flex items-center gap-2">
                  <Building className="h-4 w-4" />
                  City <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="city"
                  placeholder="New York"
                  value={formData.city}
                  onChange={(e) => onUpdate('city', e.target.value)}
                  className="h-12"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="zipCode">ZIP Code</Label>
                <Input
                  id="zipCode"
                  placeholder="10001"
                  value={formData.zipCode}
                  onChange={(e) => onUpdate('zipCode', e.target.value)}
                  className="h-12"
                  maxLength={5}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="landmark" className="flex items-center gap-2">
                  <Navigation className="h-4 w-4" />
                  Landmark
                </Label>
                <Input
                  id="landmark"
                  placeholder="Near the park"
                  value={formData.landmark}
                  onChange={(e) => onUpdate('landmark', e.target.value)}
                  className="h-12"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gateCode" className="flex items-center gap-2">
                  <Key className="h-4 w-4" />
                  Gate Code
                </Label>
                <Input
                  id="gateCode"
                  placeholder="#1234"
                  value={formData.gateCode}
                  onChange={(e) => onUpdate('gateCode', e.target.value)}
                  className="h-12"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes" className="flex items-center gap-2">
                <MessageCircle className="h-4 w-4" />
                Delivery Instructions
              </Label>
              <Textarea
                id="notes"
                placeholder="Leave at door, ring doorbell twice..."
                value={formData.notes}
                onChange={(e) => onUpdate('notes', e.target.value)}
                rows={2}
                className="resize-none"
                maxLength={200}
              />
              <p className="text-xs text-muted-foreground text-right">
                {formData.notes.length}/200
              </p>
            </div>
          </div>
        )}

        {/* Pickup info */}
        {!needsAddress && (
          <Card className="bg-muted/50">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Store className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <div className="font-semibold">Pickup Location</div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Address will be provided after order confirmation
                  </p>
                  <Badge variant="outline" className="mt-2">
                    <Clock className="h-3 w-3 mr-1" />
                    Ready in 15-20 min
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Bottom buttons */}
      <div className="border-t bg-card px-4 py-4 flex gap-3">
        <Button variant="outline" onClick={onBack} className="h-12 px-6" aria-label="Go back">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Button 
          onClick={onNext} 
          disabled={!isValid}
          className="flex-1 h-12 text-lg font-semibold"
        >
          Continue
          <ArrowRight className="h-5 w-5 ml-2" />
        </Button>
      </div>
    </div>
  );
}

// Order Summary Recap (read-only, shown on Payment step)
function OrderSummaryRecap() {
  const cartItems = useMenuCartStore((state) => state.items);
  const getTotal = useMenuCartStore((state) => state.getTotal);
  const getItemCount = useMenuCartStore((state) => state.getItemCount);
  const [isOpen, setIsOpen] = useState(false);

  const subtotal = getTotal();
  const itemCount = getItemCount();
  const serviceFee = subtotal * 0.05;
  const total = subtotal + serviceFee;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="bg-muted/30 border-dashed">
        <CollapsibleTrigger className="w-full">
          <CardHeader className="py-3 px-4 flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-sm font-medium">
                Order Summary ({itemCount} {itemCount === 1 ? 'item' : 'items'})
              </CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-primary text-sm">${total.toFixed(2)}</span>
              <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 pb-3 px-4 space-y-2">
            {cartItems.map((item) => (
              <div key={`${item.productId}-${item.weight}`} className="flex justify-between text-sm">
                <span className="text-muted-foreground truncate mr-2">
                  {item.quantity}x {item.productName}
                  {item.weight && ` (${formatWeight(item.weight)})`}
                </span>
                <span className="shrink-0">${(item.price * item.quantity).toFixed(2)}</span>
              </div>
            ))}
            <div className="pt-2 border-t space-y-1">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Subtotal</span>
                <span>${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Service fee (5%)</span>
                <span>${serviceFee.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm font-semibold pt-1 border-t">
                <span>Total</span>
                <span className="text-primary">${total.toFixed(2)}</span>
              </div>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

// Payment Step with Crypto
function PaymentStep({
  formData,
  totalAmount,
  onUpdate,
  onNext,
  onBack,
  paymentMethods,
  isLoadingSettings
}: {
  formData: { paymentMethod: string };
  totalAmount: number;
  onUpdate: (field: string, value: string) => void;
  onNext: () => void;
  onBack: () => void;
  paymentMethods: PaymentMethod[];
  isLoadingSettings?: boolean;
}) {
  const [copiedAddress, setCopiedAddress] = useState(false);
  const selectedMethod = paymentMethods.find(m => m.id === formData.paymentMethod);
  const isValid = !!formData.paymentMethod;

  const traditionalMethods = paymentMethods.filter(m => m.category === 'traditional');
  const cryptoMethods = paymentMethods.filter(m => m.category === 'crypto');

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedAddress(true);
    toast.success('Address copied!');
    setTimeout(() => setCopiedAddress(false), 2000);
  };

  // Mock BTC price for conversion
  const btcPrice = 43500;
  const ethPrice = 2250;

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
        <div className="text-center mb-4">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
            <CreditCard className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-xl font-bold">Payment Method</h2>
          <p className="text-sm text-muted-foreground">Choose how you'd like to pay</p>
        </div>

        {/* Order Summary Recap */}
        <OrderSummaryRecap />

        {/* Loading state */}
        {isLoadingSettings && (
          <div className="space-y-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        )}

        {/* Traditional payments */}
        {!isLoadingSettings && traditionalMethods.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Traditional
            </h3>
            <div className="space-y-2">
              {traditionalMethods.map((method) => {
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
                        {method.username && isSelected && (
                          <div className="mt-1 flex items-center gap-2">
                            <code className="text-xs bg-muted px-2 py-1 rounded font-mono">
                              {method.username}
                            </code>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigator.clipboard.writeText(method.username!);
                                toast.success('Copied!');
                              }}
                              aria-label="Copy username"
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                      </div>
                      {isSelected && (
                        <Check className="h-5 w-5 text-primary" />
                      )}
                    </CardContent>
                    {/* Show instructions when selected */}
                    {isSelected && method.instructions && (
                      <div className="px-4 pb-4">
                        <Alert>
                          <AlertDescription className="text-sm">
                            {method.instructions}
                          </AlertDescription>
                        </Alert>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Crypto payments */}
        {!isLoadingSettings && cryptoMethods.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <Bitcoin className="h-4 w-4" />
              Cryptocurrency
            </h3>
            <div className="space-y-2">
              {cryptoMethods.map((method) => {
                const Icon = method.icon;
                const isSelected = formData.paymentMethod === method.id;
                
                // Calculate crypto amount
                let cryptoAmount = '';
                if (method.id === 'bitcoin') {
                  cryptoAmount = (totalAmount / btcPrice).toFixed(6) + ' BTC';
                } else if (method.id === 'ethereum') {
                  cryptoAmount = (totalAmount / ethPrice).toFixed(4) + ' ETH';
                } else if (method.id === 'lightning') {
                  cryptoAmount = Math.round(totalAmount / btcPrice * 100000000) + ' sats';
                } else if (method.id === 'usdt') {
                  cryptoAmount = totalAmount.toFixed(2) + ' USDT';
                }
                
                return (
                  <Card 
                    key={method.id}
                    className={cn(
                      "cursor-pointer transition-all",
                      isSelected 
                        ? "border-orange-500 bg-orange-500/5 ring-2 ring-orange-500" 
                        : "hover:border-orange-500/50"
                    )}
                    onClick={() => onUpdate('paymentMethod', method.id)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "w-12 h-12 rounded-full flex items-center justify-center",
                          isSelected ? "bg-orange-500 text-white" : "bg-orange-500/10 text-orange-500"
                        )}>
                          <Icon className="h-6 w-6" />
                        </div>
                        <div className="flex-1">
                          <div className="font-semibold">{method.label}</div>
                          <div className="text-sm text-muted-foreground">{method.description}</div>
                          {cryptoAmount && (
                            <Badge variant="outline" className="mt-1 text-orange-600 border-orange-500/30">
                              ≈ {cryptoAmount}
                            </Badge>
                          )}
                        </div>
                        {isSelected && (
                          <Check className="h-5 w-5 text-orange-500" />
                        )}
                      </div>
                      
                      {/* Show wallet address for selected crypto */}
                      {isSelected && method.address && (
                        <div className="mt-4 p-3 bg-muted rounded-lg">
                          <div className="text-xs text-muted-foreground mb-2">Send to this address:</div>
                          <div className="flex items-center gap-2">
                            <code className="flex-1 text-xs break-all font-mono bg-background p-2 rounded">
                              {method.address}
                            </code>
                            <Button
                              size="icon"
                              variant="outline"
                              className="shrink-0 h-8 w-8"
                              onClick={(e) => {
                                e.stopPropagation();
                              copyToClipboard(method.address!);
                            }}
                            aria-label="Copy address"
                          >
                            {copiedAddress ? (
                              <Check className="h-4 w-4 text-emerald-500" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </Button>
                          </div>
                        </div>
                      )}
                      {/* Show instructions when selected */}
                      {isSelected && method.instructions && (
                        <div className="mt-3 p-2 bg-background rounded text-xs text-muted-foreground">
                          {method.instructions}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Security notice */}
        <Alert className="bg-emerald-500/10 border-emerald-500/20">
          <Shield className="h-4 w-4 text-emerald-600" />
          <AlertDescription className="text-emerald-700 dark:text-emerald-300">
            Your payment information is encrypted and secure. 
            {selectedMethod?.category === 'crypto' 
              ? ' Send payment after placing order.'
              : ' Payment collected upon delivery/pickup.'}
          </AlertDescription>
        </Alert>
      </div>

      {/* Bottom buttons */}
      <div className="border-t bg-card px-4 py-4 flex gap-3">
        <Button variant="outline" onClick={onBack} className="h-12 px-6" aria-label="Go back">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Button 
          onClick={onNext} 
          disabled={!isValid}
          className="flex-1 h-12 text-lg font-semibold"
        >
          Review Order
          <ArrowRight className="h-5 w-5 ml-2" />
        </Button>
      </div>
    </div>
  );
}

// Confirmation Step
function ConfirmStep({ 
  formData,
  onSubmit,
  onBack,
  onEdit,
  isSubmitting,
  paymentMethods
}: { 
  formData: {
    firstName: string;
    lastName: string;
    phone: string;
    email: string;
    deliveryMethod: string;
    address: string;
    city: string;
    zipCode: string;
    paymentMethod: string;
    notes: string;
  };
  onSubmit: () => void;
  onBack: () => void;
  onEdit: (step: CheckoutStep) => void;
  isSubmitting: boolean;
  paymentMethods: PaymentMethod[];
}) {
  const cartItems = useMenuCartStore((state) => state.items);
  const getTotal = useMenuCartStore((state) => state.getTotal);
  const getItemCount = useMenuCartStore((state) => state.getItemCount);
  
  const [agreed, setAgreed] = useState(false);
  const [ageVerified, setAgeVerified] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  const totalAmount = getTotal();
  const totalItems = getItemCount();
  const serviceFee = totalAmount * 0.05;
  const finalTotal = totalAmount + serviceFee;

  const deliveryLabel = DELIVERY_METHODS.find(m => m.id === formData.deliveryMethod)?.label;
  const paymentMethod = paymentMethods.find(m => m.id === formData.paymentMethod);

  const canSubmit = agreed && ageVerified;

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        <div className="text-center mb-4">
          <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-3">
            <CheckCircle className="h-8 w-8 text-emerald-500" />
          </div>
          <h2 className="text-xl font-bold">Review Your Order</h2>
          <p className="text-sm text-muted-foreground">Make sure everything looks good</p>
        </div>

        {/* Order Summary */}
        <Collapsible 
          open={expandedSection === 'items'} 
          onOpenChange={() => setExpandedSection(expandedSection === 'items' ? null : 'items')}
        >
          <Card>
            <CollapsibleTrigger className="w-full">
              <CardHeader className="py-3 px-4 flex flex-row items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4" />
                  <CardTitle className="text-sm">Items ({totalItems})</CardTitle>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-primary">${finalTotal.toFixed(2)}</span>
                  <ChevronDown className={cn("h-4 w-4 transition-transform", expandedSection === 'items' && "rotate-180")} />
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0 pb-3 px-4 space-y-2">
                {cartItems.map((item) => (
                  <div key={`${item.productId}-${item.weight}`} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      {item.quantity}x {item.productName}
                      {item.weight && ` (${formatWeight(item.weight)})`}
                    </span>
                    <span>${(item.price * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
                <div className="pt-2 border-t space-y-1">
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Subtotal</span>
                    <span>${totalAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Service fee</span>
                    <span>${serviceFee.toFixed(2)}</span>
                  </div>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Contact Info */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium text-sm">Contact</span>
              </div>
              <Button variant="ghost" size="sm" onClick={() => onEdit('details')} className="h-7 text-xs">
                <Edit2 className="h-3 w-3 mr-1" />
                Edit
              </Button>
            </div>
            <div className="text-sm space-y-1">
              <div>{formData.firstName} {formData.lastName}</div>
              <div className="text-muted-foreground">{formData.phone}</div>
              {formData.email && <div className="text-muted-foreground">{formData.email}</div>}
            </div>
          </CardContent>
        </Card>

        {/* Delivery Info */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                {formData.deliveryMethod === 'delivery' ? (
                  <Truck className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Store className="h-4 w-4 text-muted-foreground" />
                )}
                <span className="font-medium text-sm">{deliveryLabel}</span>
              </div>
              <Button variant="ghost" size="sm" onClick={() => onEdit('location')} className="h-7 text-xs">
                <Edit2 className="h-3 w-3 mr-1" />
                Edit
              </Button>
            </div>
            {formData.deliveryMethod === 'delivery' && formData.address && (
              <div className="text-sm text-muted-foreground">
                {formData.address}
                {formData.city && `, ${formData.city}`}
                {formData.zipCode && ` ${formData.zipCode}`}
              </div>
            )}
            {formData.notes && (
              <div className="text-xs text-muted-foreground mt-2 italic">
                "{formData.notes}"
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payment Info */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                {paymentMethod && <paymentMethod.icon className="h-4 w-4 text-muted-foreground" />}
                <span className="font-medium text-sm">Payment</span>
              </div>
              <Button variant="ghost" size="sm" onClick={() => onEdit('payment')} className="h-7 text-xs">
                <Edit2 className="h-3 w-3 mr-1" />
                Edit
              </Button>
            </div>
            <div className="text-sm text-muted-foreground">
              {paymentMethod?.label} - {paymentMethod?.description}
            </div>
          </CardContent>
        </Card>

        {/* Age verification */}
        <div className="flex items-start gap-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
          <Checkbox
            id="ageVerify"
            checked={ageVerified}
            onCheckedChange={(checked) => setAgeVerified(checked === true)}
            className="mt-0.5"
          />
          <label htmlFor="ageVerify" className="text-sm cursor-pointer">
            <span className="font-medium">I confirm I am 21 years of age or older</span>
            <span className="text-muted-foreground block text-xs mt-0.5">
              Required for all orders
            </span>
          </label>
        </div>

        {/* Terms agreement */}
        <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
          <Checkbox
            id="terms"
            checked={agreed}
            onCheckedChange={(checked) => setAgreed(checked === true)}
            className="mt-0.5"
          />
          <label htmlFor="terms" className="text-xs text-muted-foreground cursor-pointer">
            I agree to the terms of service and understand that this order is for personal use only. 
            Providing false information may result in order cancellation.
          </label>
        </div>
      </div>

      {/* Bottom buttons */}
      <div className="border-t bg-card px-4 py-4 space-y-3">
        <div className="flex justify-between items-center text-lg font-bold">
          <span>Total</span>
          <span className="text-primary">${finalTotal.toFixed(2)}</span>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={onBack} disabled={isSubmitting} className="h-14 px-6" aria-label="Go back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Button 
            onClick={onSubmit} 
            disabled={!canSubmit || isSubmitting}
            className="flex-1 h-14 text-lg font-bold bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700"
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
    </div>
  );
}

// Success State
function OrderSuccess({
  orderId,
  formData,
  onClose,
  menuId
}: {
  orderId: string;
  formData: { deliveryMethod: string; firstName: string; phone: string };
  onClose: () => void;
  menuId: string;
}) {
  const [copied, setCopied] = useState(false);
  const [smsLoading, setSmsLoading] = useState(false);
  const [smsConfirmed, setSmsConfirmed] = useState(false);

  useEffect(() => {
    // Trigger confetti
    const duration = 3 * 1000;
    const end = Date.now() + duration;

    const frame = () => {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: ['#10b981', '#34d399', '#6ee7b7']
      });
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: ['#10b981', '#34d399', '#6ee7b7']
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    };
    frame();
  }, []);

  const copyOrderId = () => {
    navigator.clipboard.writeText(orderId.slice(0, 8).toUpperCase());
    setCopied(true);
    toast.success('Order ID copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  const shareOrder = () => {
    if (navigator.share) {
      navigator.share({
        title: 'My Order',
        text: `Order #${orderId.slice(0, 8).toUpperCase()} placed successfully!`,
      });
    } else {
      copyOrderId();
    }
  };

  const handleSmsOptIn = async () => {
    setSmsLoading(true);
    try {
      await supabase.functions.invoke('menu-order-sms-subscribe', {
        body: {
          order_id: orderId,
          menu_id: menuId,
          phone: formData.phone.replace(/\D/g, ''),
        }
      });
      setSmsConfirmed(true);
      toast.success('You will receive SMS updates for your order');
    } catch (error) {
      toast.error('Could not enable SMS notifications', { description: humanizeError(error) });
    } finally {
      setSmsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center py-8 px-4 text-center overflow-y-auto">
      {/* Success animation */}
      <div className="relative mb-6">
        <div className="absolute inset-0 bg-emerald-500/20 rounded-full blur-2xl animate-pulse" />
        <div className="relative w-28 h-28 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-2xl shadow-emerald-500/30">
          <CheckCircle className="h-14 w-14 text-white" />
        </div>
      </div>

      <h2 className="text-2xl font-bold text-emerald-600 mb-2">Order Placed!</h2>
      <p className="text-muted-foreground mb-6">
        Thanks {formData.firstName}! Your order is being prepared.
      </p>

      {/* Order ID */}
      <Card className="w-full max-w-xs bg-muted/50 mb-4">
        <CardContent className="p-4">
          <div className="text-xs text-muted-foreground mb-1">Order Reference</div>
          <div className="flex items-center justify-center gap-2">
            <span className="font-mono text-xl font-bold">{orderId.slice(0, 8).toUpperCase()}</span>
            <Button size="icon" variant="ghost" className="h-11 w-11 sm:h-8 sm:w-8" onClick={copyOrderId} aria-label="Copy order ID">
              {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ETA */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
        <Clock className="h-4 w-4" />
        <span>
          {formData.deliveryMethod === 'delivery'
            ? 'Estimated delivery: 30-60 minutes'
            : 'Ready for pickup: 15-20 minutes'}
        </span>
      </div>

      {/* SMS Notifications Opt-in */}
      {formData.phone && !smsConfirmed && (
        <Card className="w-full max-w-xs mb-4 border-primary/20 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Phone className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 text-left">
                <p className="font-medium text-sm">Get SMS Updates</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Receive order status notifications via text message
                </p>
                <Button
                  size="sm"
                  className="mt-2 gap-1.5"
                  onClick={handleSmsOptIn}
                  disabled={smsLoading}
                >
                  {smsLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <MessageCircle className="h-3.5 w-3.5" />
                  )}
                  Enable SMS Alerts
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {smsConfirmed && (
        <div className="flex items-center gap-2 text-sm text-emerald-600 mb-4 w-full max-w-xs justify-center">
          <CheckCircle className="h-4 w-4" />
          <span>SMS notifications enabled</span>
        </div>
      )}

      {/* Action buttons */}
      <div className="grid grid-cols-2 gap-3 w-full max-w-xs mb-6">
        <Button variant="outline" className="gap-2" onClick={shareOrder}>
          <Share2 className="h-4 w-4" />
          Share
        </Button>
        <Button variant="outline" className="gap-2">
          <Calendar className="h-4 w-4" />
          Calendar
        </Button>
      </div>

      {/* Done button */}
      <Button onClick={onClose} className="w-full max-w-xs h-12 text-lg" size="lg">
        Done
      </Button>

      {/* Support link */}
      <button className="mt-4 text-sm text-muted-foreground hover:text-primary flex items-center gap-1">
        <MessageCircle className="h-4 w-4" />
        Need help? Contact support
      </button>
    </div>
  );
}

// Main Checkout Flow Component
export function ModernCheckoutFlow({
  open,
  onOpenChange,
  menuId,
  tenantId: tenantIdProp,
  accessToken: _accessToken,
  minOrder: _minOrder,
  maxOrder: _maxOrder,
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
        // Edge function failed — fall back to direct DB insert
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
