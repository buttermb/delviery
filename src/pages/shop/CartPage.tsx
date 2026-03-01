/**
 * Cart Page
 * Shopping cart with quantity controls and checkout button
 */

import { useState, useEffect, useCallback } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useShop } from '@/pages/shop/ShopLayout';
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
  Truck,
  Tag,
  Loader2,
  Zap,
  QrCode,
  AlertTriangle
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { CartItemStockWarning, CartStockSummary, useCartStockCheck } from '@/components/shop/CartStockWarning';
import ExpressPaymentButtons from '@/components/shop/ExpressPaymentButtons';
import { CartUpsellsSection } from '@/components/shop/CartUpsellsSection';
import { SwipeableCartItem } from '@/components/SwipeableCartItem';
import ProductImage from '@/components/ProductImage';

export default function CartPage() {
  const { storeSlug } = useParams<{ storeSlug: string }>();
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
    syncCartPrices,
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

  // Real-time stock validation — disables checkout when stock issues exist
  const { data: stockCheck } = useCartStockCheck(cartItems);
  const hasStockIssues = stockCheck?.hasInsufficientStock ?? false;

  const [couponCode, setCouponCode] = useState('');
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);
  const [isCheckingStock, setIsCheckingStock] = useState(false);
  const [priceChanges, setPriceChanges] = useState<Array<{ productId: string; name: string; oldPrice: number; newPrice: number }>>([]);

  // Sync cart prices with server on mount and when returning to cart
  const checkPrices = useCallback(async () => {
    if (cartItems.length === 0) return;
    const result = await syncCartPrices();
    if (result.changed) {
      setPriceChanges(result.priceChanges);
      toast.warning('Some prices have been updated', {
        description: 'Your cart has been updated with the latest prices.',
      });
    }
  }, [cartItems.length, syncCartPrices]);

  useEffect(() => {
    checkPrices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Listen for real-time price changes while on cart page
  useEffect(() => {
    const handlePriceChange = (event: CustomEvent) => {
      const { productId, oldPrice, newPrice, productName } = event.detail;
      const inCart = cartItems.some(item => item.productId === productId);
      if (inCart) {
        setPriceChanges(prev => {
          const existing = prev.find(p => p.productId === productId);
          if (existing) return prev.map(p => p.productId === productId ? { ...p, newPrice, oldPrice } : p);
          return [...prev, { productId, name: productName, oldPrice, newPrice }];
        });
        // Re-sync cart prices to update stored values
        syncCartPrices();
      }
    };

    window.addEventListener('productPriceChanged', handlePriceChange as EventListener);
    return () => window.removeEventListener('productPriceChanged', handlePriceChange as EventListener);
  }, [cartItems, syncCartPrices]);

  const handleCheckout = async () => {
    // Block immediately if we already know stock is insufficient
    if (hasStockIssues) {
      toast.error('Stock issues in your cart', {
        description: 'Please adjust quantities for items with insufficient stock before proceeding.',
      });
      return;
    }

    setIsCheckingStock(true);
    try {
      // Sync prices before checkout
      const priceResult = await syncCartPrices();
      if (priceResult.changed) {
        setPriceChanges(priceResult.priceChanges);
        toast.warning('Prices updated', {
          description: 'Some product prices have changed. Please review your cart before proceeding.',
        });
        return;
      }

      // Fresh server-side stock check at checkout time
      const { valid, outOfStock, lowStock } = await checkInventoryAvailability();

      if (!valid && outOfStock.length > 0) {
        const itemNames = outOfStock.map(i => i.name).join(', ');
        toast.error('Insufficient stock', {
          description: `Please adjust quantities for: ${itemNames}`,
        });
        return;
      }

      // Warn about low stock but don't block
      if (lowStock.length > 0) {
        toast.info('Some items are running low', {
          description: 'Stock is limited — your order will be confirmed at checkout.',
        });
      }

      navigate(`/shop/${storeSlug}/checkout`);
    } catch (error) {
      logger.error('Checkout stock validation failed', error);
      toast.error('Unable to verify stock', {
        description: 'Please try again.',
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
    toast.success('Item removed from cart');
  };

  // Handle clear cart
  const handleClearCart = () => {
    clearCart();
    toast.success('Cart cleared');
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
    toast.success('Coupon removed');
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
    <div className={`container mx-auto px-3 sm:px-4 py-4 sm:py-8 overflow-x-hidden ${isLuxuryTheme ? 'min-h-dvh' : ''}`}>
      <h1 className={`text-2xl sm:text-3xl font-bold mb-4 sm:mb-8 ${isLuxuryTheme ? 'text-white font-extralight tracking-wide' : ''}`}>
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

            <CardContent className="py-12 sm:py-24 text-center relative z-10">
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-8">
          {/* Cart Items */}
          <div className="lg:col-span-2 space-y-3 sm:space-y-4">
            {/* Stock Summary */}
            <CartStockSummary cartItems={cartItems} className="mb-4" />

            {/* Price Change Warning */}
            {priceChanges.length > 0 && (
              <Card className={`border-amber-300 ${isLuxuryTheme ? 'bg-amber-500/10 border-amber-500/30' : 'bg-amber-50'}`} data-testid="price-change-warning">
                <CardContent className="py-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${isLuxuryTheme ? 'text-amber-400' : 'text-amber-600'}`} />
                    <div className="flex-1">
                      <p className={`text-sm font-medium mb-2 ${isLuxuryTheme ? 'text-amber-300' : 'text-amber-800'}`}>
                        Prices updated
                      </p>
                      {priceChanges.map((change, idx) => (
                        <p key={`${change.productId}-${idx}`} className={`text-xs ${isLuxuryTheme ? 'text-amber-400/80' : 'text-amber-700'}`}>
                          {change.name}: <span className="line-through">{formatCurrency(change.oldPrice)}</span>{' '}
                          <span className="font-semibold">{formatCurrency(change.newPrice)}</span>
                        </p>
                      ))}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={`flex-shrink-0 ${isLuxuryTheme ? 'text-amber-400 hover:text-amber-300 hover:bg-white/5' : 'text-amber-700 hover:text-amber-800'}`}
                      onClick={() => setPriceChanges([])}
                    >
                      Dismiss
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

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
              <CardContent className="space-y-4 px-3 sm:px-6">
                <AnimatePresence mode="popLayout">
                  {cartItems.map((item, index) => (
                    <SwipeableCartItem
                      key={`${item.productId}-${item.variant ?? ''}`}
                      onDelete={() => handleRemoveItem(item.productId, item.variant)}
                    >
                      <motion.div
                        data-testid="cart-item"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 50, height: 0, marginBottom: 0 }}
                        transition={{ duration: 0.25, delay: index * 0.05 }}
                        layout
                      >
                        {/* Top row: image + product info + desktop controls */}
                        <div className="flex gap-3 sm:gap-4">
                          <div className={`w-16 h-16 sm:w-20 sm:h-20 flex-shrink-0 rounded-lg overflow-hidden ${isLuxuryTheme ? 'bg-white/5' : 'bg-muted'}`}>
                            <ProductImage
                              src={item.imageUrl}
                              alt={item.name}
                              className="w-full h-full"
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <Link
                              to={`/shop/${storeSlug}/products/${item.productId}`}
                              className={`text-sm sm:text-base font-medium hover:underline line-clamp-2 ${isLuxuryTheme ? textPrimary : ''}`}
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
                            <CartItemStockWarning
                              productId={item.productId}
                              requestedQuantity={item.quantity}
                              variant="minimal"
                              className="mt-1"
                            />
                          </div>
                          {/* Desktop controls — hidden on mobile */}
                          <div className="hidden sm:flex flex-col items-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label="Remove item"
                              className={`h-8 w-8 ${isLuxuryTheme ? 'text-white/70 hover:text-red-400 hover:bg-white/10' : 'text-muted-foreground hover:text-destructive'}`}
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
                                aria-label="Decrease quantity"
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
                                aria-label="Increase quantity"
                              >
                                <Plus className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </div>

                        {/* Mobile controls row — 44px touch targets */}
                        <div className="flex sm:hidden items-center justify-between mt-3">
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="icon"
                              className={`h-11 w-11 rounded-full ${isLuxuryTheme ? buttonOutline : ''}`}
                              onClick={() => handleUpdateQuantity(item.productId, -1, item.variant)}
                              aria-label="Decrease quantity"
                            >
                              <Minus className="w-4 h-4" />
                            </Button>
                            <motion.span
                              key={item.quantity}
                              initial={{ scale: 1.3 }}
                              animate={{ scale: 1 }}
                              className={`w-8 text-center font-semibold text-base ${isLuxuryTheme ? textPrimary : ''}`}
                            >
                              {item.quantity}
                            </motion.span>
                            <Button
                              variant="outline"
                              size="icon"
                              className={`h-11 w-11 rounded-full ${isLuxuryTheme ? buttonOutline : ''}`}
                              onClick={() => handleUpdateQuantity(item.productId, 1, item.variant)}
                              aria-label="Increase quantity"
                            >
                              <Plus className="w-4 h-4" />
                            </Button>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold" style={{ color: themeColor }}>
                              {formatCurrency(item.price * item.quantity)}
                            </span>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label="Remove item"
                              className={`h-11 w-11 ${isLuxuryTheme ? 'text-white/40 hover:text-red-400 hover:bg-white/10' : 'text-muted-foreground hover:text-destructive'}`}
                              onClick={() => handleRemoveItem(item.productId, item.variant)}
                            >
                              <Trash2 className="w-5 h-5" />
                            </Button>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Remove item"
                            className={`h-11 w-11 ${isLuxuryTheme ? 'text-white/70 hover:text-red-400 hover:bg-white/10' : 'text-muted-foreground hover:text-destructive'}`}
                            onClick={() => handleRemoveItem(item.productId, item.variant)}
                          >
                            <Trash2 className="w-5 h-5" />
                          </Button>
                        </div>
                      </motion.div>
                    </SwipeableCartItem>
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
                    aria-label="Coupon code"
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
                  <div className="flex justify-between" data-testid="cart-subtotal">
                    <span className={textMuted}>Subtotal</span>
                    <span className={isLuxuryTheme ? textPrimary : ''}>{formatCurrency(subtotal)}</span>
                  </div>
                  {totalDiscount > 0 && (
                    <div className={`flex justify-between ${isLuxuryTheme ? 'text-green-400' : 'text-green-600'}`} data-testid="cart-discount">
                      <span>Discount</span>
                      <span>-{formatCurrency(totalDiscount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between" data-testid="cart-delivery-fee">
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
                  <div className="flex justify-between text-lg font-bold" data-testid="cart-total">
                    <span className={isLuxuryTheme ? textPrimary : ''}>Total</span>
                    <span style={{ color: themeColor }}>{formatCurrency(total)}</span>
                  </div>
                </div>

                {/* Express Checkout */}
                <ExpressPaymentButtons
                  disabled={cartItems.length === 0 || hasStockIssues}
                  showDivider={true}
                  size="lg"
                />

                {/* Checkout Button */}
                <Button
                  className="w-full"
                  size="lg"
                  data-testid="checkout-button"
                  style={{ backgroundColor: hasStockIssues ? undefined : themeColor }}
                  onClick={handleCheckout}
                  disabled={isCheckingStock || hasStockIssues}
                >
                  {isCheckingStock ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : hasStockIssues ? (
                    <>
                      <AlertTriangle className="w-4 h-4 mr-2" />
                      Fix Stock Issues to Checkout
                    </>
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
            className={`px-3 sm:px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] border-t shadow-lg ${isLuxuryTheme ? 'bg-black/95 border-white/10 backdrop-blur-xl' : 'bg-white border-gray-200'}`}
          >
            <div className="flex items-center justify-between mb-2">
              <p className={`text-sm ${textMuted}`}>{cartCount} item{cartCount !== 1 ? 's' : ''}</p>
              <p className="text-lg font-bold" style={{ color: themeColor }}>{formatCurrency(total)}</p>
            </div>
            <Button
              className="w-full h-12 text-base"
              data-testid="mobile-checkout-button"
              style={{ backgroundColor: hasStockIssues ? undefined : themeColor }}
              className="w-full h-12 text-base font-semibold rounded-lg"
              style={{ backgroundColor: themeColor }}
              onClick={handleCheckout}
              disabled={isCheckingStock || hasStockIssues}
            >
              {isCheckingStock ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : hasStockIssues ? (
                <>
                  <AlertTriangle className="w-4 h-4 mr-2" />
                  Fix Stock Issues
                </>
              ) : (
                <>
                  Checkout — {formatCurrency(total)}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Spacer for sticky bar on mobile */}
      {cartItems.length > 0 && <div className="h-24 lg:hidden" />}
    </div>
  );
}
