import { useNavigate, useLocation } from "react-router-dom";
import { Home, ShoppingBag, Package, User, ShoppingCart, Users } from "lucide-react";
import { useCustomerAuth } from "@/contexts/CustomerAuthContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { triggerHaptic } from "@/lib/utils/mobile";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useGuestCart } from "@/hooks/useGuestCart";
import { useEffect, useState } from "react";
import { useMobileNavigation } from "@/hooks/useMobileNavigation";
import { MobileErrorBoundary } from "@/components/mobile/MobileErrorBoundary";
import { OfflineIndicator } from "@/components/mobile/OfflineIndicator";
import { queryKeys } from "@/lib/queryKeys";

export function CustomerMobileBottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { tenant } = useCustomerAuth();
  const isMobile = useIsMobile();
  const { getGuestCartCount } = useGuestCart();
  const [cartUpdateKey, setCartUpdateKey] = useState(0);
  const { isNavigating } = useMobileNavigation();

  // Listen for cart updates
  useEffect(() => {
    const handleCartUpdate = () => {
      setCartUpdateKey(prev => prev + 1);
    };
    window.addEventListener('cartUpdated', handleCartUpdate);
    return () => window.removeEventListener('cartUpdated', handleCartUpdate);
  }, []);

  // Get current user session for cart query
  const [user, setUser] = useState<{ id: string } | null>(null);
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });
  }, []);

  interface CartItem {
    quantity: number;
    [key: string]: unknown;
  }

  // Fetch cart items for authenticated users
  const { data: cartItems = [] } = useQuery<CartItem[]>({
    queryKey: queryKeys.customerCart.byUser(user?.id, cartUpdateKey),
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("cart_items")
        .select("*, products(*)")
        .eq("user_id", user.id);
      if (error) throw error;
      return (data ?? []) as CartItem[];
    },
    enabled: !!user,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });

  // Calculate cart count (authenticated or guest)
  const dbCartCount = cartItems.reduce((sum: number, item: CartItem) => sum + (item.quantity ?? 0), 0);
  const guestCartCount = user ? 0 : getGuestCartCount();
  const cartCount = user ? dbCartCount : guestCartCount;

  if (!isMobile) return null;

  const navItems = [
    {
      label: "Home",
      icon: Home,
      path: `/${tenant?.slug}/shop/dashboard`,
    },
    {
      label: "Retail",
      icon: ShoppingBag,
      path: `/${tenant?.slug}/shop/retail/businesses`,
    },
    {
      label: "Community",
      icon: Users,
      path: `/community`,
    },
    {
      label: "Cart",
      icon: ShoppingCart,
      path: `/${tenant?.slug}/shop/cart`,
      badge: cartCount,
    },
    {
      label: "Orders",
      icon: Package,
      path: `/${tenant?.slug}/shop/orders`,
    },
    {
      label: "Account",
      icon: User,
      path: `/${tenant?.slug}/shop/settings`,
    },
  ];

  return (
    <>
      <OfflineIndicator />
      <MobileErrorBoundary>
        <nav
          className="fixed bottom-0 left-0 right-0 z-sticky bg-white/80 backdrop-blur-md border-t border-[hsl(var(--customer-border))] shadow-lg lg:hidden min-h-[64px] safe-area-bottom transition-all duration-200"
          role="navigation"
          aria-label="Customer mobile navigation"
        >
          {/* Loading indicator */}
          {isNavigating && (
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-[hsl(var(--customer-primary))]/30 overflow-hidden">
              <div className="h-full bg-[hsl(var(--customer-primary))] animate-[shimmer_1s_ease-in-out_infinite]" style={{
                backgroundImage: 'linear-gradient(90deg, transparent, hsl(var(--customer-primary)), transparent)',
                backgroundSize: '200% 100%'
              }} />
            </div>
          )}

          <div className="grid grid-cols-6 h-full items-center px-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;

              return (
                <button
                  key={item.label}
                  onClick={() => {
                    triggerHaptic('light');
                    navigate(item.path);
                  }}
                  className={cn(
                    "flex flex-col items-center justify-center gap-1 w-full min-h-[48px] transition-all duration-200 relative touch-manipulation active:scale-95",
                    isActive
                      ? "text-[hsl(var(--customer-primary))]"
                      : "text-[hsl(var(--customer-text-light))] hover:text-[hsl(var(--customer-text))]"
                  )}
                  aria-label={`Navigate to ${item.label}`}
                  aria-current={isActive ? "page" : undefined}
                >
                  <div className="relative">
                    <Icon className={cn("h-5 w-5 transition-transform duration-200", isActive && "scale-110")} aria-hidden="true" />
                    {item.badge !== undefined && item.badge > 0 && (
                      <Badge
                        className="absolute -top-2 -right-2 h-4 min-w-[16px] px-1 text-xs bg-[hsl(var(--customer-accent))] text-white border-0 animate-in zoom-in duration-300"
                        aria-label={`${item.badge} items in ${item.label}`}
                      >
                        {item.badge}
                      </Badge>
                    )}
                  </div>
                  <span className={cn("text-xs font-medium transition-all duration-200", isActive && "font-bold")}>{item.label}</span>
                  {isActive && (
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-[hsl(var(--customer-primary))] rounded-full" />
                  )}
                </button>
              );
            })}
          </div>
        </nav>
      </MobileErrorBoundary>
    </>
  );
}

