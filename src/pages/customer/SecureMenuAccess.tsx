import { logger } from '@/lib/logger';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Shield, Lock, MapPin, CheckCircle, Loader2,
  Clock, Fingerprint, ShoppingCart, Plus,
  Minus, Search, ArrowLeft, Package, X, Leaf,
  CalendarX2, Ban
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// ============================================
// Types
// ============================================

interface MenuProduct {
  id: string;
  name: string;
  description?: string;
  price: number;
  prices?: Record<string, number> | null;
  quantity_lbs?: number;
  category?: string;
  image_url?: string | null;
  images?: string[];
  strain_type?: string;
  thc_percentage?: number;
  cbd_percentage?: number;
  terpenes?: string[];
  effects?: string[];
  flavors?: string[];
}

interface CartItem {
  product: MenuProduct;
  quantity: number;
}

interface MenuDataResponse {
  id: string;
  tenant_id?: string;
  name: string;
  description?: string;
  products: MenuProduct[];
  menu_id: string;
  whitelist_id?: string | null;
  min_order_quantity?: number;
  max_order_quantity?: number;
  expiration_date?: string;
  never_expires?: boolean;
  appearance_settings?: {
    show_product_images?: boolean;
    show_availability?: boolean;
  };
  security_settings?: Record<string, unknown>;
}

// ============================================
// OTP-style Input Component
// ============================================

