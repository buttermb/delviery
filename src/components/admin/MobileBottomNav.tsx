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
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t lg:hidden safe-area-bottom">
      <div className="grid grid-cols-5 gap-1">
        {quickLinks.map((link) => {
          const Icon = link.icon;
          const fullPath = getFullPath(link.href);
          const active = isActive(link.href);

          return (
            <Link
              key={link.href}
              to={fullPath}
              className={cn(
                'flex flex-col items-center justify-center py-3 text-xs transition-colors min-h-[60px] touch-manipulation',
                active
                  ? 'text-primary font-medium'
                  : 'text-muted-foreground'
              )}
            >
              <Icon className="h-5 w-5 mb-1" />
              <span>{link.title}</span>
            </Link>
          );
        })}

        {/* More menu */}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <button className="flex flex-col items-center justify-center py-3 text-xs text-muted-foreground min-h-[60px] touch-manipulation w-full">
              <Menu className="h-5 w-5 mb-1" />
              <span>More</span>
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

