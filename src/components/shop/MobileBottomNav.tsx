/**
 * Mobile Bottom Navigation
 * Sticky bottom nav for mobile users
 */

import { Link, useParams, useLocation } from 'react-router-dom';
import { Home, Search, ShoppingCart, User, Heart, Moon, Sun } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useTheme } from '@/contexts/ThemeContext';

interface MobileBottomNavProps {
  cartItemCount: number;
  primaryColor: string;
}

export function MobileBottomNav({ cartItemCount, primaryColor }: MobileBottomNavProps) {
  const { storeSlug } = useParams();
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();

  const navItems = [
    { path: `/shop/${storeSlug}`, icon: Home, label: 'Home', exact: true },
    { path: `/shop/${storeSlug}/products`, icon: Search, label: 'Browse' },
    { path: `/shop/${storeSlug}/cart`, icon: ShoppingCart, label: 'Cart', badge: cartItemCount },
    { path: `/shop/${storeSlug}/wishlist`, icon: Heart, label: 'Wishlist' },
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
      className="md:hidden fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-md border-t shadow-lg z-50"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      role="navigation"
      aria-label="Main"
    >
      <div className="grid grid-cols-6 h-16">
        {navItems.map(({ path, icon: Icon, label, badge, exact }) => {
          const active = isActive(path, exact);
          return (
            <Link
              key={path}
              to={path}
              aria-current={active ? 'page' : undefined}
              aria-label={`Navigate to ${label}`}
              className={cn(
                'flex flex-col items-center justify-center gap-1 transition-colors relative min-h-[48px] min-w-[48px] touch-manipulation active:scale-95',
                active ? 'text-primary' : 'text-muted-foreground'
              )}
              style={{ color: active ? primaryColor : undefined }}
            >
              <div className="relative">
                <Icon className="w-5 h-5" aria-hidden="true" />
                {badge !== undefined && badge > 0 && (
                  <Badge
                    className="absolute -top-2 -right-2 h-4 w-4 p-0 flex items-center justify-center text-[10px]"
                    style={{ backgroundColor: primaryColor }}
                  >
                    {badge > 99 ? '99+' : badge}
                  </Badge>
                )}
              </div>
              <span className="text-[10px] font-medium">{label}</span>
              {active && (
                <div
                  className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full"
                  style={{ backgroundColor: primaryColor }}
                />
              )}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
          className="flex flex-col items-center justify-center gap-1 transition-colors relative min-h-[44px] min-w-[44px] text-muted-foreground hover:text-primary"
        >
          <div className="relative">
            {theme === 'light' ? (
              <Moon className="w-5 h-5" aria-hidden="true" />
            ) : (
              <Sun className="w-5 h-5" aria-hidden="true" />
            )}
          </div>
          <span className="text-[10px] font-medium">{theme === 'light' ? 'Dark' : 'Light'}</span>
        </button>
      </div>
    </nav>
  );
}

