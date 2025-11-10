import { useState, useEffect, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Menu, ShoppingCart, User } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, Link } from "react-router-dom";
import AuthModal from "./AuthModal";
import CartDrawer from "./CartDrawer";
import ThemeToggle from "./ThemeToggle";
import NYMLogo from "./NYMLogo";
import MobileBottomNav from "./MobileBottomNav";
import { useGuestCart } from "@/hooks/useGuestCart";
import { SearchBar } from "./SearchBar";
import { haptics } from "@/utils/haptics";
import type { DbCartItem } from "@/types/cart";
import type { Numeric } from "@/types/money";
import { toNumber } from "@/utils/productTypeGuards";

const Navigation = () => {
  const { user, signOut } = useAuth();
  const { getGuestCartCount } = useGuestCart();
  const navigate = useNavigate();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [showCart, setShowCart] = useState(false);
  const [cartUpdateKey, setCartUpdateKey] = useState(0);

  // Force re-render when cart updates
  useEffect(() => {
    const handleCartUpdate = () => {
      setCartUpdateKey(prev => prev + 1);
    };
    window.addEventListener('cartUpdated', handleCartUpdate);
    return () => window.removeEventListener('cartUpdated', handleCartUpdate);
  }, []);

  const { data: cartItems = [] } = useQuery<DbCartItem[]>({
    queryKey: ["cart", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("cart_items")
        .select("*, products(*)")
        .eq("user_id", user.id);
      if (error) throw error;
      return (data || []) as DbCartItem[];
    },
    enabled: !!user,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });

  // Memoize cart calculations to prevent recalculation on every render
  const getItemPrice = useCallback((item: DbCartItem): number => {
    const product = item.products;
    const selectedWeight = item.selected_weight || "unit";
    if (product?.prices && typeof product.prices === 'object') {
      const priceValue = product.prices[selectedWeight] || product.price;
      return priceValue ? toNumber(priceValue) : 0;
    }
    return product?.price ? toNumber(product.price) : 0;
  }, []);

  const dbCartCount = useMemo(() => 
    cartItems.reduce((sum, item) => sum + item.quantity, 0),
    [cartItems]
  );
  
  const guestCartCount = useMemo(() => 
    user ? 0 : getGuestCartCount(),
    [user, getGuestCartCount]
  );
  
  const cartCount = user ? dbCartCount : guestCartCount;
  
  // Cart total only for authenticated users (guest total not shown in nav to simplify)
  const cartTotal = useMemo(() => 
    user ? cartItems.reduce(
      (sum, item) => sum + getItemPrice(item) * item.quantity,
      0
    ) : 0,
    [user, cartItems, getItemPrice]
  );


  const openAuth = (mode: "signin" | "signup") => {
    haptics.light(); // Light tap feedback
    setAuthMode(mode);
    setShowAuthModal(true);
  };

  const handleNavClick = (href: string, scroll: boolean, closeSheet?: () => void) => {
    return (e: React.MouseEvent<HTMLAnchorElement>) => {
      haptics.selection(); // Selection feedback for navigation
      if (scroll && href.includes('#')) {
        e.preventDefault();
        const id = href.split('#')[1];
        const element = document.getElementById(id);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth' });
          closeSheet?.();
        } else {
          // If element not found, navigate to home page first
          navigate('/');
          setTimeout(() => {
            document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
          }, 100);
        }
      } else {
        closeSheet?.();
      }
    };
  };

  const navLinks = [
    { label: "Products", href: "#products", scroll: true },
    { label: "How It Works", href: "#how-it-works", scroll: true },
    { label: "Track Order", href: "/track-order", scroll: false },
    { label: "Support", href: "/support", scroll: false },
  ];

  return (
    <>
      {/* Free Shipping Banner */}
      <div className="bg-card border-b border-border py-2" role="banner" aria-label="Promotional banner">
        <div className="container mx-auto px-4 text-center text-sm font-medium">
          <span>Licensed & Lab Tested | Same-Day Delivery | Free Shipping $100+</span>
        </div>
      </div>

      <header className="sticky top-0 z-50 w-full border-b border-white/5 bg-black/95 backdrop-blur-xl supports-[backdrop-filter]:bg-black/90" role="navigation" aria-label="Main navigation">
        <div className="container flex h-24 items-center justify-between px-6 gap-8">
          <Link to="/" className="flex items-center gap-4 min-w-fit">
            <NYMLogo size={48} />
            <div className="flex flex-col gap-0.5">
              <span className="font-black text-base tracking-wider">DELIVERY</span>
              <span className="text-[10px] text-white/50 tracking-widest uppercase">Premium Service</span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-6 flex-1 justify-center" aria-label="Primary navigation">
            <Link 
              to="/giveaway/nyc-biggest-flower" 
              className="relative text-sm font-semibold transition-colors group"
            >
              <span className="relative flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-primary/10 to-accent/10 border border-primary/30 group-hover:border-primary/50 group-hover:shadow-glow transition-all">
                <span className="relative">
                  LIVE GIVEAWAY
                  <span className="absolute -top-1 -right-2 w-2 h-2 bg-accent rounded-full animate-pulse shadow-[0_0_8px_hsl(var(--accent))]"></span>
                </span>
              </span>
            </Link>
            {navLinks.map((link) => (
              link.scroll ? (
                <a
                  key={link.label}
                  href={link.href}
                  onClick={handleNavClick(link.href, link.scroll)}
                  className="text-sm font-medium text-white/70 hover:text-white transition-colors cursor-pointer whitespace-nowrap"
                >
                  {link.label}
                </a>
              ) : (
                <Link
                  key={link.label}
                  to={link.href}
                  onClick={() => {
                    setTimeout(() => window.scrollTo({ top: 0, behavior: 'instant' }), 0);
                  }}
                  className="text-sm font-medium text-white/70 hover:text-white transition-colors cursor-pointer whitespace-nowrap"
                >
                  {link.label}
                </Link>
              )
            ))}
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-3 min-w-fit">
            {/* Search Icon */}
            <SearchBar variant="icon" />
            
            {/* Sticky Cart Preview */}
            <Button
              variant="outline"
              className="relative gap-3 hidden sm:flex h-11 px-4"
              onClick={() => {
                haptics.light();
                setShowCart(true);
              }}
              aria-label={`Shopping cart with ${cartCount} items and total $${cartTotal.toFixed(2)}`}
            >
              <ShoppingCart className="w-4 h-4" />
              <div className="flex flex-col items-start gap-0.5">
                <span className="text-xs font-semibold leading-none">
                  {cartCount} {cartCount === 1 ? 'item' : 'items'}
                </span>
                {cartTotal > 0 && (
                  <span className="text-[10px] text-muted-foreground leading-none">
                    ${cartTotal.toFixed(2)}
                  </span>
                )}
              </div>
              {cartCount > 0 && (
                <Badge variant="default" className="absolute -top-1.5 -right-1.5 h-5 w-5 flex items-center justify-center p-0 text-[10px]">
                  {cartCount}
                </Badge>
              )}
            </Button>

            {/* Mobile Cart Icon */}
            <Button
              variant="ghost"
              size="icon"
              className="relative sm:hidden h-12 w-12 touch-manipulation active:scale-95 transition-transform"
              onClick={() => {
                haptics.light();
                setShowCart(true);
              }}
              aria-label={`Shopping cart with ${cartCount} items`}
            >
              <ShoppingCart className="w-6 h-6" />
              {cartCount > 0 && (
                <Badge variant="default" className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs">
                  {cartCount}
                </Badge>
              )}
            </Button>

            {user ? (
              <div className="hidden sm:flex items-center gap-3">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-10 w-10" aria-label="User account menu">
                      <User className="w-5 h-5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>
                      <div className="flex flex-col">
                        <span className="font-medium">My Account</span>
                        <span className="text-xs text-muted-foreground truncate">
                          {user.email}
                        </span>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <button onClick={() => navigate("/my-orders")} className="w-full text-left cursor-pointer">
                        My Orders
                      </button>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <button onClick={() => navigate("/account/giveaway-entries")} className="w-full text-left cursor-pointer">
                        My Entries
                      </button>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <button onClick={() => {
                        console.log("Navigating to /account/settings");
                        navigate("/account/settings");
                      }} className="w-full text-left cursor-pointer">
                        Profile Settings
                      </button>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={async () => {
                      await signOut();
                      navigate("/");
                    }}>
                      Sign Out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <ThemeToggle />
              </div>
            ) : (
              <div className="hidden sm:flex items-center gap-3">
                <Button variant="outline" size="sm" className="h-10" onClick={() => openAuth("signin")}>
                  Sign In
                </Button>
                <Button variant="hero" size="sm" className="h-10" onClick={() => openAuth("signup")}>
                  Sign Up
                </Button>
                <ThemeToggle />
              </div>
            )}

            {/* Mobile Menu */}
            <Sheet>
              <SheetTrigger asChild className="md:hidden">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-12 w-12 touch-manipulation active:scale-95 transition-transform"
                  aria-label="Open mobile menu"
                >
                  <Menu className="w-6 h-6" />
                </Button>
              </SheetTrigger>
              <SheetContent className="w-[85vw] sm:w-[400px]">
                <div className="mb-6 mt-4">
                  <SearchBar variant="full" />
                </div>
                <nav className="flex flex-col gap-6" aria-label="Mobile navigation menu">
                  {navLinks.map((link) => (
                    link.scroll ? (
                      <a
                        key={link.label}
                        href={link.href}
                        onClick={handleNavClick(link.href, link.scroll, () => {
                          const closeButton = document.querySelector('[aria-label="Close"]') as HTMLButtonElement;
                          closeButton?.click();
                        })}
                        className="text-lg font-medium transition-colors hover:text-primary cursor-pointer py-2 px-3 rounded-lg hover:bg-muted active:scale-95 touch-manipulation"
                      >
                        {link.label}
                      </a>
                    ) : (
                      <Link
                        key={link.label}
                        to={link.href}
                        onClick={() => {
                          setTimeout(() => window.scrollTo({ top: 0, behavior: 'instant' }), 0);
                          const closeButton = document.querySelector('[aria-label="Close"]') as HTMLButtonElement;
                          closeButton?.click();
                        }}
                        className="text-lg font-medium transition-colors hover:text-primary cursor-pointer py-2 px-3 rounded-lg hover:bg-muted active:scale-95 touch-manipulation"
                      >
                        {link.label}
                      </Link>
                    )
                  ))}
                  {user ? (
                    <>
                      <Button 
                        variant="outline" 
                        className="h-12 text-base touch-manipulation active:scale-95"
                        onClick={() => {
                          navigate("/my-orders");
                          const closeButton = document.querySelector('[aria-label="Close"]') as HTMLButtonElement;
                          closeButton?.click();
                        }}
                      >
                        My Orders
                      </Button>
                      <Button 
                        variant="outline" 
                        className="h-12 text-base touch-manipulation active:scale-95"
                        onClick={() => {
                          navigate("/account/settings");
                          const closeButton = document.querySelector('[aria-label="Close"]') as HTMLButtonElement;
                          closeButton?.click();
                        }}
                      >
                        Profile Settings
                      </Button>
                      <Button 
                        variant="outline" 
                        className="h-12 text-base touch-manipulation active:scale-95"
                        onClick={async () => {
                          await signOut();
                          navigate("/");
                        }}
                      >
                        Sign Out
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button 
                        variant="outline" 
                        className="h-12 text-base touch-manipulation active:scale-95"
                        onClick={() => openAuth("signin")}
                      >
                        Sign In
                      </Button>
                      <Button 
                        variant="hero" 
                        className="h-12 text-base touch-manipulation active:scale-95"
                        onClick={() => openAuth("signup")}
                      >
                        Sign Up
                      </Button>
                    </>
                  )}
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      <AuthModal
        open={showAuthModal}
        onOpenChange={setShowAuthModal}
        mode={authMode}
        onModeChange={setAuthMode}
      />

      <CartDrawer open={showCart} onOpenChange={setShowCart} />
      
      <MobileBottomNav 
        onCartClick={() => {
          haptics.light();
          setShowCart(true);
        }}
        onAuthClick={() => openAuth("signin")}
      />
    </>
  );
};

export default Navigation;
