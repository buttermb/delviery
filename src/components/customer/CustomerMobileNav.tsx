import { useState, useEffect } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Menu,
  Home,
  ShoppingBag,
  Package,
  Settings,
  User,
  LogOut,
  ShoppingCart,
  Building2,
} from "lucide-react";
import { useCustomerAuth } from "@/contexts/CustomerAuthContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useGuestCart } from "@/hooks/useGuestCart";

export function CustomerMobileNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { customer, tenant, logout } = useCustomerAuth();
  const isMobile = useIsMobile();
  const [menuOpen, setMenuOpen] = useState(false);
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

  // Fetch cart items for authenticated users
  const { data: cartItems = [] } = useQuery({
    queryKey: ["cart", user?.id, cartUpdateKey],
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

  interface CartItem {
    quantity: number;
    [key: string]: unknown;
  }

  // Calculate cart count (authenticated or guest)
  const dbCartCount = cartItems.reduce((sum: number, item: CartItem) => sum + (item.quantity || 0), 0);
  const guestCartCount = user ? 0 : getGuestCartCount();
  const cartCount = user ? dbCartCount : guestCartCount;

  if (!isMobile) return null;

  const handleLogout = async () => {
    await logout();
    navigate(`/${tenant?.slug}/shop/login`);
    setMenuOpen(false);
  };

  const navItems = [
    {
      label: "Dashboard",
      icon: Home,
      path: `/${tenant?.slug}/shop/dashboard`,
      onClick: () => {
        navigate(`/${tenant?.slug}/shop/dashboard`);
        setMenuOpen(false);
      },
    },
    {
      label: "Menus",
      icon: ShoppingBag,
      path: `/${tenant?.slug}/shop/dashboard`,
      onClick: () => {
        navigate(`/${tenant?.slug}/shop/dashboard`);
        setMenuOpen(false);
      },
    },
    {
      label: "Retail",
      icon: ShoppingBag,
      path: `/${tenant?.slug}/shop/retail/businesses`,
      onClick: () => {
        navigate(`/${tenant?.slug}/shop/retail/businesses`);
        setMenuOpen(false);
      },
    },
    {
      label: "Wholesale",
      icon: Building2,
      path: `/${tenant?.slug}/shop/wholesale`,
      onClick: () => {
        navigate(`/${tenant?.slug}/shop/wholesale`);
        setMenuOpen(false);
      },
    },
    {
      label: "Orders",
      icon: Package,
      path: `/${tenant?.slug}/shop/orders`,
      onClick: () => {
        navigate(`/${tenant?.slug}/shop/orders`);
        setMenuOpen(false);
      },
    },
    {
      label: "Settings",
      icon: Settings,
      path: `/${tenant?.slug}/shop/settings`,
      onClick: () => {
        navigate(`/${tenant?.slug}/shop/settings`);
        setMenuOpen(false);
      },
    },
  ];

  return (
    <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-white border-b border-[hsl(var(--customer-border))] shadow-sm">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="text-[hsl(var(--customer-text))] hover:bg-[hsl(var(--customer-surface))]"
                aria-label="Open navigation menu"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="left"
              className="w-[280px] bg-white border-[hsl(var(--customer-border))]"
              aria-label="Navigation menu"
            >
              <div className="flex flex-col h-full">
                <div className="mb-6 mt-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-[hsl(var(--customer-primary))] to-[hsl(var(--customer-secondary))] flex items-center justify-center">
                      <ShoppingBag className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="font-semibold text-[hsl(var(--customer-text))]">
                        {tenant?.business_name || "Shop"}
                      </p>
                      <p className="text-xs text-[hsl(var(--customer-text-light))]">
                        {customer?.first_name || customer?.email}
                      </p>
                    </div>
                  </div>
                </div>

                <nav className="flex-1 space-y-1">
                  {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = location.pathname === item.path;

                    return (
                      <button
                        key={item.label}
                        onClick={item.onClick}
                        className={cn(
                          "w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-left",
                          isActive
                            ? "bg-[hsl(var(--customer-primary))]/10 text-[hsl(var(--customer-primary))]"
                            : "text-[hsl(var(--customer-text))] hover:bg-[hsl(var(--customer-surface))]"
                        )}
                        aria-label={`Navigate to ${item.label}`}
                        aria-current={isActive ? "page" : undefined}
                      >
                        <Icon className="h-5 w-5" aria-hidden="true" />
                        <span className="font-medium">{item.label}</span>
                      </button>
                    );
                  })}
                </nav>

                <div className="pt-4 border-t border-[hsl(var(--customer-border))]">
                  <Button
                    variant="ghost"
                    onClick={handleLogout}
                    className="w-full justify-start text-[hsl(var(--customer-text))] hover:bg-[hsl(var(--customer-surface))] hover:text-[hsl(var(--customer-accent))]"
                  >
                    <LogOut className="h-5 w-5 mr-3" />
                    Sign Out
                  </Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>

          <Link to={`/${tenant?.slug}/shop/dashboard`}>
            <h1 className="text-lg font-bold text-[hsl(var(--customer-text))]">
              {tenant?.business_name || "Shop"}
            </h1>
          </Link>
        </div>

        <Link to={`/${tenant?.slug}/shop/cart`}>
          <Button
            variant="ghost"
            size="icon"
            className="relative text-[hsl(var(--customer-text))] hover:bg-[hsl(var(--customer-surface))]"
            aria-label={`Shopping cart with ${cartCount} items`}
          >
            <ShoppingCart className="h-5 w-5" />
            {cartCount > 0 && (
              <Badge 
                className="absolute -top-1 -right-1 h-5 min-w-[20px] px-1.5 text-xs bg-[hsl(var(--customer-accent))] text-white border-0 flex items-center justify-center"
                aria-label={`${cartCount} items in cart`}
              >
                {cartCount > 99 ? '99+' : cartCount}
              </Badge>
            )}
          </Button>
        </Link>
      </div>
    </div>
  );
}

