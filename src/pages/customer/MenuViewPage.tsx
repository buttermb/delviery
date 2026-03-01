import { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ArrowLeft, ShoppingCart, Search, Loader2, Star } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { useCustomerAuth } from "@/contexts/CustomerAuthContext";
import { formatCurrency } from "@/lib/utils/formatCurrency";
import { toast } from "sonner";
import { validateRouteUUID } from "@/lib/utils/uuidValidation";
import { CustomerMobileNav } from "@/components/customer/CustomerMobileNav";
import { CustomerMobileBottomNav } from "@/components/customer/CustomerMobileBottomNav";
import { useGuestCart } from "@/hooks/useGuestCart";
import { MenuProductGrid } from "@/components/customer/MenuProductGrid";
import { SmartSearchOverlay } from "@/components/customer/SmartSearchOverlay";
import { useMenuInventorySync } from "@/hooks/useMenuInventorySync";
import { logger } from "@/lib/logger";
import { queryKeys } from "@/lib/queryKeys";

export default function CustomerMenuViewPage() {
  const { menuId: menuIdParam } = useParams<{ menuId: string }>();
  const menuId = validateRouteUUID(menuIdParam);
  const navigate = useNavigate();
  const { customer, tenant } = useCustomerAuth();
  const tenantId = tenant?.id;
  const customerId = customer?.customer_id || customer?.id;
  const [searchTerm, setSearchTerm] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const { addToGuestCart } = useGuestCart();
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);

  // Get current user session
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });
  }, []);

  // Fetch menu details
  const { data: menu, isLoading: menuLoading } = useQuery({
    queryKey: queryKeys.customerMenu.detail(menuId || undefined, tenantId, customerId),
    queryFn: async () => {
      if (!menuId || !tenantId || !customerId) return null;

      // Verify customer has access
      const { data: access } = await supabase
        .from("menu_access")
        .select('id, expires_at, access_code, menu_id, customer_id, tenant_id')
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
        .select('id, name, description, image_url, is_active, tenant_id')
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
    queryKey: queryKeys.customerMenu.products(menuId || undefined, tenantId),
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
      return data ?? [];
    },
    enabled: !!menuId && !!tenantId,
  });

  // Memoize total items calculation (using guest cart hook or local state if needed, but here we rely on cart query for auth user)
  // For simplicity in this refactor, we'll fetch the cart count separately or use the hook
  // But to keep it consistent with previous code, let's just use a simple query for cart items if user is logged in
  const { data: cartItems } = useQuery({
    queryKey: queryKeys.cart.user(user?.id, tenantId),
    queryFn: async () => {
      if (!user?.id) return [];
      const { data } = await supabase
        .from("cart_items")
        .select("quantity, products(price)")
        .eq("user_id", user.id);
      return data ?? [];
    },
    enabled: !!user?.id
  });

  // Calculate totals
  const totalItems = user
    ? cartItems?.reduce((sum, item) => sum + item.quantity, 0) ?? 0
    : 0; // Guest cart logic would go here if we fully integrated useGuestCart for totals

  const cartTotal = user
    ? cartItems?.reduce((sum, item) => sum + (item.quantity * (item.products?.price ?? 0)), 0) ?? 0
    : 0;

  // Extract product IDs for realtime sync
  const productIds = useMemo(() => {
    return products?.map((item: unknown) => (item as { products?: { id?: string } }).products?.id).filter(Boolean) as string[] ?? [];
  }, [products]);

  // Use realtime inventory sync for live stock updates
  const {
    isProductAvailable: checkProductAvailable,
    getProductStatus,
    isConnected: _isRealtimeConnected,
  } = useMenuInventorySync({
    menuId: menuId ?? '',
    tenantId: tenantId || null,
    productIds,
    enabled: !!menuId && !!tenantId && productIds.length > 0,
    onProductUnavailable: useCallback((change) => {
      logger.info('[CustomerMenuViewPage] Product became unavailable', {
        productId: change.productId,
        productName: change.productName,
      });
      // Refresh products query to update UI
      queryClient.invalidateQueries({ queryKey: queryKeys.customerMenu.products(menuId || undefined, tenantId) });
    }, [queryClient, menuId, tenantId]),
    onProductRestored: useCallback((change) => {
      logger.info('[CustomerMenuViewPage] Product restored', {
        productId: change.productId,
        productName: change.productName,
      });
      // Refresh products query to update UI
      queryClient.invalidateQueries({ queryKey: queryKeys.customerMenu.products(menuId || undefined, tenantId) });
    }, [queryClient, menuId, tenantId]),
  });

  // Map products for grid and search with realtime stock status
  const mappedProducts = useMemo(() => {
    return products?.map((item: unknown) => {
      const typedItem = item as { products: { id: string; stock_quantity?: number | null } };
      const product = typedItem.products;
      // Check realtime status first, fallback to static stock_quantity
      const realtimeAvailable = checkProductAvailable(product.id);
      const staticAvailable = product.stock_quantity === null || (product.stock_quantity ?? 0) > 0;

      return {
        ...product,
        available: realtimeAvailable && staticAvailable,
        stock_status: getProductStatus(product.id),
        min_quantity: 1 // Default
      };
    }) ?? [];
  }, [products, checkProductAvailable, getProductStatus]);

  const handleAddToCart = async (productId: string, quantity: number) => {
    try {
      const selectedWeight = "unit";

      if (user) {
        const { error } = await supabase
          .from("cart_items")
          .upsert({
            user_id: user.id,
            product_id: productId,
            quantity: quantity,
            selected_weight: selectedWeight,
          }, {
            onConflict: "user_id,product_id,selected_weight"
          });

        if (error) throw error;
        queryClient.invalidateQueries({ queryKey: queryKeys.cart.user(user.id, tenantId) });
      } else {
        addToGuestCart(productId, quantity, selectedWeight);
      }

      toast.success("Added to cart", {
        description: "Item added to your cart",
      });
    } catch (error: unknown) {
      toast.error("Error", {
        description: error instanceof Error ? error.message : "Failed to add item to cart",
      });
    }
  };

  if (menuLoading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-[hsl(var(--customer-bg))]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!menu) {
    return (
      <div className="min-h-dvh bg-[hsl(var(--customer-bg))] pb-16 lg:pb-0">
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
        <CustomerMobileBottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-[hsl(var(--customer-bg))] pb-16 lg:pb-0">
      {/* Mobile Top Navigation */}
      <CustomerMobileNav />

      <SmartSearchOverlay
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        products={mappedProducts}
        onProductSelect={(id) => {
          // Find product and scroll to it or filter
          const product = mappedProducts.find((p) => p.id === id);
          if (product) {
            setSearchTerm(product.name);
          }
        }}
      />

      {/* Hero Section */}
      <div className="relative h-[200px] md:h-[300px] w-full overflow-hidden">
        <div className="absolute inset-0 bg-slate-50">
          {menu.image_url ? (
            <img
              src={menu.image_url}
              alt={menu.name}
              className="w-full h-full object-cover opacity-60"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full opacity-30 bg-[url('https://images.unsplash.com/photo-1555396273-367ea4eb4db5?q=80&w=2574&auto=format&fit=crop')] bg-cover bg-center" />
          )}
        </div>
        <div className="absolute inset-0 bg-slate-50" />

        <div className="absolute bottom-0 left-0 right-0 p-6 container mx-auto">
          <div className="flex items-end justify-between">
            <div className="text-white space-y-2">
              <Badge className="bg-white/20 hover:bg-white/30 text-white border-0  mb-2">
                {tenant?.business_name || "Store"}
              </Badge>
              <h1 className="text-3xl md:text-5xl font-bold tracking-tight shadow-sm">{menu.name}</h1>
              {menu.description && (
                <p className="text-white/90 max-w-2xl text-sm md:text-base line-clamp-2">
                  {menu.description}
                </p>
              )}
              <div className="flex items-center gap-4 text-xs md:text-sm text-white/80 pt-2">
                <span className="flex items-center gap-1">
                  <Star className="h-4 w-4 text-yellow-400 fill-yellow-400" />
                  4.9 (120+)
                </span>
                <span>•</span>
                <span>20-30 min delivery</span>
                <span>•</span>
                <span>$$</span>
              </div>
            </div>
          </div>
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(`/${tenant?.slug}/shop/dashboard`)}
          className="absolute top-4 left-4 text-white hover:bg-white/20 rounded-full h-10 w-10 "
          aria-label="Back to dashboard"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
      </div>

      {/* Sticky Category Nav & Search */}
      <div className="sticky top-0 z-40 bg-white/80  border-b border-gray-100 shadow-sm">
        <div className="container mx-auto px-4 py-3">
          <div className="flex flex-col md:flex-row gap-4 items-center">
            {/* Search Trigger */}
            <div
              className="relative w-full md:w-64"
              onClick={() => setIsSearchOpen(true)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setIsSearchOpen(true); } }}
            >
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                readOnly
                placeholder="Search menu..."
                value={searchTerm}
                className="pl-9 h-9 bg-gray-100/50 border-0 focus-visible:ring-1 focus-visible:ring-primary rounded-full cursor-pointer"
                aria-label="Search menu"
              />
            </div>

            {/* Category Pills */}
            <div className="w-full overflow-x-auto no-scrollbar pb-1 md:pb-0">
              <div className="flex gap-2">
                <Button
                  variant={!searchTerm ? "default" : "secondary"}
                  size="sm"
                  className="rounded-full px-4 h-8 font-medium"
                  onClick={() => setSearchTerm("")}
                >
                  All
                </Button>
                {/* Extract unique categories from products */}
                {Array.from(new Set(products?.map((p) => p.products?.category).filter(Boolean))).map((category) => (
                  <Button
                    key={String(category)}
                    variant="secondary"
                    size="sm"
                    className="rounded-full px-4 h-8 font-medium whitespace-nowrap hover:bg-primary/10 hover:text-primary transition-colors"
                    onClick={() => setSearchTerm(String(category))}
                  >
                    {String(category)}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto p-4 md:p-6 space-y-6">
        <MenuProductGrid
          products={mappedProducts.filter((p) => {
            if (!searchTerm) return true;
            const searchLower = searchTerm.toLowerCase();
            return p.name.toLowerCase().includes(searchLower) ||
              p.category?.toLowerCase().includes(searchLower);
          })}
          showImages={true}
          showAvailability={true}
          onAddToCart={handleAddToCart}
        />

        {/* Sticky Cart Footer */}
        {totalItems > 0 && (
          <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[hsl(var(--customer-border))] shadow-lg p-4 z-sticky safe-area-bottom">
            <div className="container mx-auto flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <ShoppingCart className="h-6 w-6 text-[hsl(var(--customer-primary))]" />
                  <Badge className="absolute -top-2 -right-2 bg-[hsl(var(--customer-accent))] text-white border-0 min-w-[20px] h-5 flex items-center justify-center">
                    {totalItems}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-[hsl(var(--customer-text-light))]">{totalItems} item{totalItems !== 1 ? 's' : ''} in cart</p>
                  <p className="text-lg font-bold text-[hsl(var(--customer-text))]">
                    {formatCurrency(cartTotal)}
                  </p>
                </div>
              </div>
              <Button
                size="lg"
                onClick={() => navigate(`/${tenant?.slug}/shop/cart`)}
                className="bg-slate-50(var(--customer-primary))] (var(--customer-secondary))] hover:opacity-90 text-white px-8"
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
