import { logger } from '@/lib/logger';
/**
 * SaaS Admin Layout Component - Dark Theme
 * Wraps admin pages with sidebar and header
 */

import { Outlet, useNavigate } from 'react-router-dom';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { SaasAdminSidebar } from './SaasAdminSidebar';
import { SuperAdminMobileBottomNav } from './SuperAdminMobileBottomNav';
import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';
import { useSuperAdminAuth } from '@/contexts/SuperAdminAuthContext';
import { useToast } from '@/hooks/use-toast';

export function SaasAdminLayout() {
  const navigate = useNavigate();
  const { superAdmin, logout } = useSuperAdminAuth();
  const { toast } = useToast();

  const handleSignOut = async () => {
    try {
      await logout();
      toast({
        title: 'Signed out',
        description: 'You have been signed out successfully',
      });
      navigate('/super-admin/login');
    } catch (error) {
      logger.error('Sign out error:', error);
      toast({
        title: 'Error',
        description: 'Failed to sign out',
        variant: 'destructive',
      });
    }
  };

  return (
    <SidebarProvider defaultOpen>
      <div className="min-h-dvh flex w-full bg-[hsl(var(--super-admin-bg))]">
        <SaasAdminSidebar />

        <div className="flex-1 flex flex-col min-h-0">
          {/* Header */}
          <header className="h-14 border-b border-white/10 bg-[hsl(var(--super-admin-surface))]/50 backdrop-blur-xl flex items-center justify-between px-4 sticky top-0 z-10 safe-area-top">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="text-[hsl(var(--super-admin-text))] hover:bg-white/10 hidden lg:flex" />
              <span className="text-sm font-semibold text-[hsl(var(--super-admin-text))] lg:hidden">Platform Admin</span>
            </div>

            <div className="flex items-center gap-2">
              <div className="text-sm text-[hsl(var(--super-admin-text))]/70 hidden sm:block">
                {superAdmin?.email || 'Super Admin'}
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleSignOut}
                title="Sign Out"
                className="text-[hsl(var(--super-admin-text))]/80 hover:bg-white/10 hover:text-[hsl(var(--super-admin-text))]"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </header>

          {/* Main Content */}
          <main className="flex-1 overflow-auto bg-[hsl(var(--super-admin-bg))] pb-20 lg:pb-4 min-h-0">
            <Outlet />
          </main>
        </div>

        {/* Mobile Bottom Navigation */}
        <SuperAdminMobileBottomNav />
      </div>
    </SidebarProvider>
  );
}
