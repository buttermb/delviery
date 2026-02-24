import { logger } from '@/lib/logger';
/**
 * Super Admin Mobile Bottom Navigation
 * Fixed bottom nav bar for mobile super admin access
 */

import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { triggerHaptic } from '@/lib/utils/mobile';
import {
  LayoutDashboard,
  Building2,
  Activity,
  BarChart3,
  Menu,
  X
} from 'lucide-react';
import { useState } from 'react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { SidebarProvider } from '@/components/ui/sidebar';
import { SaasAdminSidebar } from './SaasAdminSidebar';
import { useIsMobile } from '@/hooks/useIsMobile';
import { MobileErrorBoundary } from '@/components/mobile/MobileErrorBoundary';
import { OfflineIndicator } from '@/components/mobile/OfflineIndicator';

export function SuperAdminMobileBottomNav() {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const isMobile = useIsMobile();

  // Hide on desktop
  if (!isMobile) return null;

  const quickLinks = [
    {
      title: 'Dashboard',
      href: '/super-admin/dashboard',
      icon: LayoutDashboard
    },
    {
      title: 'Tenants',
      href: '/super-admin/tenants',
      icon: Building2
    },
    {
      title: 'Monitor',
      href: '/super-admin/monitoring',
      icon: Activity
    },
    {
      title: 'Analytics',
      href: '/super-admin/analytics',
      icon: BarChart3
    }
  ];

  const isActive = (href: string) => {
    return location.pathname === href || location.pathname.startsWith(href + '/');
  };

  return (
    <>
      <OfflineIndicator />
      <MobileErrorBoundary>
        <nav 
          className="fixed bottom-0 left-0 right-0 bg-[hsl(var(--super-admin-surface))]/95 backdrop-blur border-t border-white/10 lg:hidden min-h-[64px] safe-area-bottom shadow-lg z-sticky"
          role="navigation"
          aria-label="Super admin mobile navigation"
        >
      <div className="grid grid-cols-5 h-full items-center">
        {quickLinks.map((link) => {
          const Icon = link.icon;
          const active = isActive(link.href);

          return (
            <Link
              key={link.href}
              to={link.href}
              onClick={() => triggerHaptic('light')}
              className={cn(
                'flex flex-col items-center justify-center py-2 sm:py-3 text-[10px] sm:text-xs transition-colors min-h-[48px] w-full touch-manipulation active:scale-95 active:bg-white/5',
                active
                  ? 'text-[hsl(var(--super-admin-primary))] font-medium bg-white/5'
                  : 'text-[hsl(var(--super-admin-text))]/70'
              )}
              aria-label={`Navigate to ${link.title}`}
              aria-current={active ? 'page' : undefined}
            >
              <Icon className="h-4 w-4 sm:h-5 sm:w-5 mb-0.5 sm:mb-1" aria-hidden="true" />
              <span className="truncate max-w-full px-1">{link.title}</span>
            </Link>
          );
        })}

        {/* More menu */}
        <Sheet open={open} onOpenChange={(isOpen) => {
          setOpen(isOpen);
          if (isOpen) {
            logger.debug('SuperAdminMobileBottomNav sheet opened');
          }
        }}>
          <SheetTrigger asChild>
            <button 
              onClick={() => triggerHaptic('medium')}
              className="flex flex-col items-center justify-center py-2 sm:py-3 text-[10px] sm:text-xs text-[hsl(var(--super-admin-text))]/70 min-h-[48px] w-full touch-manipulation active:scale-95 active:bg-white/5"
              aria-label="Open navigation menu"
              aria-expanded={open}
            >
              <Menu className="h-4 w-4 sm:h-5 sm:w-5 mb-0.5 sm:mb-1" aria-hidden="true" />
              <span className="truncate max-w-full px-1">More</span>
            </button>
          </SheetTrigger>
          <SheetContent 
            side="right" 
            className="p-0 w-[85vw] max-w-sm flex flex-col bg-[hsl(var(--super-admin-surface))] border-white/10 z-modal"
            style={{
              height: '100dvh',
              maxHeight: '100dvh',
              top: 0,
              bottom: 0,
              position: 'fixed'
            }}
          >
            <div className="flex flex-col h-full">
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-[hsl(var(--super-admin-surface))]/80 flex-shrink-0">
                <span className="text-sm font-medium text-[hsl(var(--super-admin-text))]">Navigation</span>
                <button
                  onClick={() => setOpen(false)}
                  className="p-2 hover:bg-white/5 rounded-lg transition-colors min-h-[48px] min-w-[48px] flex items-center justify-center"
                  aria-label="Close menu"
                >
                  <X className="h-5 w-5 text-[hsl(var(--super-admin-text))]" />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto pb-safe min-h-0">
                <SidebarProvider>
                  <SaasAdminSidebar />
                </SidebarProvider>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
    </MobileErrorBoundary>
    </>
  );
}
