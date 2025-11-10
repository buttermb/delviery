import { Link, useLocation, useParams } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  ShoppingCart,
  Users,
  Map,
  Menu
} from 'lucide-react';
import { useState } from 'react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Sidebar } from './Sidebar';

export function MobileBottomNav() {
  const location = useLocation();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const [open, setOpen] = useState(false);

  const quickLinks = [
    {
      title: 'Dashboard',
      href: '/admin/dashboard',
      icon: LayoutDashboard
    },
    {
      title: 'Orders',
      href: '/admin/wholesale-orders',
      icon: ShoppingCart
    },
    {
      title: 'Customers',
      href: '/admin/big-plug-clients',
      icon: Users
    },
    {
      title: 'Drivers',
      href: '/admin/live-map',
      icon: Map
    }
  ];

  const getFullPath = (href: string) => {
    if (!tenantSlug) return href;
    // If href already starts with /admin, prepend tenant slug
    if (href.startsWith('/admin')) {
      return `/${tenantSlug}${href}`;
    }
    return href;
  };

  const isActive = (href: string) => {
    const fullPath = getFullPath(href);
    return location.pathname === fullPath || location.pathname.startsWith(fullPath + '/');
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur border-t lg:hidden safe-area-bottom shadow-lg">
      <div className="grid grid-cols-5 gap-0.5 sm:gap-1">
        {quickLinks.map((link) => {
          const Icon = link.icon;
          const fullPath = getFullPath(link.href);
          const active = isActive(link.href);

          return (
            <Link
              key={link.href}
              to={fullPath}
              className={cn(
                'flex flex-col items-center justify-center py-2 sm:py-3 text-[10px] sm:text-xs transition-colors min-h-[60px] touch-manipulation active:bg-muted/50',
                active
                  ? 'text-primary font-medium bg-primary/5'
                  : 'text-muted-foreground'
              )}
            >
              <Icon className="h-4 w-4 sm:h-5 sm:w-5 mb-0.5 sm:mb-1" />
              <span className="truncate max-w-full px-1">{link.title}</span>
            </Link>
          );
        })}

        {/* More menu */}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <button className="flex flex-col items-center justify-center py-2 sm:py-3 text-[10px] sm:text-xs text-muted-foreground min-h-[60px] touch-manipulation w-full active:bg-muted/50">
              <Menu className="h-4 w-4 sm:h-5 sm:w-5 mb-0.5 sm:mb-1" />
              <span className="truncate max-w-full px-1">More</span>
            </button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-[85vw] max-w-sm">
            <Sidebar />
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}

