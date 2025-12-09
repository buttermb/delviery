/**
 * Cart Page
 * Shopping cart with quantity controls and checkout button
 */

import { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useShop } from './ShopLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import {
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  ArrowRight,
  Package,
  Truck,
  Tag
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils/formatCurrency';

interface CartItem {
  productId: string;
  quantity: number;
  price: number;
  name: string;
  imageUrl: string | null;
}

interface ProductInfo {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
  in_stock: boolean;
}

export default function CartPage() {
  const { storeSlug } = useParams();
  const navigate = useNavigate();
  const { store, setCartItemCount } = useShop();
  const { toast } = useToast();

  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<{
    code: string;
    discount: number;
    type: string;
  } | null>(null);
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);

  // Load cart from localStorage
  useEffect(() => {
    if (store?.id) {
      const savedCart = localStorage.getItem(`shop_cart_${store.id}`);
      if (savedCart) {
        try {
          setCartItems(JSON.parse(savedCart));
        } catch {
          setCartItems([]);
        }
      }
    }
  }, [store?.id]);

  // Save cart to localStorage
  const saveCart = (items: CartItem[]) => {
    if (store?.id) {
      localStorage.setItem(`shop_cart_${store.id}`, JSON.stringify(items));
      setCartItems(items);
      setCartItemCount(items.reduce((sum, item) => sum + item.quantity, 0));
    }
  };

  // Update quantity
  const updateQuantity = (productId: string, delta: number) => {
    const newItems = cartItems.map((item) => {
      if (item.productId === productId) {
        const newQty = Math.max(0, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    }).filter((item) => item.quantity > 0);
    
    saveCart(newItems);
  };

  // Remove item
  const removeItem = (productId: string) => {
    const newItems = cartItems.filter((item) => item.productId !== productId);
    saveCart(newItems);
    toast({ title: 'Item removed from cart' });
  };

  // Clear cart
  const clearCart = () => {
    saveCart([]);
    setAppliedCoupon(null);
    toast({ title: 'Cart cleared' });
  };

  // Apply coupon
  const applyCoupon = async () => {
    if (!couponCode.trim() || !store?.id) return;

    setIsApplyingCoupon(true);
    try {
      const { data, error } = await supabase
        .rpc('validate_marketplace_coupon', {
          p_store_id: store.id,
          p_code: couponCode.trim(),
          p_subtotal: subtotal,
        });

      if (error) throw error;

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
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to apply coupon. Please try again.',
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
  const subtotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const freeDeliveryThreshold = store?.free_delivery_threshold || 100;
  const deliveryFee = subtotal >= freeDeliveryThreshold ? 0 : (store?.default_delivery_fee || 5);
  const discount = appliedCoupon?.discount || 0;
  const total = subtotal + deliveryFee - discount;

  const progressToFreeDelivery = Math.min(100, (subtotal / freeDeliveryThreshold) * 100);
  const amountToFreeDelivery = Math.max(0, freeDeliveryThreshold - subtotal);

  if (!store) return null;

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Shopping Cart</h1>

      {cartItems.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <ShoppingCart className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-semibold mb-2">Your cart is empty</h2>
            <p className="text-muted-foreground mb-6">
              Add some products to get started
            </p>
            <Link to={`/shop/${storeSlug}/products`}>
              <Button style={{ backgroundColor: store.primary_color }}>
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
              <Card className="bg-primary/5">
                <CardContent className="py-4">
                  <div className="flex items-center gap-3 mb-2">
                    <Truck className="w-5 h-5" style={{ color: store.primary_color }} />
                    <span className="text-sm">
                      Add <strong>{formatCurrency(amountToFreeDelivery)}</strong> more for free delivery
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className="h-2 rounded-full transition-all"
                      style={{
                        width: `${progressToFreeDelivery}%`,
                        backgroundColor: store.primary_color,
                      }}
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Items */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>
                  {cartItems.length} item{cartItems.length !== 1 ? 's' : ''}
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={clearCart}>
                  Clear All
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {cartItems.map((item) => (
                  <div key={item.productId} className="flex gap-4">
                    <div className="w-20 h-20 flex-shrink-0 bg-muted rounded-lg overflow-hidden">
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="w-8 h-8 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <Link
                        to={`/shop/${storeSlug}/products/${item.productId}`}
                        className="font-medium hover:underline line-clamp-2"
                      >
                        {item.name}
                      </Link>
                      <p className="text-sm font-semibold mt-1" style={{ color: store.primary_color }}>
                        {formatCurrency(item.price)}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => removeItem(item.productId)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => updateQuantity(item.productId, -1)}
                        >
                          <Minus className="w-4 h-4" />
                        </Button>
                        <span className="w-8 text-center font-medium">{item.quantity}</span>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => updateQuantity(item.productId, 1)}
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
            <Card>
              <CardHeader>
                <CardTitle>Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Coupon Input */}
                <div className="flex gap-2">
                  <Input
                    placeholder="Coupon code"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value)}
                    disabled={!!appliedCoupon}
                  />
                  <Button
                    variant="outline"
                    onClick={applyCoupon}
                    disabled={isApplyingCoupon || !!appliedCoupon}
                  >
                    Apply
                  </Button>
                </div>

                {appliedCoupon && (
                  <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Tag className="w-4 h-4 text-green-600" />
                      <span className="text-sm font-medium text-green-600">
                        {appliedCoupon.code}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={removeCoupon}
                      className="text-red-500 hover:text-red-600"
                    >
                      Remove
                    </Button>
                  </div>
                )}

                <Separator />

                {/* Totals */}
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>{formatCurrency(subtotal)}</span>
                  </div>
                  {discount > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Discount</span>
                      <span>-{formatCurrency(discount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
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

                {/* Checkout Button */}
                <Button
                  className="w-full"
                  size="lg"
                  style={{ backgroundColor: store.primary_color }}
                  onClick={() => navigate(`/shop/${storeSlug}/checkout`)}
                >
                  Proceed to Checkout
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>

                {/* Continue Shopping */}
                <Link to={`/shop/${storeSlug}/products`} className="block">
                  <Button variant="outline" className="w-full">
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




