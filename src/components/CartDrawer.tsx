import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Minus, Plus, Trash2, ShoppingBag, Truck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useGuestCart } from "@/hooks/useGuestCart";
import { SwipeableCartItem } from "@/components/SwipeableCartItem";
import { haptics } from "@/utils/haptics";

interface CartDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CartDrawer = ({ open, onOpenChange }: CartDrawerProps) => {
  const [user, setUser] = useState<any>(null);
  const { guestCart, updateGuestCartItem, removeFromGuestCart } = useGuestCart();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });
  }, []);

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
    queryKey: ["guest-cart-products", guestCart.map(i => i.product_id).sort().join(",")],
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

  // Combine guest cart items with product data (only items with valid products)
  const guestCartItems = user ? [] : guestCart
    .map(item => {
      const product = guestProducts.find(p => p.id === item.product_id);
      if (!product) return null;
      return {
        ...item,
        id: `${item.product_id}-${item.selected_weight}`,
        products: product
      };
    })
    .filter(item => item !== null) as any[];

  const cartItems = user ? dbCartItems : guestCartItems;
  
  // Show loading state when products are still loading
  const isLoading = !user && guestCart.length > 0 && guestCartItems.length === 0 && guestProducts.length === 0;

  const getItemPrice = (item: any) => {
    const product = item?.products;
    if (!product) return 0;
    
    const selectedWeight = item?.selected_weight || "unit";
    
    if (product?.prices && typeof product.prices === 'object') {
      const price = product.prices[selectedWeight];
      return price ? Number(price) : Number(product.price) || 0;
    }
    return Number(product.price) || 0;
  };

  const subtotal = cartItems.reduce(
    (sum, item) => sum + getItemPrice(item) * item.quantity,
    0
  );

  const updateQuantity = async (itemId: string, productId: string, selectedWeight: string, newQuantity: number) => {
    if (!user) {
      // Guest cart - update localStorage
      updateGuestCartItem(productId, selectedWeight, newQuantity);
      queryClient.invalidateQueries({ queryKey: ["guest-cart-products"] });
      return;
    }

    // Authenticated user - update database
    try {
      const { error } = await supabase
        .from("cart_items")
        .update({ quantity: newQuantity })
        .eq("id", itemId);

      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["cart", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["cart"] });
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const removeItem = async (itemId: string, productId: string, selectedWeight: string) => {
    haptics.medium(); // Haptic feedback for delete
    
    if (!user) {
      // Guest cart - remove from localStorage
      removeFromGuestCart(productId, selectedWeight);
      toast.success("Item removed from cart");
      queryClient.invalidateQueries({ queryKey: ["guest-cart-products"] });
      return;
    }

    // Authenticated user - remove from database
    try {
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
      haptics.error();
    }
  };

  const handleCheckout = () => {
    haptics.medium(); // Haptic feedback
    onOpenChange(false);
    navigate("/cart");
  };

  const handleViewCart = () => {
    haptics.light(); // Light tap feedback
    onOpenChange(false);
    navigate("/cart");
  };

  const freeShippingThreshold = 100;
  const shippingProgress = Math.min((subtotal / freeShippingThreshold) * 100, 100);
  const amountToFreeShipping = Math.max(freeShippingThreshold - subtotal, 0);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg flex flex-col">
        <SheetHeader>
          <SheetTitle className="text-xl md:text-2xl">Shopping Cart</SheetTitle>
        </SheetHeader>

        {cartItems.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4 px-4">
            <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center">
              <ShoppingBag className="w-12 h-12 text-muted-foreground" />
            </div>
            <div>
              <h3 className="font-semibold text-base md:text-lg mb-2">Your cart is empty</h3>
              <p className="text-muted-foreground text-sm md:text-base">
                Add some products to get started
              </p>
            </div>
            <Button variant="hero" className="min-h-[44px]" onClick={() => onOpenChange(false)}>
              Browse Products
            </Button>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto space-y-4 py-4 px-1">
              {cartItems.map((item) => {
                const itemPrice = getItemPrice(item);
                const selectedWeight = item.selected_weight || "unit";
                
                return (
                  <SwipeableCartItem
                    key={item.id}
                    onDelete={() => removeItem(item.id, item.product_id, selectedWeight)}
                  >
                    <div className="flex gap-3 p-2">
                      <div className="w-20 h-20 bg-muted rounded-lg flex items-center justify-center flex-shrink-0">
                        {item.products?.image_url ? (
                          <img 
                            src={item.products.image_url} 
                            alt={item.products.name}
                            className="w-full h-full object-cover rounded-lg"
                          />
                        ) : (
                          <span className="text-3xl">🌿</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-base leading-tight line-clamp-2">
                          {item.products?.name}
                        </h4>
                        {selectedWeight !== "unit" && (
                          <p className="text-sm text-muted-foreground mt-0.5">
                            Weight: {selectedWeight}
                          </p>
                        )}
                        <p className="text-base text-muted-foreground mt-0.5">
                          ${itemPrice.toFixed(2)} each
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <Button
                            variant="outline"
                            size="icon"
                            className="min-h-[44px] min-w-[44px] h-11 w-11"
                            onClick={() => {
                              haptics.light();
                              updateQuantity(item.id, item.product_id, selectedWeight, Math.max(1, item.quantity - 1));
                            }}
                            disabled={item.quantity <= 1}
                          >
                            <Minus className="w-4 h-4" />
                          </Button>
                          <span className="text-base font-medium min-w-[32px] text-center">
                            {item.quantity}
                          </span>
                          <Button
                            variant="outline"
                            size="icon"
                            className="min-h-[44px] min-w-[44px] h-11 w-11"
                            onClick={() => {
                              haptics.light();
                              updateQuantity(item.id, item.product_id, selectedWeight, item.quantity + 1);
                            }}
                          >
                            <Plus className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="font-semibold text-lg">
                          ${(itemPrice * item.quantity).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </SwipeableCartItem>
                );
              })}
            </div>

            <div className="space-y-4 border-t pt-4 px-1">
              {/* Free Shipping Progress */}
              {subtotal < freeShippingThreshold ? (
                <div className="space-y-2 p-4 bg-primary/5 rounded-lg">
                  <div className="flex items-center justify-between text-base">
                    <span className="flex items-center gap-2 font-medium">
                      <Truck className="h-4 w-4 flex-shrink-0" />
                      <span className="text-sm md:text-base">Free Shipping</span>
                    </span>
                    <span className="font-semibold text-sm md:text-base">${amountToFreeShipping.toFixed(2)} to go</span>
                  </div>
                  <Progress value={shippingProgress} className="h-2" />
                </div>
              ) : (
                <div className="flex items-center gap-2 p-4 bg-primary/10 rounded-lg text-primary">
                  <Truck className="h-5 w-5 flex-shrink-0" />
                  <span className="font-semibold text-base">FREE SHIPPING! 🎉</span>
                </div>
              )}

              <div className="flex justify-between text-lg md:text-xl font-semibold">
                <span>Subtotal</span>
                <span>${subtotal.toFixed(2)}</span>
              </div>
              <p className="text-sm md:text-base text-muted-foreground">
                Delivery fees calculated at checkout
              </p>
              <div className="grid grid-cols-2 gap-3">
                <Button 
                  variant="outline" 
                  className="w-full min-h-[48px] text-base font-medium" 
                  size="lg"
                  onClick={handleViewCart}
                >
                  View Cart
                </Button>
                <Button 
                  variant="hero" 
                  className="w-full min-h-[48px] text-base font-medium" 
                  size="lg"
                  onClick={handleCheckout}
                >
                  Checkout
                </Button>
              </div>
              <p className="text-sm text-center text-muted-foreground pt-1">
                Valid ID required at delivery • Must be 21+
              </p>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default CartDrawer;
