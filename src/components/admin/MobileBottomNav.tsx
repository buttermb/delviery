import { Link, useLocation } from 'react-router-dom';
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
  const [open, setOpen] = useState(false);

  const quickLinks = [
    {
      title: 'Dashboard',
      href: '/admin/big-plug-dashboard',
      icon: LayoutDashboard
    },
    {
      title: 'Orders',
      href: '/admin/big-plug-order',
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

  const isActive = (href: string) => {
    return location.pathname === href || location.pathname.startsWith(href + '/');
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t lg:hidden safe-area-bottom">
      <div className="grid grid-cols-5 gap-1">
        {quickLinks.map((link) => {
          const Icon = link.icon;
          const active = isActive(link.href);

          return (
            <Link
              key={link.href}
              to={link.href}
              className={cn(
                'flex flex-col items-center justify-center py-3 text-xs transition-colors',
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
            <button className="flex flex-col items-center justify-center py-3 text-xs text-muted-foreground">
              <Menu className="h-5 w-5 mb-1" />
              <span>More</span>
            </button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-64">
            <Sidebar />
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}

