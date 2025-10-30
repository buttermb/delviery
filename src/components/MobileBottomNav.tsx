import { Home, Search, ShoppingCart, User, LucideIcon } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useIsMobile } from '@/hooks/use-mobile';
import { useScrollDirection } from '@/hooks/useScrollDirection';
import { haptics } from '@/utils/haptics';
import { useGuestCart } from '@/hooks/useGuestCart';

interface MobileBottomNavProps {
  onCartClick: () => void;
  onAuthClick: () => void;
}

interface NavItem {
  icon: LucideIcon;
  label: string;
  path: string;
  onClick: ((e: React.MouseEvent) => void) | null;
  badge?: number;
}

const MobileBottomNav = ({ onCartClick, onAuthClick }: MobileBottomNavProps) => {
  const location = useLocation();
  const { user } = useAuth();
  const { getGuestCartCount } = useGuestCart();
  const isMobile = useIsMobile();
  const scrollDirection = useScrollDirection();

  const { data: cartItems = [] } = useQuery({
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

  const dbCartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const guestCartCount = user ? 0 : getGuestCartCount();
  const cartCount = user ? dbCartCount : guestCartCount;

  const handleProductsClick = (e: React.MouseEvent) => {
    e.preventDefault();
    const element = document.getElementById('products');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    } else {
      window.location.href = '/#products';
    }
  };

  const navItems: NavItem[] = [
    { icon: Home, label: 'Home', path: '/', onClick: null },
    { icon: Search, label: 'Menu', path: '/#products', onClick: handleProductsClick },
    { icon: ShoppingCart, label: 'Cart', path: '/cart', onClick: null, badge: cartCount }, // Allow guests to access cart
    { icon: User, label: 'Account', path: user ? '/my-orders' : '#', onClick: user ? null : onAuthClick },
  ];

  // Only show on mobile devices
  if (!isMobile) return null;

  // Hide on scroll down, show on scroll up (at top always show)
  const isVisible = scrollDirection !== 'down' || window.scrollY < 100;

  return (
    <nav 
      className={cn(
        "fixed left-0 right-0 z-50 md:hidden",
        "bg-card/98 backdrop-blur-xl supports-[backdrop-filter]:bg-card/95",
        "border-t border-border/50",
        "rounded-t-3xl safe-area-bottom",
        "transition-all duration-300 ease-out",
        "shadow-[0_-8px_32px_rgba(0,0,0,0.12)]",
        isVisible ? "translate-y-0 bottom-0" : "translate-y-full bottom-0"
      )}
      style={{
        paddingBottom: 'max(8px, env(safe-area-inset-bottom))',
      }}
    >
      {/* Top accent line */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-12 h-1 bg-border/60 rounded-full" />
      
      <div className="flex justify-around items-center h-[72px] px-3 pt-2">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path || 
                          (item.path === '/#products' && location.pathname === '/' && location.hash === '#products');
          const Icon = item.icon;
          
          return (
            <Link
              key={item.label}
              to={item.path}
              onClick={(e) => {
                haptics.light();
                if (item.onClick) {
                  e.preventDefault();
                  item.onClick(e);
                }
              }}
              className={cn(
                "flex flex-col items-center justify-center gap-1.5 relative",
                "px-4 py-2.5 rounded-2xl transition-all duration-300",
                "min-w-[64px] min-h-[60px]",
                "touch-target group",
                "active:scale-[0.92]",
                isActive 
                  ? "text-primary" 
                  : "text-muted-foreground hover:text-foreground"
              )}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
            >
              {/* Active indicator pill */}
              {isActive && (
                <div 
                  className="absolute inset-0 bg-primary/10 rounded-2xl animate-in fade-in zoom-in-95 duration-300"
                  style={{
                    boxShadow: '0 0 24px hsla(var(--primary) / 0.15)',
                  }}
                />
              )}
              
              <div className="relative z-10 flex flex-col items-center gap-1.5">
                <div className="relative">
                  {/* Glow effect on active */}
                  {isActive && (
                    <div 
                      className="absolute inset-0 bg-primary/30 blur-xl rounded-full animate-pulse"
                      style={{ animationDuration: '2s' }}
                    />
                  )}
                  
                  <Icon 
                    className={cn(
                      "w-[26px] h-[26px] transition-all duration-300 relative z-10",
                      isActive && "scale-110 drop-shadow-[0_2px_8px_hsla(var(--primary)/0.4)]"
                    )} 
                    strokeWidth={isActive ? 2.5 : 2}
                  />
                  
                  {/* Badge for cart */}
                  {item.badge !== undefined && item.badge > 0 && (
                    <div 
                      className={cn(
                        "absolute -top-2 -right-2 z-20",
                        "bg-gradient-to-br from-destructive to-destructive/90",
                        "text-destructive-foreground",
                        "text-[10px] font-bold leading-none",
                        "rounded-full min-w-[20px] h-[20px]",
                        "flex items-center justify-center px-1.5",
                        "shadow-lg border-2 border-card",
                        "animate-in zoom-in-50 duration-300",
                        "ring-1 ring-destructive/20"
                      )}
                    >
                      {item.badge > 99 ? '99+' : item.badge}
                    </div>
                  )}
                </div>
                
                <span 
                  className={cn(
                    "text-[10px] font-medium transition-all duration-300 whitespace-nowrap",
                    isActive 
                      ? "font-bold text-primary scale-105" 
                      : "text-muted-foreground group-hover:text-foreground"
                  )}
                >
                  {item.label}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default MobileBottomNav;
