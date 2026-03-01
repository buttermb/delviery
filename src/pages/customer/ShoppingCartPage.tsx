import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { 
  ArrowLeft, 
  Minus, 
  Plus, 
  Trash2, 
  ShoppingCart,
  CreditCard,
  MessageSquare,
  ArrowRight,
  Package
} from "lucide-react";
import type { User } from "@supabase/supabase-js";
import type { RenderCartItem } from "@/types/cart";
import { useCustomerAuth } from "@/contexts/CustomerAuthContext";
import { formatCurrency } from "@/lib/utils/formatCurrency";
import { useGuestCart } from "@/hooks/useGuestCart";
import { toast } from "sonner";
import { validateRouteUUID as _validateRouteUUID } from "@/lib/utils/uuidValidation";
import { CustomerMobileNav } from "@/components/customer/CustomerMobileNav";
import { CustomerMobileBottomNav } from "@/components/customer/CustomerMobileBottomNav";
import { queryKeys } from "@/lib/queryKeys";

export default function ShoppingCartPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { tenant } = useCustomerAuth();
  const tenantId = tenant?.id;
  const { guestCart, updateGuestCartItem, removeFromGuestCart } = useGuestCart();
  const [orderNotes, setOrderNotes] = useState("");
  const [user, setUser] = useState<User | null>(null);

  // Get current user session
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });
  }, []);

  // Fetch cart items from database (authenticated users)
  const { data: dbCartItems = [], isLoading: dbLoading } = useQuery({
    queryKey: queryKeys.cart.user(user?.id, tenantId),
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
  });

  // Fetch product details for guest cart items
  const { data: guestProducts = [], isLoading: guestLoading } = useQuery({
    queryKey: queryKeys.guestCartProducts.byIds(guestCart.map(i => i.product_id).sort().join(",")),
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
    .filter((item): item is NonNullable<typeof item> => item !== null);

  const cartItems = user ? dbCartItems : guestCartItems;
  const isLoading = (user && dbLoading) || (!user && guestLoading);

  // Calculate item price
  const getItemPrice = (item: RenderCartItem) => {
    const product = item?.products;
    if (!product) return 0;
    
    const selectedWeight = item?.selected_weight || "unit";
    
    if (product?.prices && typeof product.prices === 'object') {
      const price = product.prices[selectedWeight];
      return price ? Number(price) : Number(product.price) || 0;
    }
    return Number(product.price) || 0;
  };

  // Calculate totals
  const subtotal = cartItems.reduce(
    (sum, item) => sum + getItemPrice(item) * item.quantity,
    0
  );

  const taxRate = 0.085; // 8.5% tax
  const tax = subtotal * taxRate;
  const deliveryFee = subtotal >= 1000 ? 0 : 0; // Free delivery
  const total = subtotal + tax + deliveryFee;

  // Update quantity
  const handleUpdateQuantity = (itemId: string, productId: string, selectedWeight: string, quantity: number) => {
    if (quantity <= 0) {
      handleRemoveItem(productId, selectedWeight);
      return;
    }

    if (user) {
      // Update in database
      const item = dbCartItems.find(i => i.id === itemId);
      if (item) {
        supabase
          .from("cart_items")
          .update({ quantity })
          .eq("id", itemId)
          .then(() => {
            queryClient.invalidateQueries({ queryKey: queryKeys.cart.user(user.id, tenantId) });
          });
      }
    } else {
      // Update guest cart
      updateGuestCartItem(productId, selectedWeight, quantity);
    }
  };

  // Remove item
  const handleRemoveItem = (productId: string, selectedWeight: string) => {
    if (user) {
      const item = dbCartItems.find(i => i.product_id === productId && i.selected_weight === selectedWeight);
      if (item) {
        supabase
          .from("cart_items")
          .delete()
          .eq("id", item.id)
          .then(() => {
            queryClient.invalidateQueries({ queryKey: queryKeys.cart.user(user.id, tenantId) });
            toast.success("Item removed");
          });
      }
    } else {
      removeFromGuestCart(productId, selectedWeight);
      toast.success("Item removed");
    }
  };

  // Proceed to checkout
  const handleCheckout = () => {
    if (cartItems.length === 0) {
      toast.error("Cart is empty", {
        description: "Add items to your cart before checkout",
      });
      return;
    }

    // Store order notes in sessionStorage for checkout page
    if (orderNotes) {
      sessionStorage.setItem("orderNotes", orderNotes);
    }

    navigate(`/${tenant?.slug}/shop/checkout`);
  };

  if (isLoading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-[hsl(var(--customer-bg))]">
        <p className="text-[hsl(var(--customer-text-light))]">Loading cart...</p>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-[hsl(var(--customer-bg))] pb-36 lg:pb-0">
      {/* Mobile Top Navigation */}
      <CustomerMobileNav />
      
      {/* Desktop Header */}
      <header className="hidden lg:block border-b border-[hsl(var(--customer-border))] bg-white sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              onClick={() => navigate(`/${tenant?.slug}/shop/dashboard`)}
              className="text-[hsl(var(--customer-text))] hover:bg-[hsl(var(--customer-surface))]"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Continue Shopping
            </Button>
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-[hsl(var(--customer-text))]">
                🛒 Your Cart
              </h1>
              <p className="text-sm text-[hsl(var(--customer-text-light))]">
                {cartItems.length} item{cartItems.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto p-6">
        {cartItems.length === 0 ? (
          <Card className="bg-white border-[hsl(var(--customer-border))]">
            <CardContent className="pt-12 pb-12 text-center">
              <ShoppingCart className="h-16 w-16 mx-auto text-[hsl(var(--customer-text-light))] mb-4 opacity-50" />
              <h3 className="text-xl font-semibold text-[hsl(var(--customer-text))] mb-2">
                Your cart is empty
              </h3>
              <p className="text-[hsl(var(--customer-text-light))] mb-6">
                Add items to your cart to get started
              </p>
              <Button
                onClick={() => navigate(`/${tenant?.slug}/shop/dashboard`)}
                className="bg-gradient-to-r from-[hsl(var(--customer-primary))] to-[hsl(var(--customer-secondary))] hover:opacity-90 text-white"
              >
                Browse Menus
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* LEFT: Cart Items */}
            <div className="lg:col-span-2 space-y-4">
              {/* Cart Items List */}
              {(cartItems as RenderCartItem[]).map((item) => {
                const product = item.products;
                const price = getItemPrice(item);
                const selectedWeight = item.selected_weight || "unit";

                return (
                  <Card 
                    key={item.id || `${item.product_id}-${selectedWeight}`}
                    className="bg-white border-[hsl(var(--customer-border))]"
                  >
                    <CardContent className="p-6">
                      <div className="flex gap-4">
                        {/* Product Image */}
                        {product?.image_url ? (
                          <div className="w-24 h-24 rounded-lg overflow-hidden bg-[hsl(var(--customer-surface))] flex-shrink-0">
                            <img
                              src={product.image_url}
                              alt={product.name}
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                          </div>
                        ) : (
                          <div className="w-24 h-24 rounded-lg bg-[hsl(var(--customer-surface))] flex items-center justify-center flex-shrink-0">
                            <Package className="h-8 w-8 text-[hsl(var(--customer-text-light))]" />
                          </div>
                        )}

                        {/* Product Details */}
                        <div className="flex-1">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <h3 className="font-semibold text-lg text-[hsl(var(--customer-text))]">
                                {product?.name || "Unknown Product"}
                              </h3>
                              {product?.category && (
                                <p className="text-sm text-[hsl(var(--customer-text-light))]">
                                  {product.category}
                                </p>
                              )}
                              {selectedWeight !== "unit" && (
                                <Badge variant="outline" className="mt-1">
                                  {selectedWeight}
                                </Badge>
                              )}
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRemoveItem(item.product_id || (item as unknown as Record<string, unknown>).productId as string, selectedWeight)}
                              className="text-[hsl(var(--customer-text-light))] hover:text-[hsl(var(--customer-accent))]"
                              aria-label="Remove item"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>

                          <div className="flex items-center justify-between mt-4">
                            {/* Quantity Controls */}
                            <div className="flex items-center gap-3">
                              <div className="flex items-center gap-2 border border-[hsl(var(--customer-border))] rounded-lg px-2 py-1">
                                <button
                                  onClick={() => handleUpdateQuantity(
                                    item.id,
                                    item.product_id || (item as unknown as Record<string, unknown>).productId as string,
                                    selectedWeight,
                                    item.quantity - 1
                                  )}
                                  className="p-1 hover:bg-[hsl(var(--customer-surface))] rounded transition-colors"
                                  disabled={item.quantity <= 1}
                                >
                                  <Minus className="h-4 w-4" />
                                </button>
                                <span className="w-8 text-center font-medium text-[hsl(var(--customer-text))]">
                                  {item.quantity}
                                </span>
                                <button
                                  onClick={() => handleUpdateQuantity(
                                    item.id,
                                    item.product_id || (item as unknown as Record<string, unknown>).productId as string,
                                    selectedWeight,
                                    item.quantity + 1
                                  )}
                                  className="p-1 hover:bg-[hsl(var(--customer-surface))] rounded transition-colors"
                                >
                                  <Plus className="h-4 w-4" />
                                </button>
                              </div>
                            </div>

                            {/* Price */}
                            <div className="text-right">
                              <p className="text-2xl font-bold text-[hsl(var(--customer-primary))]">
                                {formatCurrency(price * item.quantity)}
                              </p>
                              {item.quantity > 1 && (
                                <p className="text-xs text-[hsl(var(--customer-text-light))]">
                                  {formatCurrency(price)} each
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}

              {/* Order Notes Section */}
              <Card className="bg-white border-[hsl(var(--customer-border))]">
                <CardHeader>
                  <CardTitle className="text-[hsl(var(--customer-text))] flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" />
                    💬 Order Notes (Optional)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Input
                    placeholder="Please deliver to back entrance..."
                    value={orderNotes}
                    onChange={(e) => setOrderNotes(e.target.value)}
                    className="border-[hsl(var(--customer-border))] focus-visible:border-[hsl(var(--customer-primary))] focus-visible:ring-[hsl(var(--customer-primary))]/20"
                    aria-label="Order notes"
                  />
                </CardContent>
              </Card>
            </div>

            {/* RIGHT: Order Summary */}
            <div className="lg:col-span-1">
              <Card className="bg-white border-[hsl(var(--customer-border))] sticky top-24">
                <CardHeader>
                  <CardTitle className="text-[hsl(var(--customer-text))]">ORDER SUMMARY</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex justify-between text-[hsl(var(--customer-text))]">
                      <span>Subtotal:</span>
                      <span className="font-medium">{formatCurrency(subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-[hsl(var(--customer-text))]">
                      <span>Tax (8.5%):</span>
                      <span className="font-medium">{formatCurrency(tax)}</span>
                    </div>
                    <div className="flex justify-between text-[hsl(var(--customer-text))]">
                      <span>Delivery:</span>
                      <span className="font-medium text-[hsl(var(--customer-secondary))]">
                        {deliveryFee === 0 ? "FREE" : formatCurrency(deliveryFee)}
                      </span>
                    </div>
                    <Separator />
                    <div className="flex justify-between text-lg font-bold text-[hsl(var(--customer-text))]">
                      <span>TOTAL:</span>
                      <span className="text-[hsl(var(--customer-primary))]">
                        {formatCurrency(total)}
                      </span>
                    </div>
                  </div>

                  <Button
                    onClick={handleCheckout}
                    className="w-full bg-gradient-to-r from-[hsl(var(--customer-primary))] to-[hsl(var(--customer-secondary))] hover:opacity-90 text-white"
                    size="lg"
                  >
                    Proceed to Checkout
                    <ArrowRight className="h-5 w-5 ml-2" />
                  </Button>

                  <div className="pt-4 border-t border-[hsl(var(--customer-border))]">
                    <p className="text-xs text-[hsl(var(--customer-text-light))] text-center mb-2">
                      We Accept:
                    </p>
                    <div className="flex justify-center gap-2 text-2xl">
                      <CreditCard className="h-6 w-6" />
                      <span>💰</span>
                      <span>📱</span>
                    </div>
                    <p className="text-xs text-[hsl(var(--customer-text-light))] text-center mt-2">
                      🔒 Secure Checkout
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>

      {/* Sticky Mobile Checkout Bar */}
      {cartItems.length > 0 && (
        <div className="fixed bottom-16 left-0 right-0 lg:hidden z-40">
          <div className="bg-white border-t border-[hsl(var(--customer-border))] shadow-lg p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs text-[hsl(var(--customer-text-light))]">
                  {cartItems.length} item{cartItems.length !== 1 ? 's' : ''}
                </p>
                <p className="text-lg font-bold text-[hsl(var(--customer-primary))]">
                  {formatCurrency(total)}
                </p>
              </div>
              <Button
                onClick={handleCheckout}
                className="bg-gradient-to-r from-[hsl(var(--customer-primary))] to-[hsl(var(--customer-secondary))] hover:opacity-90 text-white flex-shrink-0"
                size="lg"
              >
                Checkout
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Bottom Navigation */}
      <CustomerMobileBottomNav />
    </div>
  );
}

