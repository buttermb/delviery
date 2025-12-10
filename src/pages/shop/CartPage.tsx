/**
 * Cart Page
 * Shopping cart with quantity controls and checkout button
 */

import { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useShop } from './ShopLayout';
import { useLuxuryTheme } from '@/components/shop/luxury';
import { useShopCart, ShopCartItem } from '@/hooks/useShopCart';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { logger } from '@/lib/logger';
import {
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  ArrowRight,
  Package,
  Truck,
  Tag,
  Loader2
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils/formatCurrency';

interface AppliedCoupon {
  code: string;
  discount: number;
  type: string;
}

export default function CartPage() {
  const { storeSlug } = useParams();
  const navigate = useNavigate();
  const { store, setCartItemCount } = useShop();
  const {
    isLuxuryTheme,
    accentColor,
    cardBg,
    cardBorder,
    textPrimary,
    textMuted,
    inputBg,
    inputBorder,
    inputText,
    buttonOutline
  } = useLuxuryTheme();
  const { toast } = useToast();

  // Use unified cart hook
  const {
    cartItems,
    cartCount,
    subtotal,
    updateQuantity,
    removeItem,
    clearCart
  } = useShopCart({
    storeId: store?.id,
    onCartChange: setCartItemCount,
  });

  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null);
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);

  // Handle quantity update
  const handleUpdateQuantity = (productId: string, delta: number, variant?: string) => {
    updateQuantity(productId, delta, variant);
  };

  // Handle remove item
  const handleRemoveItem = (productId: string, variant?: string) => {
    removeItem(productId, variant);
    toast({ title: 'Item removed from cart' });
  };

  // Handle clear cart
  const handleClearCart = () => {
    clearCart();
    setAppliedCoupon(null);
    toast({ title: 'Cart cleared' });
  };

  // Apply coupon with retry logic
  const MAX_COUPON_RETRIES = 2;
  const applyCoupon = async (retryCount = 0) => {
    if (!couponCode.trim() || !store?.id) return;

    setIsApplyingCoupon(true);
    try {
      const { data, error } = await supabase
        .rpc('validate_marketplace_coupon', {
          p_store_id: store.id,
          p_code: couponCode.trim(),
          p_subtotal: subtotal,
        });

      if (error) {
        // Handle case where RPC function doesn't exist yet
        if (error.message?.includes('function') || error.code === '42883') {
          toast({
            title: 'Coupons not available',
            description: 'Coupon feature is not configured for this store.',
            variant: 'destructive',
          });
          return;
        }
        throw error;
      }

      const result = data?.[0];
      if (result?.is_valid) {
        setAppliedCoupon({
          code: couponCode.trim().toUpperCase(),
          discount: result.discount_amount,
          type: result.discount_type,
        });
        setCouponCode('');
        toast({ title: 'Coupon applied!' });
      } else {
        toast({
          title: 'Invalid coupon',
          description: result?.error_message || 'This coupon cannot be applied.',
          variant: 'destructive',
        });
      }
    } catch (error: any) {
      const isNetworkError = error instanceof Error &&
        (error.message.toLowerCase().includes('network') ||
          error.message.toLowerCase().includes('fetch') ||
          error.message.toLowerCase().includes('timeout'));

      // Retry on network errors
      if (isNetworkError && retryCount < MAX_COUPON_RETRIES) {
        toast({ title: 'Connection issue, retrying...' });
        await new Promise(resolve => setTimeout(resolve, 1000));
        setIsApplyingCoupon(false); // Reset to try again
        return applyCoupon(retryCount + 1);
      }

      logger.error('Error applying coupon', error);
      toast({
        title: 'Error',
        description: isNetworkError
          ? 'Network issue. Check your connection and try again.'
          : 'Failed to apply coupon. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsApplyingCoupon(false);
    }
  };

  // Remove coupon
  const removeCoupon = () => {
    setAppliedCoupon(null);
    toast({ title: 'Coupon removed' });
  };

  // Calculate totals
  const freeDeliveryThreshold = store?.free_delivery_threshold || 100;
  const deliveryFee = subtotal >= freeDeliveryThreshold ? 0 : (store?.default_delivery_fee || 5);
  const discount = appliedCoupon?.discount || 0;
  const total = subtotal + deliveryFee - discount;

  const progressToFreeDelivery = Math.min(100, (subtotal / freeDeliveryThreshold) * 100);
  const amountToFreeDelivery = Math.max(0, freeDeliveryThreshold - subtotal);

  if (!store) return null;

  const themeColor = isLuxuryTheme ? accentColor : store.primary_color;

  return (
    <div className={`container mx-auto px-4 py-8 ${isLuxuryTheme ? 'min-h-screen' : ''}`}>
      <h1 className={`text-3xl font-bold mb-8 ${isLuxuryTheme ? 'text-white font-extralight tracking-wide' : ''}`}>
        Shopping Cart
      </h1>

      {cartItems.length === 0 ? (
        <Card className={isLuxuryTheme ? `${cardBg} ${cardBorder}` : ''}>
          <CardContent className="py-16 text-center">
            <ShoppingCart className={`w-16 h-16 mx-auto mb-4 ${isLuxuryTheme ? 'text-white/20' : 'text-muted-foreground'}`} />
            <h2 className={`text-xl font-semibold mb-2 ${isLuxuryTheme ? 'text-white font-light' : ''}`}>
              Your cart is empty
            </h2>
            <p className={`mb-6 ${textMuted}`}>
              Add some products to get started
            </p>
            <Link to={`/shop/${storeSlug}/products`}>
              <Button style={{ backgroundColor: themeColor }}>
                Browse Products
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Cart Items */}
          <div className="lg:col-span-2 space-y-4">
            {/* Free Delivery Progress */}
            {deliveryFee > 0 && (
              <Card className={isLuxuryTheme ? `${cardBg} ${cardBorder}` : 'bg-primary/5'}>
                <CardContent className="py-4">
                  <div className="flex items-center gap-3 mb-2">
                    <Truck className="w-5 h-5" style={{ color: themeColor }} />
                    <span className={`text-sm ${isLuxuryTheme ? textPrimary : ''}`}>
                      Add <strong>{formatCurrency(amountToFreeDelivery)}</strong> more for free delivery
                    </span>
                  </div>
                  <div className={`w-full rounded-full h-2 ${isLuxuryTheme ? 'bg-white/10' : 'bg-muted'}`}>
                    <div
                      className="h-2 rounded-full transition-all duration-300"
                      style={{
                        width: `${progressToFreeDelivery}%`,
                        backgroundColor: themeColor,
                      }}
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Items */}
            <Card className={isLuxuryTheme ? `${cardBg} ${cardBorder}` : ''}>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className={isLuxuryTheme ? 'text-white font-light' : ''}>
                  {cartCount} item{cartCount !== 1 ? 's' : ''}
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearCart}
                  className={isLuxuryTheme ? 'text-white/60 hover:text-white hover:bg-white/10' : ''}
                >
                  Clear All
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {cartItems.map((item) => (
                  <div key={`${item.productId}-${item.variant || ''}`} className="flex gap-4">
                    <div className={`w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden ${isLuxuryTheme ? 'bg-white/5' : 'bg-muted'}`}>
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className={`w-8 h-8 ${isLuxuryTheme ? 'text-white/20' : 'text-muted-foreground'}`} />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <Link
                        to={`/shop/${storeSlug}/products/${item.productId}`}
                        className={`font-medium hover:underline line-clamp-2 ${isLuxuryTheme ? textPrimary : ''}`}
                      >
                        {item.name}
                      </Link>
                      {item.variant && (
                        <p className={`text-xs mt-0.5 ${textMuted}`}>{item.variant}</p>
                      )}
                      <p className="text-sm font-semibold mt-1" style={{ color: themeColor }}>
                        {formatCurrency(item.price)}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className={`h-8 w-8 ${isLuxuryTheme ? 'text-white/40 hover:text-red-400 hover:bg-white/10' : 'text-muted-foreground hover:text-destructive'}`}
                        onClick={() => handleRemoveItem(item.productId, item.variant)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          className={`h-8 w-8 ${isLuxuryTheme ? buttonOutline : ''}`}
                          onClick={() => handleUpdateQuantity(item.productId, -1, item.variant)}
                        >
                          <Minus className="w-4 h-4" />
                        </Button>
                        <span className={`w-8 text-center font-medium ${isLuxuryTheme ? textPrimary : ''}`}>
                          {item.quantity}
                        </span>
                        <Button
                          variant="outline"
                          size="icon"
                          className={`h-8 w-8 ${isLuxuryTheme ? buttonOutline : ''}`}
                          onClick={() => handleUpdateQuantity(item.productId, 1, item.variant)}
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Order Summary */}
          <div className="space-y-4">
            <Card className={isLuxuryTheme ? `${cardBg} ${cardBorder}` : ''}>
              <CardHeader>
                <CardTitle className={isLuxuryTheme ? 'text-white font-light' : ''}>
                  Order Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Coupon Input */}
                <div className="flex gap-2">
                  <Input
                    placeholder="Coupon code"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value)}
                    disabled={!!appliedCoupon}
                    className={isLuxuryTheme ? `${inputBg} ${inputBorder} ${inputText}` : ''}
                  />
                  <Button
                    variant="outline"
                    onClick={() => applyCoupon()}
                    disabled={isApplyingCoupon || !!appliedCoupon || !couponCode.trim()}
                    className={isLuxuryTheme ? buttonOutline : ''}
                  >
                    {isApplyingCoupon ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      "Apply"
                    )}
                  </Button>
                </div>

                {appliedCoupon && (
                  <div className={`flex items-center justify-between p-3 rounded-lg ${isLuxuryTheme ? 'bg-green-500/10' : 'bg-green-50'}`}>
                    <div className="flex items-center gap-2">
                      <Tag className={`w-4 h-4 ${isLuxuryTheme ? 'text-green-400' : 'text-green-600'}`} />
                      <span className={`text-sm font-medium ${isLuxuryTheme ? 'text-green-400' : 'text-green-600'}`}>
                        {appliedCoupon.code}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={removeCoupon}
                      className={`${isLuxuryTheme ? 'text-red-400 hover:text-red-300 hover:bg-white/5' : 'text-red-500 hover:text-red-600'}`}
                    >
                      Remove
                    </Button>
                  </div>
                )}

                <Separator className={isLuxuryTheme ? 'bg-white/10' : ''} />

                {/* Totals */}
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className={textMuted}>Subtotal</span>
                    <span className={isLuxuryTheme ? textPrimary : ''}>{formatCurrency(subtotal)}</span>
                  </div>
                  {discount > 0 && (
                    <div className={`flex justify-between ${isLuxuryTheme ? 'text-green-400' : 'text-green-600'}`}>
                      <span>Discount</span>
                      <span>-{formatCurrency(discount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className={textMuted}>Delivery</span>
                    <span className={isLuxuryTheme ? textPrimary : ''}>
                      {deliveryFee === 0 ? (
                        <Badge variant="secondary" className={isLuxuryTheme ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-700'}>
                          FREE
                        </Badge>
                      ) : (
                        formatCurrency(deliveryFee)
                      )}
                    </span>
                  </div>
                  <Separator className={isLuxuryTheme ? 'bg-white/10' : ''} />
                  <div className="flex justify-between text-lg font-bold">
                    <span className={isLuxuryTheme ? textPrimary : ''}>Total</span>
                    <span style={{ color: themeColor }}>{formatCurrency(total)}</span>
                  </div>
                </div>

                {/* Checkout Button */}
                <Button
                  className="w-full"
                  size="lg"
                  style={{ backgroundColor: themeColor }}
                  onClick={() => navigate(`/shop/${storeSlug}/checkout`)}
                >
                  Proceed to Checkout
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>

                {/* Continue Shopping */}
                <Link to={`/shop/${storeSlug}/products`} className="block">
                  <Button
                    variant="outline"
                    className={`w-full ${isLuxuryTheme ? buttonOutline : ''}`}
                  >
                    Continue Shopping
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
