/**
 * OrderSummary
 * Desktop sidebar with cart items, loyalty, coupons, gift cards, and totals
 */

import { Loader2, Package, ShoppingCart, CreditCard, ArrowLeft, Tag } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { CheckoutLoyalty } from '@/components/shop/CheckoutLoyalty';
import { formatCurrency } from '@/lib/formatters';
import { toast } from 'sonner';

interface CartItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  imageUrl?: string;
}

interface AppliedCoupon {
  code: string;
  coupon_id?: string;
  free_shipping?: boolean;
}

interface AppliedGiftCard {
  code: string;
  balance: number;
}

interface OrderSummaryProps {
  // Cart
  cartItems: CartItem[];
  subtotal: number;
  // Pricing
  fulfillmentMethod: string;
  effectiveDeliveryFee: number;
  couponDiscount: number;
  dealsDiscount: number;
  loyaltyDiscount: number;
  enableCartRounding: boolean;
  roundingAdjustment: number;
  totalBeforeGiftCards: number;
  giftCardAmount: number;
  total: number;
  // Coupon
  couponCode: string;
  setCouponCode: (value: string) => void;
  isApplyingCoupon: boolean;
  couponError: string | null;
  setCouponError: (value: string | null) => void;
  handleApplyCoupon: () => void;
  appliedCoupon: AppliedCoupon | null;
  removeCoupon: () => void;
  // Gift Cards
  giftCardCode: string;
  setGiftCardCode: (value: string) => void;
  isCheckingGiftCard: boolean;
  handleApplyGiftCard: () => void;
  appliedGiftCards: AppliedGiftCard[];
  removeGiftCard: (code: string) => void;
  // Loyalty
  storeId: string | undefined;
  customerEmail: string;
  loyaltyPointsUsed: number;
  setLoyaltyDiscount: (value: number) => void;
  setLoyaltyPointsUsed: (value: number) => void;
  // Theme
  isLuxuryTheme: boolean;
  themeColor: string;
  cardBg: string;
  cardBorder: string;
  textPrimary: string;
  textMuted: string;
  inputBg: string;
  inputBorder: string;
  inputText: string;
}

export function OrderSummary({
  cartItems,
  subtotal,
  fulfillmentMethod,
  effectiveDeliveryFee,
  couponDiscount,
  dealsDiscount,
  loyaltyDiscount,
  enableCartRounding,
  roundingAdjustment,
  totalBeforeGiftCards,
  giftCardAmount,
  total,
  couponCode,
  setCouponCode,
  isApplyingCoupon,
  couponError,
  setCouponError,
  handleApplyCoupon,
  appliedCoupon,
  removeCoupon,
  giftCardCode,
  setGiftCardCode,
  isCheckingGiftCard,
  handleApplyGiftCard,
  appliedGiftCards,
  removeGiftCard,
  storeId,
  customerEmail,
  loyaltyPointsUsed,
  setLoyaltyDiscount,
  setLoyaltyPointsUsed,
  isLuxuryTheme,
  themeColor,
  cardBg,
  cardBorder,
  textPrimary,
  textMuted,
  inputBg,
  inputBorder,
  inputText,
}: OrderSummaryProps) {
  return (
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
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
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
                    Qty: {item.quantity} x {formatCurrency(item.price)}
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
          {storeId && customerEmail && (
            <CheckoutLoyalty
              storeId={storeId}
              customerEmail={customerEmail}
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

      {/* Order Summary totals card */}
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
                      <ArrowLeft className="w-3 h-3 rotate-45" />
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
            {fulfillmentMethod === 'delivery' && effectiveDeliveryFee > 0 && (
              <div className="flex justify-between">
                <span className={textMuted}>Delivery</span>
                <span className={isLuxuryTheme ? textPrimary : ''}>{formatCurrency(effectiveDeliveryFee)}</span>
              </div>
            )}
            {fulfillmentMethod === 'pickup' && (
              <div className="flex justify-between">
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
            <div className="flex justify-between text-lg font-bold">
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
  );
}
