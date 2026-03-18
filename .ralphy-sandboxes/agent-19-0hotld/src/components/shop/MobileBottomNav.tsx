/**
 * Mobile Bottom Navigation
 * Sticky bottom nav for mobile users — hides on scroll down, shows on scroll up
 */

import { useRef, useState, useEffect, useCallback } from 'react';
import { Link, useParams, useLocation } from 'react-router-dom';
import { Home, Search, ShoppingCart, User, ClipboardList } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface MobileBottomNavProps {
  cartItemCount: number;
  primaryColor: string;
  onCartClick?: () => void;
}

export function MobileBottomNav({ cartItemCount, primaryColor, onCartClick }: MobileBottomNavProps) {
  const { storeSlug } = useParams<{ storeSlug: string }>();
  const location = useLocation();
  const [hidden, setHidden] = useState(false);
  const lastScrollY = useRef(0);

  const handleScroll = useCallback(() => {
    const currentY = window.scrollY;
    if (currentY > lastScrollY.current && currentY > 60) {
      setHidden(true);
    } else {
      setHidden(false);
    }
    lastScrollY.current = currentY;
  }, []);

  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  // Reset visibility on route change
  useEffect(() => {
    setHidden(false);
    lastScrollY.current = 0;
  }, [location.pathname]);

  const navItems = [
    { path: `/shop/${storeSlug}`, icon: Home, label: 'Home', exact: true },
    { path: `/shop/${storeSlug}/products`, icon: Search, label: 'Browse' },
    { path: `/shop/${storeSlug}/cart`, icon: ShoppingCart, label: 'Cart', badge: cartItemCount, onClick: onCartClick },
    { path: `/shop/${storeSlug}/orders`, icon: ClipboardList, label: 'Orders' },
    { path: `/shop/${storeSlug}/account`, icon: User, label: 'Account' },
  ];

  const isActive = (path: string, exact?: boolean) => {
    if (exact) {
      return location.pathname === path;
    }
    return location.pathname.startsWith(path);
  };

  return (
    <nav
      className={cn(
        "md:hidden fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-md border-t shadow-lg z-50 transition-transform duration-300",
        hidden && "translate-y-full"
      )}
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      role="navigation"
      aria-label="Main"
    >
      <div className="grid grid-cols-5 h-16">
        {navItems.map(({ path, icon: Icon, label, badge, exact, onClick }) => {
          const active = isActive(path, exact);
          const commonClasses = cn(
            'flex flex-col items-center justify-center gap-1 transition-colors relative min-h-[48px] min-w-[48px] touch-manipulation active:scale-95',
            active ? 'text-primary' : 'text-muted-foreground'
          );
          const content = (
            <>
              <div className="relative">
                <Icon className="w-5 h-5" aria-hidden="true" />
                {badge !== undefined && badge > 0 && (
                  <Badge
                    className="absolute -top-2 -right-3 h-5 w-5 p-0 flex items-center justify-center text-[11px]"
                    style={{ backgroundColor: primaryColor }}
                  >
                    {badge > 99 ? '99+' : badge}
                  </Badge>
                )}
              </div>
              <span className="text-xs font-medium">{label}</span>
              {active && (
                <div
                  className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full"
                  style={{ backgroundColor: primaryColor }}
                />
              )}
            </>
          );

          if (onClick) {
            return (
              <button
                key={path}
                type="button"
                onClick={onClick}
                aria-label={label}
                className={commonClasses}
                style={{ color: active ? primaryColor : undefined }}
              >
                {content}
              </button>
            );
          }

          return (
            <Link
              key={path}
              to={path}
              aria-current={active ? 'page' : undefined}
              aria-label={`Navigate to ${label}`}
              className={commonClasses}
              style={{ color: active ? primaryColor : undefined }}
            >
              {content}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

