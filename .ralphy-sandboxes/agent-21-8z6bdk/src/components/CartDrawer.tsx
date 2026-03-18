import { useState, useEffect, useMemo, useCallback } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Minus, Plus, ShoppingBag, Truck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useGuestCart } from "@/hooks/useGuestCart";
import { SwipeableCartItem } from "@/components/SwipeableCartItem";
import { haptics } from "@/utils/haptics";
import { logger } from "@/lib/logger";
import { humanizeError } from "@/lib/humanizeError";
import { useTenant } from "@/contexts/TenantContext";
import { queryKeys } from "@/lib/queryKeys";
import type { AppUser } from "@/types/auth";
import type { Product } from "@/types/product";
import type { DbCartItem, GuestCartItemWithProduct, RenderCartItem } from "@/types/cart";

interface CartDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CartDrawer = ({ open, onOpenChange }: CartDrawerProps) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const { guestCart, updateGuestCartItem, removeFromGuestCart } = useGuestCart();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { tenant } = useTenant();
  const tenantId = tenant?.id;

  useEffect(() => {
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        setUser(session?.user ?? null);
      })
      .catch((error: unknown) => {
        logger.error("Failed to get auth session in CartDrawer", error);
      });
  }, []);

  const { data: dbCartItems = [] } = useQuery<DbCartItem[]>({
    queryKey: queryKeys.cart.user(user?.id, tenantId),
    queryFn: async () => {
      if (!user || !tenantId) return [];
      const { data, error } = await supabase
        .from("cart_items")
        .select("*, products(*)")
        .eq("user_id", user.id)
        .eq("tenant_id", tenantId);
      if (error) throw error;
      return (data ?? []) as DbCartItem[];
    },
    enabled: !!user && !!tenantId,
    staleTime: Infinity,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });

  // Memoize product IDs to prevent unnecessary query key changes
  const guestProductIds = useMemo(() => 
    guestCart.map(i => i.product_id).sort().join(","),
    [guestCart]
  );

  // Fetch product details for guest cart items
  const { data: guestProducts = [] } = useQuery<Product[]>({
    queryKey: queryKeys.guestCartProducts.byIds(guestProductIds),
    queryFn: async () => {
      if (guestCart.length === 0) return [];
      const productIds = guestCart.map(item => item.product_id);
      const { data, error } = await supabase
        .from("products")
        .select('id, name, price, image_url, category, in_stock, prices, description')
        .in("id", productIds);
      if (error) throw error;
      return data as Product[];
    },
    enabled: !user && guestCart.length > 0,
    staleTime: Infinity,
  });

  // Memoize guest cart items to prevent recalculation (optimized: single pass with reduce)
  const guestCartItems: GuestCartItemWithProduct[] = useMemo(() => {
    if (user) return [];
    
    // Single pass optimization: combine map and filter into reduce
    return guestCart.reduce<GuestCartItemWithProduct[]>((acc, item) => {
      const product = guestProducts.find(p => p.id === item.product_id);
      if (product) {
        acc.push({
          ...item,
          id: `${item.product_id}-${item.selected_weight ?? "unit"}`,
          products: product
        });
      }
      return acc;
    }, []);
  }, [user, guestCart, guestProducts]);
  
  const cartItems: RenderCartItem[] = user ? dbCartItems : guestCartItems;

  // Memoize price calculation function
  const getItemPrice = useCallback((item: RenderCartItem) => {
    const product = item.products;
    if (!product) return 0;
    
    const selectedWeight = item.selected_weight ?? "unit";
    
    const value = product.prices?.[selectedWeight] ?? product.price;
    const asNumber = typeof value === "string" ? parseFloat(value) : value ?? 0;
    return Number.isFinite(asNumber) ? Number(asNumber) : 0;
  }, []);

  // Memoize subtotal calculation
  const subtotal = useMemo(() => 
    cartItems.reduce(
      (sum, item) => sum + getItemPrice(item) * item.quantity,
      0
    ),
    [cartItems, getItemPrice]
  );

  const updateQuantity = async (itemId: string, productId: string, selectedWeight: string, newQuantity: number) => {
    if (!user) {
      // Guest cart - update localStorage
      updateGuestCartItem(productId, selectedWeight, newQuantity);
      queryClient.invalidateQueries({ queryKey: queryKeys.guestCartProducts.all });
      return;
    }

    // Authenticated user - update database
    try {
      const { error } = await supabase
        .from("cart_items")
        .update({ quantity: newQuantity })
        .eq("id", itemId);

      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: queryKeys.cart.user(user?.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.cart.all });
    } catch (error: unknown) {
      toast.error(humanizeError(error, "Failed to update quantity"));
    }
  };

  const removeItem = async (itemId: string, productId: string, selectedWeight: string) => {
    haptics.medium(); // Haptic feedback for delete
    
    if (!user) {
      // Guest cart - remove from localStorage
      removeFromGuestCart(productId, selectedWeight);
      toast.success("Item removed from cart");
      queryClient.invalidateQueries({ queryKey: queryKeys.guestCartProducts.all });
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
      queryClient.invalidateQueries({ queryKey: queryKeys.cart.user(user?.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.cart.all });
    } catch (error: unknown) {
      toast.error(humanizeError(error, "Failed to remove item"));
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
      <SheetContent className="w-full sm:max-w-lg flex flex-col safe-area-bottom">
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
                            loading="lazy"
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
                            aria-label="Decrease quantity"
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
                            aria-label="Increase quantity"
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
