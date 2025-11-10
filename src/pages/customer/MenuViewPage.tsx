import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ArrowLeft, ShoppingCart, Lock, Plus, Minus, Search, Filter, Package } from "lucide-react";
import { useCustomerAuth } from "@/contexts/CustomerAuthContext";
import { formatCurrency } from "@/lib/utils/formatCurrency";
import { toast } from "@/hooks/use-toast";
import { validateRouteUUID } from "@/lib/utils/uuidValidation";
import { CustomerMobileNav } from "@/components/customer/CustomerMobileNav";
import { CustomerMobileBottomNav } from "@/components/customer/CustomerMobileBottomNav";
import { useGuestCart } from "@/hooks/useGuestCart";

export default function CustomerMenuViewPage() {
  const { menuId: menuIdParam } = useParams<{ menuId: string }>();
  const menuId = validateRouteUUID(menuIdParam);
  const navigate = useNavigate();
  const { customer, tenant } = useCustomerAuth();
  const tenantId = tenant?.id;
  const customerId = customer?.customer_id || customer?.id;
  const [searchTerm, setSearchTerm] = useState("");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const { addToGuestCart } = useGuestCart();
  const queryClient = useQueryClient();
  const [user, setUser] = useState<any>(null);

  // Get current user session
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });
  }, []);

  // Fetch menu details
  const { data: menu, isLoading: menuLoading } = useQuery({
    queryKey: ["customer-menu", menuId, tenantId, customerId],
    queryFn: async (): Promise<any> => {
      if (!menuId || !tenantId || !customerId) return null;

      // Verify customer has access
      const { data: access } = await (supabase
        .from("menu_access") as any)
        .select("*")
        .eq("menu_id", menuId as string)
        .eq("customer_id", customerId)
        .eq("tenant_id", tenantId)
        .maybeSingle();

      if (!access) {
        throw new Error("You don't have access to this menu");
      }

      // Check if expired
      if (access.expires_at && new Date(access.expires_at) < new Date()) {
        throw new Error("Menu access has expired");
      }

      // Fetch menu
      const { data, error } = await supabase
        .from("menus")
        .select("*")
        .eq("id", menuId as string)
        .eq("tenant_id", tenantId)
        .eq("is_active", true)
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error("Menu not found");

      return {
        ...data,
        access_code: access.access_code,
        expires_at: access.expires_at,
      };
    },
    enabled: !!menuId && !!tenantId && !!customerId,
  });

  // Fetch menu products
  const { data: products } = useQuery({
    queryKey: ["customer-menu-products", menuId, tenantId],
    queryFn: async () => {
      if (!menuId || !tenantId) return [];

      const { data, error } = await supabase
        .from("menu_products")
        .select(`
          *,
          products (
            id,
            name,
            description,
            price,
            unit,
            image_url,
            category,
            stock_quantity
          )
        `)
        .eq("menu_id", menuId as string);

      if (error) throw error;
      return data || [];
    },
    enabled: !!menuId && !!tenantId,
  });

  const updateQuantity = (productId: string, change: number) => {
    setQuantities((prev) => {
      const current = prev[productId] || 0;
      const newQuantity = Math.max(0, current + change);
      if (newQuantity === 0) {
        const { [productId]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [productId]: newQuantity };
    });
  };

  // Memoize total items calculation
  const getTotalItems = useMemo(() => {
    return Object.values(quantities).reduce((sum, qty) => sum + qty, 0);
  }, [quantities]);

  // Memoize cart total calculation
  const calculateCartTotal = useMemo(() => {
    if (!products || !Array.isArray(products)) return 0;
    
    let total = 0;
    Object.entries(quantities).forEach(([productId, quantity]) => {
      const menuProduct: any = products.find((mp: any) => mp.products?.id === productId);
      if (menuProduct?.products?.price) {
        const price = Number(menuProduct.products.price) || 0;
        total += price * quantity;
      }
    });
    
    return total;
  }, [products, quantities]);

  // Memoize filtered products
  const filteredProducts = useMemo(() => {
    if (!products) return [];
    if (!searchTerm) return products;
    
    const searchLower = searchTerm.toLowerCase();
    return products.filter((item: any) => {
      const product = item.products;
      if (!product) return false;
      return product.name.toLowerCase().includes(searchLower) ||
             product.description?.toLowerCase().includes(searchLower);
    });
  }, [products, searchTerm]);

  if (menuLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[hsl(var(--customer-bg))]">
        <p className="text-[hsl(var(--customer-text-light))]">Loading menu...</p>
      </div>
    );
  }

  if (!menu) {
      return (
        <div className="min-h-screen bg-[hsl(var(--customer-bg))] pb-16 lg:pb-0">
          {/* Mobile Top Navigation */}
          <CustomerMobileNav />
          
          <div className="container mx-auto p-6">
            <Card className="bg-white border-[hsl(var(--customer-border))]">
              <CardContent className="pt-6">
                <p className="text-center text-[hsl(var(--customer-text-light))] mb-4">Menu not found or access denied</p>
              <Button
                variant="outline"
                className="w-full border-[hsl(var(--customer-border))] text-[hsl(var(--customer-primary))] hover:bg-[hsl(var(--customer-surface))]"
                onClick={() => navigate(`/${tenant?.slug}/shop/dashboard`)}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Button>
            </CardContent>
          </Card>
          </div>

          {/* Mobile Bottom Navigation */}
          <CustomerMobileBottomNav />
        </div>
    );
  }

  const requiresAccessCode = !!menu.access_code;

  return (
    <div className="min-h-screen bg-[hsl(var(--customer-bg))] pb-16 lg:pb-0">
      {/* Mobile Top Navigation */}
      <CustomerMobileNav />
      
      {/* Desktop Header */}
      <header className="hidden lg:block border-b border-[hsl(var(--customer-border))] bg-white sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <Button
              variant="ghost"
              onClick={() => navigate(`/${tenant?.slug}/shop/dashboard`)}
              className="text-[hsl(var(--customer-text))] hover:bg-[hsl(var(--customer-surface))]"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            {requiresAccessCode && (
              <Badge variant="outline" className="gap-1 border-[hsl(var(--customer-primary))]/30 text-[hsl(var(--customer-primary))]">
                <Lock className="h-3 w-3" />
                Access Code Required
              </Badge>
            )}
          </div>
          <h1 className="text-3xl font-bold text-[hsl(var(--customer-text))]">{menu.name}</h1>
          {menu.description && (
            <p className="text-[hsl(var(--customer-text-light))] mt-2">{menu.description}</p>
          )}
        </div>
      </header>

      <div className="container mx-auto p-6 space-y-6">
        {/* Search and Filter */}
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-[hsl(var(--customer-text-light))]" />
            <Input
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 border-[hsl(var(--customer-border))] focus:border-[hsl(var(--customer-primary))] focus:ring-[hsl(var(--customer-primary))]/20"
            />
          </div>
        </div>

        {/* Products Grid */}
        {filteredProducts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProducts.map((item: any) => {
              const product = item.products;
              if (!product) return null;

              const quantity = quantities[product.id] || 0;
              const isInStock = (product.stock_quantity === null || product.stock_quantity > 0);

              return (
                <Card 
                  key={item.id} 
                  className="bg-white border-[hsl(var(--customer-border))] hover:shadow-xl transition-all duration-300 overflow-hidden group hover:scale-[1.02] hover:border-[hsl(var(--customer-primary))]/30"
                >
                  {product.image_url ? (
                    <div className="relative aspect-square overflow-hidden bg-[hsl(var(--customer-surface))]">
                      <img
                        src={product.image_url}
                        alt={product.name}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                      />
                      {product.category && (
                        <Badge className="absolute top-3 right-3 bg-white/95 text-[hsl(var(--customer-primary))] border-0 shadow-md backdrop-blur-sm">
                          {product.category}
                        </Badge>
                      )}
                      {!isInStock && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                          <Badge variant="outline" className="bg-red-500 text-white border-0 text-sm px-3 py-1">
                            Out of Stock
                          </Badge>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="relative aspect-square bg-gradient-to-br from-[hsl(var(--customer-surface))] to-[hsl(var(--customer-surface))]/50 flex items-center justify-center">
                      <Package className="h-16 w-16 text-[hsl(var(--customer-text-light))]" />
                      {!isInStock && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                          <Badge variant="outline" className="bg-red-500 text-white border-0">
                            Out of Stock
                          </Badge>
                        </div>
                      )}
                    </div>
                  )}
                  <CardContent className="p-5">
                    <div className="mb-3">
                      <h3 className="font-bold text-xl mb-2 text-[hsl(var(--customer-text))] group-hover:text-[hsl(var(--customer-primary))] transition-colors">
                        {product.name}
                      </h3>
                      {product.description && (
                        <p className="text-sm text-[hsl(var(--customer-text-light))] mb-3 line-clamp-2 leading-relaxed">
                          {product.description}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <p className="text-3xl font-bold text-[hsl(var(--customer-primary))]">
                          {formatCurrency(product.price || 0)}
                        </p>
                        {product.unit && (
                          <p className="text-xs text-[hsl(var(--customer-text-light))] mt-1">per {product.unit}</p>
                        )}
                      </div>
                      {isInStock && product.stock_quantity !== null && product.stock_quantity < 10 && (
                        <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                          ⚠️ Low stock
                        </Badge>
                      )}
                    </div>

                    {/* Quantity Controls */}
                    {isInStock && (
                      <div className="flex items-center gap-3">
                        {quantity > 0 ? (
                          <>
                            <div className="flex items-center gap-2 border border-[hsl(var(--customer-border))] rounded-lg px-2 py-1">
                              <button
                                onClick={() => updateQuantity(product.id, -1)}
                                className="p-1 hover:bg-[hsl(var(--customer-surface))] rounded transition-colors"
                              >
                                <Minus className="h-4 w-4" />
                              </button>
                              <span className="w-8 text-center font-medium text-[hsl(var(--customer-text))]">{quantity}</span>
                              <button
                                onClick={() => updateQuantity(product.id, 1)}
                                className="p-1 hover:bg-[hsl(var(--customer-surface))] rounded transition-colors"
                              >
                                <Plus className="h-4 w-4" />
                              </button>
                            </div>
                            <Button
                              size="sm"
                              onClick={async () => {
                                try {
                                  const selectedWeight = "unit"; // Default weight, can be enhanced later
                                  
                                  if (user) {
                                    // Add to database cart for authenticated users
                                    const { error } = await supabase
                                      .from("cart_items")
                                      .upsert({
                                        user_id: user.id,
                                        product_id: product.id,
                                        quantity: quantity,
                                        selected_weight: selectedWeight,
                                      }, {
                                        onConflict: "user_id,product_id,selected_weight"
                                      });
                                    
                                    if (error) throw error;
                                    
                                    // Refresh cart query
                                    queryClient.invalidateQueries({ queryKey: ["cart", user.id] });
                                  } else {
                                    // Add to guest cart
                                    addToGuestCart(product.id, quantity, selectedWeight);
                                  }
                                  
                                  toast({
                                    title: "Added to cart",
                                    description: `${quantity}x ${product.name} added to your cart`,
                                  });
                                  
                                  // Clear quantity for this product
                                  setQuantities(prev => {
                                    const { [product.id]: _, ...rest } = prev;
                                    return rest;
                                  });
                                } catch (error: any) {
                                  toast({
                                    title: "Error",
                                    description: error.message || "Failed to add item to cart",
                                    variant: "destructive",
                                  });
                                }
                              }}
                              className="flex-1 bg-gradient-to-r from-[hsl(var(--customer-primary))] to-[hsl(var(--customer-secondary))] hover:opacity-90 text-white"
                            >
                              <ShoppingCart className="h-4 w-4 mr-2" />
                              Add to Cart
                            </Button>
                          </>
                        ) : (
                          <Button
                            size="sm"
                            onClick={async () => {
                              try {
                                const selectedWeight = "unit";
                                const quantity = 1;
                                
                                if (user) {
                                  const { error } = await supabase
                                    .from("cart_items")
                                    .upsert({
                                      user_id: user.id,
                                      product_id: product.id,
                                      quantity: quantity,
                                      selected_weight: selectedWeight,
                                    }, {
                                      onConflict: "user_id,product_id,selected_weight"
                                    });
                                  
                                  if (error) throw error;
                                  queryClient.invalidateQueries({ queryKey: ["cart", user.id] });
                                } else {
                                  addToGuestCart(product.id, quantity, selectedWeight);
                                }
                                
                                toast({
                                  title: "Added to cart",
                                  description: `${product.name} added to your cart`,
                                });
                              } catch (error: any) {
                                toast({
                                  title: "Error",
                                  description: error.message || "Failed to add item to cart",
                                  variant: "destructive",
                                });
                              }
                            }}
                            className="w-full bg-gradient-to-r from-[hsl(var(--customer-primary))] to-[hsl(var(--customer-secondary))] hover:opacity-90 text-white"
                          >
                            <ShoppingCart className="h-4 w-4 mr-2" />
                            Add to Cart
                          </Button>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-[hsl(var(--customer-surface))] mb-4">
              <Search className="h-10 w-10 text-[hsl(var(--customer-text-light))]" />
            </div>
            <p className="text-lg font-medium text-[hsl(var(--customer-text))] mb-2">No products found</p>
            <p className="text-sm text-[hsl(var(--customer-text-light))]">
              {searchTerm ? "Try adjusting your search" : "No products available in this menu"}
            </p>
          </div>
        )}

        {/* Sticky Cart Footer */}
        {getTotalItems > 0 && (
          <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[hsl(var(--customer-border))] shadow-lg p-4 z-50">
            <div className="container mx-auto flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <ShoppingCart className="h-6 w-6 text-[hsl(var(--customer-primary))]" />
                  {getTotalItems > 0 && (
                    <Badge className="absolute -top-2 -right-2 bg-[hsl(var(--customer-accent))] text-white border-0 min-w-[20px] h-5 flex items-center justify-center">
                      {getTotalItems}
                    </Badge>
                  )}
                </div>
                <div>
                  <p className="text-sm text-[hsl(var(--customer-text-light))]">{getTotalItems} item{getTotalItems !== 1 ? 's' : ''} in cart</p>
                  <p className="text-lg font-bold text-[hsl(var(--customer-text))]">
                    {formatCurrency(calculateCartTotal)}
                  </p>
                </div>
              </div>
              <Button
                size="lg"
                onClick={() => navigate(`/${tenant?.slug}/shop/cart`)}
                className="bg-gradient-to-r from-[hsl(var(--customer-primary))] to-[hsl(var(--customer-secondary))] hover:opacity-90 text-white px-8"
              >
                View Cart & Checkout
                <ArrowLeft className="h-5 w-5 ml-2 rotate-180" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Mobile Bottom Navigation */}
      <CustomerMobileBottomNav />
    </div>
  );
}
