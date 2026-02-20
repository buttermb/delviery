/**
 * Cart Page
 * Shopping cart with quantity controls and checkout button
 */

import { useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useShop } from './ShopLayout';
import { useLuxuryTheme } from '@/components/shop/luxury';
import { useShopCart } from '@/hooks/useShopCart';
import { useDeals } from '@/hooks/useDeals';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingBag,
  Plus,
  Minus,
  Trash2,
  ArrowRight,
  Package,
  Truck,
  Tag,
  Loader2,
  Zap,
  QrCode
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { CartItemStockWarning, CartStockSummary } from '@/components/shop/CartStockWarning';
import ExpressPaymentButtons from '@/components/shop/ExpressPaymentButtons';
import { CartUpsellsSection } from '@/components/shop/CartUpsellsSection';

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
  // Use unified cart hook
  const {
    cartItems,
    cartCount,
    subtotal,
    updateQuantity,
    removeItem,
    clearCart,
    checkInventoryAvailability,
    appliedCoupon,
    applyCoupon: applySharedCoupon,
    removeCoupon: removeSharedCoupon,
    getCouponDiscount,
  } = useShopCart({
    storeId: store?.id,
    onCartChange: setCartItemCount,
  });

  // Fetch and calculate active deals
  const { appliedDeals, totalDiscount: dealsDiscount } = useDeals(store?.id, cartItems);

  const [couponCode, setCouponCode] = useState('');
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);
  const [isCheckingStock, setIsCheckingStock] = useState(false);

  const handleCheckout = async () => {
    setIsCheckingStock(true);
    try {
      const { valid, outOfStock } = await checkInventoryAvailability();

      if (!valid && outOfStock.length > 0) {
        toast.error("Some items are out of stock", {
          description: `Please remove ${outOfStock.length} out of stock item(s) before proceeding.`,
        });
        return;
      }

      navigate(`/shop/${storeSlug}/checkout`);
    } catch (error) {
      logger.error('Checkout check failed', error);
      toast.error("Error checking stock", {
        description: "Please try again.",
      });
    } finally {
      setIsCheckingStock(false);
    }
  };

  // Handle quantity update
  const handleUpdateQuantity = (productId: string, delta: number, variant?: string) => {
    updateQuantity(productId, delta, variant);
  };

  // Handle remove item
  const handleRemoveItem = (productId: string, variant?: string) => {
    removeItem(productId, variant);
    toast('Item removed from cart');
  };

  // Handle clear cart
  const handleClearCart = () => {
    clearCart();
    toast('Cart cleared');
  };

  // Apply coupon via shared cart hook
  const handleApplyCoupon = async () => {
    if (!couponCode.trim() || !store?.id) return;
    setIsApplyingCoupon(true);
    try {
      const result = await applySharedCoupon(couponCode.trim(), subtotal);
      if (result.success) {
        setCouponCode('');
        toast.success('Coupon applied!');
      } else {
        toast.error('Invalid coupon', {
          description: result.error || 'This coupon cannot be applied.',
        });
      }
    } catch (error: unknown) {
      logger.error('Error applying coupon', error);
      toast.error('Failed to apply coupon', {
        description: 'Please try again.',
      });
    } finally {
      setIsApplyingCoupon(false);
    }
  };

  // Remove coupon
  const removeCoupon = () => {
    removeSharedCoupon();
    toast('Coupon removed');
  };

  // Calculate totals
  const freeDeliveryThreshold = store?.free_delivery_threshold || 100;
  const deliveryFee = subtotal >= freeDeliveryThreshold ? 0 : (store?.default_delivery_fee || 5);
  const couponDiscount = getCouponDiscount(subtotal);
  const totalDiscount = dealsDiscount + couponDiscount;
  const total = Math.max(0, subtotal + deliveryFee - totalDiscount);

  const progressToFreeDelivery = Math.min(100, (subtotal / freeDeliveryThreshold) * 100);
  const amountToFreeDelivery = Math.max(0, freeDeliveryThreshold - subtotal);

  if (!store) return null;

  const themeColor = isLuxuryTheme ? accentColor : store.primary_color;

  return (
    <div className={`container mx-auto px-4 py-8 ${isLuxuryTheme ? 'min-h-dvh' : ''}`}>
      <h1 className={`text-3xl font-bold mb-8 ${isLuxuryTheme ? 'text-white font-extralight tracking-wide' : ''}`}>
        Shopping Cart
      </h1>

      {cartItems.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
        >
          <Card className={isLuxuryTheme ? 'bg-white/[0.02] border-white/[0.05] relative overflow-hidden' : ''}>
            {/* Background Gradient for Luxury Theme */}
            {isLuxuryTheme && (
              <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] via-transparent to-transparent pointer-events-none" />
            )}

            <CardContent className="py-24 text-center relative z-10">
              <motion.div
                animate={{
                  y: [0, -10, 0],
                  filter: ['drop-shadow(0 0 0px rgba(255,255,255,0))', 'drop-shadow(0 0 10px rgba(255,255,255,0.2))', 'drop-shadow(0 0 0px rgba(255,255,255,0))']
                }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                className="mb-8 relative inline-block"
              >
                <div className={`p-6 rounded-full ${isLuxuryTheme ? 'bg-white/5 border border-white/10' : 'bg-muted/50'}`}>
                  <ShoppingBag className={`w-12 h-12 ${isLuxuryTheme ? 'text-white/60' : 'text-muted-foreground'}`} strokeWidth={1.5} />
                </div>
              </motion.div>

              <h2 className={`text-2xl md:text-3xl font-light mb-4 ${isLuxuryTheme ? 'text-white' : ''}`}>
                Your cart is currently empty
              </h2>
              <p className={`text-lg mb-8 max-w-sm mx-auto ${textMuted}`}>
                Explore our curated collection of premium cannabis products.
              </p>

              <Link to={`/shop/${storeSlug}/products`}>
                <Button
                  size="lg"
                  className="rounded-full px-8 h-12 text-base font-medium transition-all hover:scale-105"
                  style={{ backgroundColor: themeColor, color: isLuxuryTheme ? '#000' : '#fff' }}
                >
                  Continue Shopping
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Cart Items */}
          <div className="lg:col-span-2 space-y-4">
            {/* Stock Summary */}
            <CartStockSummary cartItems={cartItems} className="mb-4" />

            {/* Free Delivery Progress */}
            {deliveryFee > 0 && (
              <Card className={isLuxuryTheme ? 'bg-white/[0.02] border-white/[0.05]' : 'bg-primary/5'}>
                <CardContent className="py-5">
                  <div className="flex items-center gap-3 mb-3">
                    <Truck className="w-5 h-5" style={{ color: themeColor }} />
                    <span className={`text-sm tracking-wide ${isLuxuryTheme ? textPrimary : ''}`}>
                      Add <span className="font-semibold" style={{ color: themeColor }}>{formatCurrency(amountToFreeDelivery)}</span> more for free delivery
                    </span>
                  </div>
                  <div className={`w-full rounded-full h-1.5 ${isLuxuryTheme ? 'bg-white/10' : 'bg-muted'}`}>
                    <motion.div
                      className="h-1.5 rounded-full relative"
                      initial={{ width: 0 }}
                      animate={{ width: `${progressToFreeDelivery}%` }}
                      transition={{ duration: 1, ease: "easeOut" }}
                      style={{
                        backgroundColor: themeColor,
                        boxShadow: isLuxuryTheme ? `0 0 10px ${themeColor}60` : 'none'
                      }}
                    >
                      {isLuxuryTheme && <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-white shadow-lg" />}
                    </motion.div>
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
                <AnimatePresence mode="popLayout">
                  {cartItems.map((item, index) => (
                    <motion.div
                      key={`${item.productId}-${item.variant || ''}`}
                      data-testid="cart-item"
                      className="flex gap-4"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 50, height: 0, marginBottom: 0 }}
                      transition={{ duration: 0.25, delay: index * 0.05 }}
                      layout
                    >
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
                        {item.metrcRetailId && (
                          <div className="flex items-center gap-1 mt-1 text-xs text-blue-500">
                            <QrCode className="w-3 h-3" />
                            <span>Metrc ID: {item.metrcRetailId}</span>
                          </div>
                        )}
                        {item.variant && (
                          <p className={`text-xs mt-0.5 ${textMuted}`}>{item.variant}</p>
                        )}
                        <p className="text-sm font-semibold mt-1" style={{ color: themeColor }}>
                          {formatCurrency(item.price)}
                        </p>
                        {/* Stock Warning for this item */}
                        <CartItemStockWarning
                          productId={item.productId}
                          requestedQuantity={item.quantity}
                          variant="minimal"
                          className="mt-1"
                        />
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Remove item"
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
                          <motion.span
                            key={item.quantity}
                            initial={{ scale: 1.3 }}
                            animate={{ scale: 1 }}
                            className={`w-8 text-center font-medium ${isLuxuryTheme ? textPrimary : ''}`}
                          >
                            {item.quantity}
                          </motion.span>
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
                    </motion.div>
                  ))}
                </AnimatePresence>
              </CardContent>
            </Card>

            {/* Upsells Section - You Might Also Like */}
            {store?.id && (
              <CartUpsellsSection
                storeId={store.id}
                excludeProductIds={cartItems.map(item => item.productId)}
                maxItems={8}
              />
            )}
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
                    onClick={handleApplyCoupon}
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

                {/* Active Deals */}
                {appliedDeals.length > 0 && (
                  <div className="space-y-2">
                    {appliedDeals.map(({ deal, discountAmount }) => (
                      <div key={deal.id} className={`flex items-center justify-between p-3 rounded-lg ${isLuxuryTheme ? 'bg-blue-500/10' : 'bg-blue-50'}`}>
                        <div className="flex items-center gap-2">
                          <Tag className={`w-4 h-4 ${isLuxuryTheme ? 'text-blue-400' : 'text-blue-600'}`} />
                          <span className={`text-sm font-medium ${isLuxuryTheme ? 'text-blue-400' : 'text-blue-600'}`}>
                            {deal.name}
                          </span>
                        </div>
                        <span className={`text-sm font-bold ${isLuxuryTheme ? 'text-blue-400' : 'text-blue-600'}`}>
                          -{formatCurrency(discountAmount)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                <Separator className={isLuxuryTheme ? 'bg-white/10' : ''} />

                {/* Totals */}
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className={textMuted}>Subtotal</span>
                    <span className={isLuxuryTheme ? textPrimary : ''}>{formatCurrency(subtotal)}</span>
                  </div>
                  {totalDiscount > 0 && (
                    <div className={`flex justify-between ${isLuxuryTheme ? 'text-green-400' : 'text-green-600'}`}>
                      <span>Discount</span>
                      <span>-{formatCurrency(totalDiscount)}</span>
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

                {/* Express Checkout */}
                <ExpressPaymentButtons
                  disabled={cartItems.length === 0}
                  showDivider={true}
                  size="lg"
                />

                {/* Checkout Button */}
                <Button
                  className="w-full"
                  size="lg"
                  style={{ backgroundColor: themeColor }}
                  onClick={handleCheckout}
                  disabled={isCheckingStock}
                >
                  {isCheckingStock ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <>
                      Proceed to Checkout
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>

                {/* Express Checkout Link */}
                <Button
                  variant="outline"
                  className={`w-full ${isLuxuryTheme ? buttonOutline : ''}`}
                  onClick={() => navigate(`/shop/${storeSlug}/express-checkout`)}
                >
                  <Zap className="w-4 h-4 mr-2" />
                  Express Checkout
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

      {/* Sticky Mobile Checkout Bar */}
      {cartItems.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 lg:hidden z-50">
          <div
            className={`p-4 border-t shadow-lg ${isLuxuryTheme ? 'bg-black/95 border-white/10 backdrop-blur-xl' : 'bg-white border-gray-200'}`}
          >
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className={`text-sm ${textMuted}`}>{cartCount} item{cartCount !== 1 ? 's' : ''}</p>
                <p className="text-lg font-bold" style={{ color: themeColor }}>{formatCurrency(total)}</p>
              </div>
              <Button
                size="lg"
                className="px-8"
                style={{ backgroundColor: themeColor }}
                onClick={handleCheckout}
                disabled={isCheckingStock}
              >
                {isCheckingStock ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    Checkout
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Spacer for sticky bar on mobile */}
      {cartItems.length > 0 && <div className="h-24 lg:hidden" />}
    </div>
  );
}