function CodeInput({
  value,
  onChange,
  onComplete,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  onComplete: () => void;
  disabled: boolean;
}) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const CODE_LENGTH = 8;

  const handleChange = (index: number, char: string) => {
    const upperChar = char.toUpperCase();
    if (!/^[A-Z0-9]?$/.test(upperChar)) return;

    const newValue = value.split('');
    newValue[index] = upperChar;
    const joined = newValue.join('').slice(0, CODE_LENGTH);
    onChange(joined);

    if (upperChar && index < CODE_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }

    if (joined.length === CODE_LENGTH) {
      setTimeout(() => onComplete(), 100);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !value[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (e.key === 'ArrowRight' && index < CODE_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData
      .getData('text')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, CODE_LENGTH);
    onChange(pasted);
    if (pasted.length === CODE_LENGTH) {
      setTimeout(() => onComplete(), 100);
    } else {
      inputRefs.current[pasted.length]?.focus();
    }
  };

  return (
    <div className="flex gap-2 justify-center" onPaste={handlePaste}>
      {Array.from({ length: CODE_LENGTH }).map((_, index) => (
        <input
          key={index}
          ref={(el) => {
            inputRefs.current[index] = el;
          }}
          type="text"
          inputMode="text"
          maxLength={1}
          value={value[index] ?? ''}
          onChange={(e) => handleChange(index, e.target.value)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          disabled={disabled}
          className={cn(
            'w-10 h-12 sm:w-12 sm:h-14 text-center text-xl sm:text-2xl font-mono font-bold',
            'border-2 rounded-lg bg-background/80 ',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-primary',
            'transition-colors duration-200',
            value[index] ? 'border-primary/50 bg-primary/5' : 'border-muted-foreground/30',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
          autoFocus={index === 0}
        />
      ))}
    </div>
  );
}

// ============================================
// Step Indicator Component
// ============================================

function StepIndicator({
  steps,
  currentStep,
}: {
  steps: { id: string; label: string; icon: React.ElementType }[];
  currentStep: string;
}) {
  const currentIndex = steps.findIndex((s) => s.id === currentStep);

  return (
    <div className="flex items-center justify-center gap-2 sm:gap-4">
      {steps.map((step, index) => {
        const Icon = step.icon;
        const isActive = index === currentIndex;
        const isComplete = index < currentIndex;

        return (
          <div key={step.id} className="flex items-center">
            <div
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium transition-colors',
                isActive && 'bg-primary text-primary-foreground',
                isComplete && 'bg-primary/20 text-primary',
                !isActive && !isComplete && 'bg-muted text-muted-foreground'
              )}
            >
              {isComplete ? (
                <CheckCircle className="h-3.5 w-3.5" />
              ) : (
                <Icon className="h-3.5 w-3.5" />
              )}
              <span className="hidden sm:inline">{step.label}</span>
            </div>
            {index < steps.length - 1 && (
              <div
                className={cn(
                  'w-6 sm:w-10 h-0.5 mx-1',
                  index < currentIndex ? 'bg-primary' : 'bg-muted'
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ============================================
// Expiration Countdown Timer
// ============================================

function ExpirationCountdown({ expirationDate }: { expirationDate: string }) {
  const [timeLeft, setTimeLeft] = useState('');
  const [urgencyLevel, setUrgencyLevel] = useState<'normal' | 'warning' | 'critical'>('normal');

  useEffect(() => {
    const updateTimer = () => {
      const now = new Date().getTime();
      const expiry = new Date(expirationDate).getTime();
      const diff = expiry - now;

      if (diff <= 0) {
        setTimeLeft('Expired');
        setUrgencyLevel('critical');
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      if (hours > 24) {
        const days = Math.floor(hours / 24);
        setTimeLeft(`${days}d ${hours % 24}h remaining`);
        setUrgencyLevel('normal');
      } else if (hours > 1) {
        setTimeLeft(`${hours}h ${minutes}m remaining`);
        setUrgencyLevel(hours < 4 ? 'warning' : 'normal');
      } else {
        setTimeLeft(`${minutes}m ${seconds}s remaining`);
        setUrgencyLevel('critical');
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [expirationDate]);

  return (
    <div
      className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium',
        urgencyLevel === 'normal' && 'bg-blue-500/10 text-blue-400',
        urgencyLevel === 'warning' && 'bg-amber-500/10 text-amber-400 animate-pulse',
        urgencyLevel === 'critical' && 'bg-red-500/10 text-red-400 animate-pulse'
      )}
    >
      <Clock className="h-4 w-4" />
      <span>{timeLeft}</span>
    </div>
  );
}

// ============================================
// Product Card Component
// ============================================

function ProductCard({
  product,
  cartQuantity,
  onAdd,
  onRemove,
  showImages,
}: {
  product: MenuProduct;
  cartQuantity: number;
  onAdd: () => void;
  onRemove: () => void;
  showImages: boolean;
}) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const imageUrl = product.image_url || product.images?.[0];

  const handleAdd = () => {
    setIsAdding(true);
    onAdd();
    setTimeout(() => setIsAdding(false), 300);
  };

  return (
    <Card
      className={cn(
        'overflow-hidden transition-all duration-300 hover:shadow-lg hover:scale-[1.02] group',
        'bg-white/5  border-white/10',
        cartQuantity > 0 && 'ring-2 ring-primary/50 border-primary/30'
      )}
    >
      {/* Product Image */}
      {showImages && imageUrl && (
        <div className="relative h-48 overflow-hidden bg-slate-50">
          <img
            src={imageUrl}
            alt={product.name}
            className={cn(
              'w-full h-full object-cover transition-all duration-500 group-hover:scale-110',
              imageLoaded ? 'opacity-100' : 'opacity-0'
            )}
            onLoad={() => setImageLoaded(true)}
            loading="lazy"
          />
          {!imageLoaded && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Leaf className="h-12 w-12 text-white/10" />
            </div>
          )}
          {/* Category Badge */}
          {product.category && (
            <Badge
              variant="secondary"
              className="absolute top-2 left-2 bg-black/60 text-white border-none text-xs"
            >
              {product.category}
            </Badge>
          )}
          {/* Strain Badge */}
          {product.strain_type && (
            <Badge
              variant="outline"
              className="absolute top-2 right-2 border-white/30 text-white text-xs bg-black/40"
            >
              {product.strain_type}
            </Badge>
          )}
          {/* Cart indicator overlay */}
          {cartQuantity > 0 && (
            <div className="absolute bottom-2 right-2 bg-primary text-primary-foreground rounded-full h-7 w-7 flex items-center justify-center text-xs font-bold shadow-lg">
              {cartQuantity}
            </div>
          )}
        </div>
      )}

      <div className="p-4 space-y-3">
        {/* Product Info */}
        <div>
          <h3 className="font-semibold text-white text-lg leading-tight">{product.name}</h3>
          {product.description && (
            <p className="text-white/50 text-sm mt-1 line-clamp-2">{product.description}</p>
          )}
        </div>

        {/* Cannabis Info */}
        {(product.thc_percentage || product.cbd_percentage) && (
          <div className="flex gap-2">
            {product.thc_percentage != null && product.thc_percentage > 0 && (
              <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 text-xs">
                THC {product.thc_percentage}%
              </Badge>
            )}
            {product.cbd_percentage != null && product.cbd_percentage > 0 && (
              <Badge variant="outline" className="border-blue-500/30 text-blue-400 text-xs">
                CBD {product.cbd_percentage}%
              </Badge>
            )}
          </div>
        )}

        {/* Effects & Terpenes */}
        {product.effects && product.effects.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {product.effects.slice(0, 3).map((effect) => (
              <span
                key={effect}
                className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-500/10 text-purple-300"
              >
                {effect}
              </span>
            ))}
          </div>
        )}

        {/* Price & Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-white/10">
          <div>
            {product.prices && Object.keys(product.prices).length > 0 ? (
              <div className="space-y-0.5">
                {Object.entries(product.prices).slice(0, 3).map(([weight, price]) => (
                  <div key={weight} className="flex items-baseline gap-1.5">
                    <span className="text-lg font-bold text-emerald-400">${Number(price).toFixed(2)}</span>
                    <span className="text-xs text-white/40">/ {weight}</span>
                  </div>
                ))}
              </div>
            ) : (
              <>
                <div className="text-2xl font-bold text-emerald-400">${Number(product.price).toFixed(2)}</div>
                <div className="text-xs text-white/40">per lb</div>
              </>
            )}
          </div>

          {cartQuantity === 0 ? (
            <Button
              size="sm"
              onClick={handleAdd}
              className={cn(
                'bg-slate-50 hover: hover:',
                'transition-all duration-200',
                isAdding && 'scale-110'
              )}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <Button
                size="icon"
                variant="outline"
                className="h-8 w-8 border-white/20 text-white hover:bg-white/10"
                onClick={onRemove}
                aria-label="Decrease quantity"
              >
                <Minus className="h-3 w-3" />
              </Button>
              <span className="text-white font-bold w-6 text-center">{cartQuantity}</span>
              <Button
                size="icon"
                className="h-8 w-8 bg-primary hover:bg-primary/90"
                onClick={handleAdd}
                aria-label="Increase quantity"
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

// ============================================
// Sticky Cart Summary
// ============================================

function CartSummary({
  cart,
  onCheckout,
  onClear,
}: {
  cart: CartItem[];
  onCheckout: () => void;
  onClear: () => void;
}) {
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const totalAmount = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);

  if (totalItems === 0) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-slate-50 ">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between bg-white/10 rounded-xl p-4 border border-white/10 shadow-2xl">
          <div className="flex items-center gap-3">
            <div className="relative">
              <ShoppingCart className="h-6 w-6 text-white" />
              <span className="absolute -top-2 -right-2 bg-primary text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold">
                {totalItems}
              </span>
            </div>
            <div>
              <div className="text-white font-semibold">{totalItems} item(s)</div>
              <div className="text-emerald-400 text-lg font-bold">
                ${totalAmount.toFixed(2)}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-white/50 hover:text-white hover:bg-white/10"
              onClick={onClear}
            >
              Clear
            </Button>
            <Button
              onClick={onCheckout}
              className="bg-slate-50 hover: hover: text-white font-semibold px-6"
            >
              Checkout
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Order Confirmation View
// ============================================

function OrderConfirmation({
  cart,
  menuData,
  token: _token,
  onBack,
  onComplete,
}: {
  cart: CartItem[];
  menuData: MenuDataResponse;
  token: string;
  onBack: () => void;
  onComplete: () => void;
}) {
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);

  const totalAmount = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);

  const handleSubmitOrder = async () => {
    if (!contactPhone.trim()) return;

    if (!menuData.tenant_id) {
      toast.error('Unable to place order. Please try refreshing the page.');
      logger.error('Missing tenant_id on menu data', { component: 'SecureMenuAccess' });
      return;
    }

    setSubmitting(true);
    try {
      const orderData = {
        items: cart.map((item) => ({
          product_id: item.product.id,
          product_name: item.product.name,
          quantity: item.quantity,
          price: item.product.price,
          subtotal: item.product.price * item.quantity,
        })),
        total: totalAmount,
        contact_name: contactName,
        notes,
      };

      const { error } = await supabase.from('menu_orders').insert({
        menu_id: menuData.menu_id,
        tenant_id: menuData.tenant_id,
        access_whitelist_id: menuData.whitelist_id || null,
        contact_phone: contactPhone,
        total_amount: totalAmount,
        status: 'pending',
        order_data: orderData as unknown as Json,
      });

      if (error) throw error;

      setOrderSuccess(true);
      toast.success('Order placed successfully!');
      logger.info('Order submitted successfully', { component: 'SecureMenuAccess' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not place order. Please try again.';
      toast.error(message);
      logger.error('Order submission failed', err, { component: 'SecureMenuAccess' });
    } finally {
      setSubmitting(false);
    }
  };

  if (orderSuccess) {
    return (
      <div className="min-h-dvh flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-8 bg-white/10  border-white/20 text-center space-y-6">
          <div className="relative inline-block mx-auto">
            <div className="absolute inset-0 bg-emerald-500/20 rounded-full blur-xl animate-pulse" />
            <div className="relative w-20 h-20 rounded-full bg-slate-50 flex items-center justify-center">
              <CheckCircle className="h-10 w-10 text-white" />
            </div>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">Order Placed!</h2>
            <p className="text-white/60">
              Your order has been submitted. You will be contacted at {contactPhone} for confirmation.
            </p>
          </div>
          <div className="bg-white/5 rounded-lg p-4 text-left space-y-2">
            <div className="flex justify-between text-white/60 text-sm">
              <span>Items</span>
              <span>{cart.reduce((sum, item) => sum + item.quantity, 0)}</span>
            </div>
            <div className="flex justify-between text-white font-semibold text-lg">
              <span>Total</span>
              <span className="text-emerald-400">${totalAmount.toFixed(2)}</span>
            </div>
          </div>
          <Button
            variant="outline"
            className="w-full border-white/20 text-white hover:bg-white/10"
            onClick={onComplete}
          >
            Done
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-4 pb-8 space-y-6">
      <Button
        variant="ghost"
        className="text-white/60 hover:text-white hover:bg-white/10"
        onClick={onBack}
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Menu
      </Button>

      <h2 className="text-2xl font-bold text-white">Complete Your Order</h2>

      {/* Order Summary */}
      <Card className="bg-white/5  border-white/10 p-4 space-y-3">
        <h3 className="font-semibold text-white flex items-center gap-2">
          <Package className="h-4 w-4" />
          Order Summary
        </h3>
        <div className="divide-y divide-white/10">
          {cart.map((item) => (
            <div key={item.product.id} className="flex justify-between py-2 text-sm">
              <span className="text-white/80">
                {item.product.name} x{item.quantity}
              </span>
              <span className="text-emerald-400 font-medium">
                ${(item.product.price * item.quantity).toFixed(2)}
              </span>
            </div>
          ))}
        </div>
        <div className="flex justify-between pt-2 border-t border-white/10 font-bold">
          <span className="text-white">Total</span>
          <span className="text-emerald-400 text-xl">${totalAmount.toFixed(2)}</span>
        </div>
      </Card>

      {/* Contact Info */}
      <Card className="bg-white/5  border-white/10 p-4 space-y-4">
        <h3 className="font-semibold text-white">Contact Information</h3>
        <div className="space-y-3">
          <div>
            <Label className="text-white/60">Name (optional)</Label>
            <Input
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              placeholder="Your name"
              className="bg-white/5 border-white/20 text-white placeholder:text-white/30"
            />
          </div>
          <div>
            <Label className="text-white/60">Phone Number *</Label>
            <Input
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              placeholder="(555) 123-4567"
              className="bg-white/5 border-white/20 text-white placeholder:text-white/30"
              required
            />
          </div>
          <div>
            <Label className="text-white/60">Notes (optional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any special requests..."
              className="bg-white/5 border-white/20 text-white placeholder:text-white/30"
              rows={3}
            />
          </div>
        </div>
      </Card>

      <Button
        onClick={handleSubmitOrder}
        disabled={!contactPhone.trim() || submitting}
        className="w-full h-14 text-lg bg-slate-50 hover: hover:"
      >
        {submitting ? (
          <>
            <Loader2 className="h-5 w-5 mr-2 animate-spin" />
            Placing Order...
          </>
        ) : (
          <>
            <ShoppingCart className="h-5 w-5 mr-2" />
            Place Order - ${totalAmount.toFixed(2)}
          </>
        )}
      </Button>
    </div>
  );
}

// ============================================
// Menu Browse View (Products + Cart)
// ============================================

function MenuBrowseView({
  menuData,
  token,
}: {
  menuData: MenuDataResponse;
  token: string;
}) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [checkoutMode, setCheckoutMode] = useState(false);

  const showImages = menuData.appearance_settings?.show_product_images !== false;

  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return menuData.products;
    const query = searchQuery.toLowerCase();
    return menuData.products.filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        p.category?.toLowerCase().includes(query) ||
        p.strain_type?.toLowerCase().includes(query)
    );
  }, [menuData.products, searchQuery]);

  const addToCart = (product: MenuProduct) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === productId);
      if (existing && existing.quantity > 1) {
        return prev.map((item) =>
          item.product.id === productId
            ? { ...item, quantity: item.quantity - 1 }
            : item
        );
      }
      return prev.filter((item) => item.product.id !== productId);
    });
  };

  const clearCart = () => setCart([]);

  const getCartQuantity = (productId: string): number => {
    return cart.find((item) => item.product.id === productId)?.quantity ?? 0;
  };

  if (checkoutMode) {
    return (
      <OrderConfirmation
        cart={cart}
        menuData={menuData}
        token={token}
        onBack={() => setCheckoutMode(false)}
        onComplete={() => {
          clearCart();
          setCheckoutMode(false);
        }}
      />
    );
  }

  return (
    <div className="pb-32">
      {/* Menu Header */}
      <div className="sticky top-0 z-40 bg-black/80  border-b border-white/10">
        <div className="max-w-3xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-white">{menuData.name || 'Menu'}</h1>
              {menuData.description && (
                <p className="text-white/50 text-sm">{menuData.description}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {menuData.expiration_date && !menuData.never_expires && (
                <ExpirationCountdown expirationDate={menuData.expiration_date} />
              )}
            </div>
          </div>

          {/* Search */}
          <div className="relative mt-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
            <Input
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-white/30"
              aria-label="Search products"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0 text-white/40 hover:text-white"
                onClick={() => setSearchQuery('')}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Products Grid */}
      <div className="max-w-3xl mx-auto px-4 py-6">
        {filteredProducts.length === 0 ? (
          <div className="text-center py-16">
            <Search className="h-12 w-12 mx-auto mb-4 text-white/20" />
            <p className="text-white/50">No products match your search</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {filteredProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                cartQuantity={getCartQuantity(product.id)}
                onAdd={() => addToCart(product)}
                onRemove={() => removeFromCart(product.id)}
                showImages={showImages}
              />
            ))}
          </div>
        )}
      </div>

      {/* Sticky Cart Summary */}
      <CartSummary
        cart={cart}
        onCheckout={() => setCheckoutMode(true)}
        onClear={clearCart}
      />
    </div>
  );
}

// ============================================
// Menu Unavailable Page (Expired / Burned)
// ============================================

function MenuUnavailablePage({
  reason,
}: {
  reason: 'expired' | 'burned' | 'unavailable';
}) {
  const isExpired = reason === 'expired';
  const Icon = isExpired ? CalendarX2 : Ban;
  const title = isExpired ? 'This Menu Has Expired' : 'This Menu Is No Longer Available';
  const description = isExpired
    ? 'The link you followed has expired. Menus are time-limited for security.'
    : 'This menu has been deactivated by the business.';

  return (
    <div className="min-h-dvh relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-slate-50" />

      {/* Content */}
      <div className="relative z-10 min-h-dvh flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-8 text-center">
          {/* Icon */}
          <div className="relative inline-block mx-auto">
            <div className={cn(
              'absolute inset-0 rounded-full blur-xl animate-pulse',
              isExpired ? 'bg-amber-500/20' : 'bg-red-500/20'
            )} />
            <div className={cn(
              'relative w-24 h-24 mx-auto rounded-full flex items-center justify-center',
              isExpired
                ? 'bg-slate-50'
                : 'bg-slate-50'
            )}>
              <Icon className="h-12 w-12 text-white" />
            </div>
          </div>

          {/* Message */}
          <div className="space-y-3">
            <h1 className="text-3xl font-bold text-white">{title}</h1>
            <p className="text-white/60 text-lg leading-relaxed">{description}</p>
          </div>

          {/* Contact CTA */}
          <Card className="p-6 bg-white/5  border-white/10">
            <p className="text-white/70 text-sm">
              Please contact the business for an updated link.
            </p>
          </Card>

          {/* Security badge */}
          <div className="flex justify-center">
            <Badge
              variant="outline"
              className="gap-1.5 border-white/20 text-white/50"
            >
              <Shield className="h-3 w-3" />
              Secured by FloraIQ
            </Badge>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Main SecureMenuAccess Component
// ============================================

export const SecureMenuAccess = () => {
  const { token } = useParams<{ token: string }>();
  const [searchParams] = useSearchParams();
  const uniqueToken = searchParams.get('u');

  const [accessCode, setAccessCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState<'location' | 'code' | 'verify'>('location');
  const [locationStatus, setLocationStatus] = useState<
    'checking' | 'granted' | 'denied' | 'skipped'
  >('checking');
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [error, setError] = useState('');
  const [shakeError, setShakeError] = useState(false);
  const [menuData, setMenuData] = useState<MenuDataResponse | null>(null);
  const [menuUnavailableReason, setMenuUnavailableReason] = useState<'expired' | 'burned' | 'unavailable' | null>(null);

  const steps = [
    { id: 'location', label: 'Location', icon: MapPin },
    { id: 'code', label: 'Enter Code', icon: Lock },
    { id: 'verify', label: 'Verify', icon: Shield },
  ];

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
          setLocationStatus('granted');
          setCurrentStep('code');
        },
        (err) => {
          logger.error(
            'Location access error',
            err instanceof Error ? err : new Error(String(err)),
            { component: 'SecureMenuAccess' }
          );
          setLocationStatus('denied');
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    } else {
      setLocationStatus('denied');
    }
  }, []);

  const generateDeviceFingerprint = useCallback(() => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.textBaseline = 'top';
      ctx.font = '14px Arial';
      ctx.fillText('fingerprint', 2, 2);
    }

    return {
      userAgent: navigator.userAgent,
      language: navigator.language,
      platform: navigator.platform,
      screen: `${screen.width}x${screen.height}`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      canvas: canvas.toDataURL(),
    };
  }, []);

  const handleSubmit = async () => {
    if (!accessCode || accessCode.length !== 8) {
      setError('Please enter all 8 characters');
      setShakeError(true);
      setTimeout(() => setShakeError(false), 500);
      return;
    }

    setLoading(true);
    setCurrentStep('verify');
    setError('');

    try {
      const fingerprint = generateDeviceFingerprint();
      const deviceHash = btoa(JSON.stringify(fingerprint));

      const { data, error: validateError } = await supabase.functions.invoke(
        'menu-access-validate',
        {
          body: {
            encrypted_url_token: token,
            access_code: accessCode.toUpperCase(),
            unique_access_token: uniqueToken,
            device_fingerprint: deviceHash,
            location,
            ip_address: 'client',
            user_agent: navigator.userAgent,
          },
        }
      );

      if (validateError) throw validateError;

      if (data && typeof data === 'object' && 'error' in data && data.error) {
        const errorMessage =
          typeof data.error === 'string' ? data.error : 'Menu access validation failed';
        throw new Error(errorMessage);
      }

      if (data) {
        if (data.access_granted) {
          sessionStorage.setItem(`menu_${token}`, JSON.stringify(data.menu_data));

          // Check forum redirect
          if (data.menu_data?.security_settings?.menu_type === 'forum') {
            const forumUrl = data.menu_data.security_settings?.forum_url || '/community';
            window.location.href = forumUrl;
            return;
          }

          // Show the inline menu browse experience
          setMenuData(data.menu_data as MenuDataResponse);
          return;
        } else if (data.violations) {
          const violations = data.violations as string[];
          const violationText = violations.join(', ').toLowerCase();
          if (violationText.includes('expired')) {
            setMenuUnavailableReason('expired');
            return;
          }
          if (violationText.includes('no longer available')) {
            setMenuUnavailableReason('burned');
            return;
          }
          throw new Error(violations.join(', '));
        } else if (data.error) {
          throw new Error(data.error);
        }
      }

      throw new Error('Access denied');
    } catch (err: unknown) {
      logger.error('Access validation error', err, { component: 'SecureMenuAccess' });
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to validate access. Please try again.';
      setError(errorMessage);
      setCurrentStep('code');
      setShakeError(true);
      setTimeout(() => setShakeError(false), 500);
    } finally {
      setLoading(false);
    }
  };

  const handleSkipLocation = () => {
    setLocationStatus('skipped');
    setCurrentStep('code');
  };

  // Show branded error page for expired/burned menus
  if (menuUnavailableReason) {
    return <MenuUnavailablePage reason={menuUnavailableReason} />;
  }

  // Show inline menu browse when access granted
  if (menuData) {
    return (
      <div className="min-h-dvh bg-slate-50">
        <MenuBrowseView menuData={menuData} token={token ?? ''} />
      </div>
    );
  }

  return (
    <div className="min-h-dvh relative overflow-hidden">
      {/* Animated gradient background */}
      <div className="absolute inset-0 bg-slate-50">
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-0 -left-4 w-72 h-72 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl animate-blob" />
          <div className="absolute top-0 -right-4 w-72 h-72 bg-indigo-500 rounded-full mix-blend-multiply filter blur-xl animate-blob animation-delay-2000" />
          <div className="absolute -bottom-8 left-20 w-72 h-72 bg-pink-500 rounded-full mix-blend-multiply filter blur-xl animate-blob animation-delay-4000" />
        </div>
      </div>

      {/* Content */}
      <div className="relative z-10 min-h-dvh flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-6">
          {/* Header */}
          <div className="text-center space-y-4">
            <div className="relative inline-block">
              <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl animate-pulse" />
              <div className="relative w-20 h-20 mx-auto rounded-full bg-slate-50 flex items-center justify-center shadow-2xl shadow-primary/30">
                <Shield className="h-10 w-10 text-white" />
              </div>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">Secure Access</h1>
              <p className="text-white/70">
                You have been invited to view an exclusive catalog
              </p>
            </div>
          </div>

          {/* Step Indicator */}
          <StepIndicator steps={steps} currentStep={currentStep} />

          {/* Main Card */}
          <Card
            className={cn(
              'p-6 sm:p-8 bg-white/10  border-white/20 shadow-2xl',
              shakeError && 'animate-shake'
            )}
          >
            {/* Location Step */}
            {currentStep === 'location' && (
              <div className="space-y-6 text-center">
                <div className="w-16 h-16 mx-auto rounded-full bg-primary/20 flex items-center justify-center">
                  {locationStatus === 'checking' ? (
                    <Loader2 className="h-8 w-8 text-primary animate-spin" />
                  ) : locationStatus === 'granted' ? (
                    <CheckCircle className="h-8 w-8 text-emerald-500" />
                  ) : (
                    <MapPin className="h-8 w-8 text-primary" />
                  )}
                </div>

                <div className="space-y-2">
                  <h2 className="text-xl font-semibold text-white">Location Verification</h2>
                  <p className="text-white/60 text-sm">
                    {locationStatus === 'checking'
                      ? 'Checking your location...'
                      : locationStatus === 'granted'
                        ? 'Location verified! Proceeding...'
                        : 'Location access helps verify your identity'}
                  </p>
                </div>

                {locationStatus === 'denied' && (
                  <div className="space-y-3">
                    <Alert className="bg-amber-500/10 border-amber-500/20 text-amber-200">
                      <AlertDescription>
                        Location access was denied. You can still continue, but some menus
                        may require location verification.
                      </AlertDescription>
                    </Alert>
                    <Button
                      onClick={handleSkipLocation}
                      className="w-full bg-white/10 hover:bg-white/20 text-white border-white/20"
                      variant="outline"
                    >
                      Continue Without Location
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Code Entry Step */}
            {currentStep === 'code' && (
              <div className="space-y-6">
                <div className="text-center space-y-2">
                  <h2 className="text-xl font-semibold text-white">Enter Access Code</h2>
                  <p className="text-white/60 text-sm">
                    Enter the 8-character code you received
                  </p>
                </div>

                <CodeInput
                  value={accessCode}
                  onChange={setAccessCode}
                  onComplete={handleSubmit}
                  disabled={loading}
                />

                {error && (
                  <Alert variant="destructive" className="bg-red-500/10 border-red-500/20">
                    <AlertDescription className="text-red-200">{error}</AlertDescription>
                  </Alert>
                )}

                <Button
                  onClick={handleSubmit}
                  className="w-full h-12 text-lg bg-slate-50 hover: hover:"
                  disabled={accessCode.length !== 8 || loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      Validating...
                    </>
                  ) : (
                    <>
                      <Lock className="h-5 w-5 mr-2" />
                      Access Menu
                    </>
                  )}
                </Button>

                <div className="flex justify-center">
                  <Badge
                    variant="outline"
                    className={cn(
                      'gap-1.5',
                      locationStatus === 'granted'
                        ? 'border-emerald-500/50 text-emerald-300'
                        : 'border-amber-500/50 text-amber-300'
                    )}
                  >
                    <MapPin className="h-3 w-3" />
                    {locationStatus === 'granted'
                      ? 'Location Verified'
                      : 'Location Not Verified'}
                  </Badge>
                </div>
              </div>
            )}

            {/* Verify Step */}
            {currentStep === 'verify' && (
              <div className="space-y-6 text-center py-4">
                <div className="w-16 h-16 mx-auto rounded-full bg-primary/20 flex items-center justify-center">
                  <Loader2 className="h-8 w-8 text-primary animate-spin" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-xl font-semibold text-white">Verifying Access</h2>
                  <p className="text-white/60 text-sm">
                    Please wait while we validate your credentials...
                  </p>
                </div>
                <div className="flex justify-center gap-2">
                  {['Checking code', 'Validating device', 'Preparing menu'].map(
                    (text, i) => (
                      <Badge
                        key={i}
                        variant="outline"
                        className="border-white/20 text-white/60 text-xs"
                      >
                        {text}
                      </Badge>
                    )
                  )}
                </div>
              </div>
            )}
          </Card>

          {/* Trust Badges */}
          <div className="flex flex-wrap justify-center gap-4 text-white/50 text-xs">
            <div className="flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5" />
              <span>End- Encrypted</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Fingerprint className="h-3.5 w-3.5" />
              <span>Device Verified</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              <span>Time-Limited Access</span>
            </div>
          </div>

          {/* Security Notice */}
          <div className="text-center text-white/40 text-xs space-y-1">
            <p>This catalog is confidential and for your eyes only.</p>
            <p>Do not share this link or take screenshots.</p>
          </div>
        </div>
      </div>

      {/* CSS for animations */}
      <style>{`
        @keyframes blob {
          0% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-4px); }
          20%, 40%, 60%, 80% { transform: translateX(4px); }
        }
        .animate-shake {
          animation: shake 0.5s ease-in-out;
        }
      `}</style>
    </div>
  );
};
