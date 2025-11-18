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

export function CustomerMobileBottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { tenant, customer } = useCustomerAuth();
  const isMobile = useIsMobile();
  const { getGuestCartCount } = useGuestCart();
  const [cartUpdateKey, setCartUpdateKey] = useState(0);

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
    queryKey: ["cart", user?.id, cartUpdateKey],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("cart_items")
        .select("*, products(*)")
        .eq("user_id", user.id);
      if (error) throw error;
      return (data || []) as CartItem[];
    },
    enabled: !!user,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });

  // Calculate cart count (authenticated or guest)
  const dbCartCount = cartItems.reduce((sum: number, item: CartItem) => sum + (item.quantity || 0), 0);
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
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-[hsl(var(--customer-border))] shadow-lg lg:hidden min-h-[64px] safe-area-bottom" style={{ zIndex: 50 }}>
      <div className="grid grid-cols-6 h-full items-center px-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          const isCart = item.path.includes("/cart");

          return (
            <button
              key={item.label}
              onClick={() => {
                triggerHaptic('light');
                navigate(item.path);
              }}
              className={cn(
                "flex flex-col items-center justify-center gap-1 w-full min-h-[48px] transition-colors relative touch-manipulation active:scale-95",
                isActive
                  ? "text-[hsl(var(--customer-primary))]"
                  : "text-[hsl(var(--customer-text-light))] hover:text-[hsl(var(--customer-text))]"
              )}
              aria-label={`Navigate to ${item.label}`}
              aria-current={isActive ? "page" : undefined}
            >
              <div className="relative">
                <Icon className="h-5 w-5" aria-hidden="true" />
                {item.badge !== undefined && item.badge > 0 && (
                  <Badge 
                    className="absolute -top-2 -right-2 h-4 min-w-[16px] px-1 text-xs bg-[hsl(var(--customer-accent))] text-white border-0"
                    aria-label={`${item.badge} items in ${item.label}`}
                  >
                    {item.badge}
                  </Badge>
                )}
              </div>
              <span className="text-xs font-medium">{item.label}</span>
              {isActive && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-[hsl(var(--customer-primary))] rounded-full" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

