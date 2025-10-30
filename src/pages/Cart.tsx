import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import CustomerLayout from "@/layouts/CustomerLayout";
import CouponInput from "@/components/CouponInput";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Minus, Plus, Trash2, ShoppingBag, Truck, ArrowRight } from "lucide-react";
import { useGuestCart } from "@/hooks/useGuestCart";
import { useAuth } from "@/contexts/AuthContext";

const Cart = () => {
  const { user } = useAuth();
  const { guestCart, updateGuestCartItem, removeFromGuestCart } = useGuestCart();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discount: number } | null>(null);

  // Fetch authenticated user's cart
  const { data: dbCartItems = [] } = useQuery({
    queryKey: ["cart", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("cart_items")
        .select("*, products(*)")
        .eq("user_id", user.id);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });

  // Fetch product details for guest cart items
  const { data: guestProducts = [] } = useQuery({
    queryKey: ["guest-cart-products", guestCart.map(i => i.product_id).join(",")],
    queryFn: async () => {
      if (guestCart.length === 0) return [];
      const productIds = guestCart.map(item => item.product_id);
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .in("id", productIds);
      if (error) throw error;
      return data;
    },
    enabled: !user && guestCart.length > 0,
  });

  // Combine guest cart items with product data
  const guestCartItems = user ? [] : guestCart.map(item => ({
    ...item,
    id: `${item.product_id}-${item.selected_weight}`, // Unique key for rendering
    products: guestProducts.find(p => p.id === item.product_id)
  })).filter(item => item.products); // Only show items with loaded products

  const cartItems = user ? dbCartItems : guestCartItems;

  const getItemPrice = (item: any) => {
    const product = item.products;
    const selectedWeight = item.selected_weight || "unit";
    
    if (product?.prices && typeof product.prices === 'object') {
      return product.prices[selectedWeight] || product.price || 0;
    }
    return product?.price || 0;
  };

  const subtotal = cartItems.reduce(
    (sum, item) => sum + getItemPrice(item) * item.quantity,
    0
  );

  const discount = appliedCoupon?.discount || 0;
  const totalAfterDiscount = subtotal - discount;

  const updateQuantity = async (itemId: string, productId: string, selectedWeight: string, newQuantity: number) => {
    if (newQuantity < 1) return;
    
    try {
      if (!user) {
        // Guest cart
        updateGuestCartItem(productId, selectedWeight, newQuantity);
        queryClient.invalidateQueries({ queryKey: ["guest-cart-products"] });
        toast.success("Cart updated");
        return;
      }

      // Authenticated user
      const { error } = await supabase
        .from("cart_items")
        .update({ quantity: newQuantity })
        .eq("id", itemId);

      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["cart", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["cart"] });
      toast.success("Cart updated");
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const removeItem = async (itemId: string, productId: string, selectedWeight: string) => {
    try {
      if (!user) {
        // Guest cart
        removeFromGuestCart(productId, selectedWeight);
        queryClient.invalidateQueries({ queryKey: ["guest-cart-products"] });
        toast.success("Item removed");
        return;
      }

      // Authenticated user
      const { error } = await supabase
        .from("cart_items")
        .delete()
        .eq("id", itemId);

      if (error) throw error;
      toast.success("Item removed from cart");
      queryClient.invalidateQueries({ queryKey: ["cart", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["cart"] });
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleCheckout = () => {
    navigate("/checkout");
  };

  const freeShippingThreshold = 100;
  const shippingProgress = Math.min((subtotal / freeShippingThreshold) * 100, 100);
  const amountToFreeShipping = Math.max(freeShippingThreshold - subtotal, 0);

  return (
    <CustomerLayout>
      <div className="container mx-auto px-4 md:px-6 py-6 md:py-12">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-bold mb-6 md:mb-8">Shopping Cart</h1>

          {cartItems.length === 0 ? (
            <Card className="p-12">
              <div className="flex flex-col items-center justify-center text-center space-y-6">
                <div className="w-32 h-32 rounded-full bg-muted flex items-center justify-center">
                  <ShoppingBag className="w-16 h-16 text-muted-foreground" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold mb-2">Your cart is empty</h2>
                  <p className="text-muted-foreground">
                    Add some products to get started
                  </p>
                </div>
                <Button variant="hero" size="lg" onClick={() => navigate("/")}>
                  Browse Products
                </Button>
              </div>
            </Card>
          ) : (
            <div className="grid lg:grid-cols-3 gap-8">
              {/* Cart Items */}
              <div className="lg:col-span-2 space-y-4">
                {cartItems.map((item) => {
                  const itemPrice = getItemPrice(item);
                  const selectedWeight = item.selected_weight || "unit";
                  
                  return (
                    <Card key={item.id} className="p-4 md:p-6">
                      <div className="flex flex-col md:flex-row gap-4 md:gap-6">
                        <div className="w-20 h-20 md:w-24 md:h-24 bg-muted rounded-lg flex items-center justify-center flex-shrink-0">
                          {item.products?.image_url ? (
                            <img 
                              src={item.products.image_url} 
                              alt={item.products.name}
                              className="w-full h-full object-cover rounded-lg"
                            />
                          ) : (
                            <span className="text-4xl md:text-5xl">🌿</span>
                          )}
                        </div>
                        
                        <div className="flex-1 space-y-3 md:space-y-4">
                          <div>
                            <h3 className="text-base md:text-xl font-bold leading-tight">
                              {item.products?.name}
                            </h3>
                            {selectedWeight !== "unit" && (
                              <Badge variant="outline" className="mt-1.5 md:mt-2 text-sm">
                                Weight: {selectedWeight}
                              </Badge>
                            )}
                            <p className="text-base md:text-lg text-muted-foreground mt-1">
                              ${itemPrice.toFixed(2)} each
                            </p>
                          </div>
                          
                          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="icon"
                                className="min-h-[44px] min-w-[44px] h-11 w-11"
                                onClick={() =>
                                  updateQuantity(item.id, item.product_id, selectedWeight, Math.max(1, item.quantity - 1))
                                }
                                disabled={item.quantity <= 1}
                              >
                                <Minus className="w-4 h-4" />
                              </Button>
                              <span className="text-base md:text-lg font-semibold min-w-[32px] text-center">
                                {item.quantity}
                              </span>
                              <Button
                                variant="outline"
                                size="icon"
                                className="min-h-[44px] min-w-[44px] h-11 w-11"
                                onClick={() => updateQuantity(item.id, item.product_id, selectedWeight, item.quantity + 1)}
                              >
                                <Plus className="w-4 h-4" />
                              </Button>
                            </div>
                            
                            <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto justify-between sm:justify-end">
                              <p className="text-xl md:text-2xl font-bold">
                                ${(itemPrice * item.quantity).toFixed(2)}
                              </p>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="min-h-[44px] min-w-[44px] h-11 w-11"
                                onClick={() => removeItem(item.id, item.product_id, selectedWeight)}
                              >
                                <Trash2 className="w-5 h-5 text-destructive" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>

              {/* Order Summary */}
              <div className="lg:col-span-1">
                <Card className="p-4 md:p-6 lg:sticky lg:top-24 space-y-4 md:space-y-6">
                  <h2 className="text-xl md:text-2xl font-bold py-2">Order Summary</h2>
                  
                  <Separator />

                  {/* Free Shipping Progress */}
                  {subtotal < freeShippingThreshold ? (
                    <div className="space-y-3 p-4 bg-primary/5 rounded-lg">
                      <div className="flex items-center justify-between text-base">
                        <span className="flex items-center gap-2">
                          <Truck className="h-4 w-4" />
                          <span className="font-medium">Free Shipping</span>
                        </span>
                        <span className="font-semibold">
                          ${amountToFreeShipping.toFixed(2)} to go
                        </span>
                      </div>
                      <Progress value={shippingProgress} className="h-2" />
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 p-4 bg-primary/10 rounded-lg text-primary">
                      <Truck className="h-5 w-5 flex-shrink-0" />
                      <span className="font-semibold text-base">FREE SHIPPING! 🎉</span>
                    </div>
                  )}

                  {/* Coupon Input */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Have a coupon?</label>
                    <CouponInput
                      cartTotal={subtotal}
                      onCouponApplied={(discountAmount, code) => {
                        setAppliedCoupon({ code, discount: discountAmount });
                      }}
                      onCouponRemoved={() => setAppliedCoupon(null)}
                      appliedCode={appliedCoupon?.code}
                    />
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    <div className="flex justify-between text-base md:text-lg">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span className="font-semibold">${subtotal.toFixed(2)}</span>
                    </div>
                    {appliedCoupon && (
                      <div className="flex justify-between text-base md:text-lg text-primary">
                        <span className="font-medium">Discount ({appliedCoupon.code})</span>
                        <span className="font-semibold">-${discount.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-base md:text-lg">
                      <span className="text-muted-foreground">Delivery Fee</span>
                      <span className="font-semibold">
                        {subtotal >= freeShippingThreshold ? (
                          <span className="text-primary">FREE</span>
                        ) : (
                          "At checkout"
                        )}
                      </span>
                    </div>
                  </div>

                  <Separator />

                  <div className="flex justify-between text-2xl md:text-xl font-bold py-2">
                    <span>Total</span>
                    <span>${totalAfterDiscount.toFixed(2)}</span>
                  </div>

                  <Button 
                    variant="hero" 
                    className="w-full text-lg min-h-[56px] h-14 font-semibold" 
                    size="lg"
                    onClick={handleCheckout}
                  >
                    Proceed to Checkout • ${totalAfterDiscount.toFixed(2)}
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>

                  <div className="space-y-2 text-sm md:text-base text-muted-foreground text-center pt-2">
                    <p>✓ Valid ID required at delivery</p>
                    <p>✓ Must be 21+ years old</p>
                    <p>✓ Secure payment at checkout</p>
                  </div>
                </Card>
              </div>
            </div>
          )}
        </div>
      </div>
    </CustomerLayout>
  );
};

export default Cart;
