/**
 * Adaptive Sidebar Component
 * 
 * Main sidebar component that replaces TenantAdminSidebar
 * Adapts based on operation size, role, tier, and user preferences
 */

import { NavLink, useParams, useLocation } from 'react-router-dom';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { LogOut, Lock } from 'lucide-react';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useSidebarConfig } from '@/hooks/useSidebarConfig';
import { useSidebarMigration } from '@/hooks/useSidebarMigration';
import { SidebarProvider as ContextProvider, useSidebar } from './SidebarContext';
import { SidebarSection } from './SidebarSection';
import { SidebarHotItems } from './SidebarHotItems';
import { SidebarFavorites } from './SidebarFavorites';
import { UpgradeModal } from '@/components/tenant-admin/UpgradeModal';
import { useState, Suspense } from 'react';
import type { FeatureId } from '@/lib/featureConfig';
import { logger } from '@/lib/logger';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Inner sidebar component that uses context
 */
function AdaptiveSidebarInner() {
  const { tenantSlug } = useParams();
  const location = useLocation();
  const { tenant, logout } = useTenantAdminAuth();
  const { sidebarConfig, hotItems, favorites } = useSidebarConfig();
  const { trackFeatureClick, toggleFavorite } = useSidebar();
  const [upgradeFeatureId, setUpgradeFeatureId] = useState<FeatureId | null>(null);
  
  // Run storage migration on mount
  useSidebarMigration();

  // Guard against missing tenant slug
  if (!tenantSlug) {
    logger.error('AdaptiveSidebar rendered without tenantSlug', new Error('Missing tenantSlug'), { component: 'AdaptiveSidebar' });
    return null;
  }

  const isActive = (url: string) => {
    const fullPath = `/${tenantSlug}${url}`;
    return location.pathname === fullPath || location.pathname.startsWith(fullPath + '/');
  };

  const handleLogout = async () => {
    await logout();
  };

  const handleLockedItemClick = (featureId: FeatureId) => {
    setUpgradeFeatureId(featureId);
  };

  const handleItemClick = (itemId: string, featureId?: string) => {
    if (featureId) {
      trackFeatureClick(featureId);
    }
  };

  return (
    <>
      <Sidebar data-tutorial="navigation-sidebar">
        <SidebarHeader className="p-3 sm:p-4 border-b">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-white font-bold text-base sm:text-lg flex-shrink-0">
              {tenant?.slug?.charAt(0).toUpperCase() || "T"}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-semibold text-xs sm:text-sm truncate">{tenant?.slug || "Tenant Admin"}</span>
              <span className="text-xs text-muted-foreground hidden sm:block">Admin Panel</span>
            </div>
          </div>
        </SidebarHeader>
        
        <SidebarContent>
          <Suspense fallback={
            <div className="p-4 space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          }>
            {/* Hot Items Section */}
            {Array.isArray(hotItems) && hotItems.length > 0 && (
              <SidebarHotItems />
            )}

            {/* Favorites Section */}
            {Array.isArray(favorites) && favorites.length > 0 && (
              <SidebarFavorites />
            )}

            {/* Main Sections */}
            {Array.isArray(sidebarConfig) && sidebarConfig.length > 0 ? (
              sidebarConfig.map((section) => (
                <SidebarSection
                  key={section.section}
                  section={section}
                  isActive={isActive}
                  onItemClick={handleItemClick}
                  onLockedItemClick={handleLockedItemClick}
                />
              ))
            ) : (
              <div className="p-4 text-sm text-muted-foreground text-center">
                No menu items available
              </div>
            )}
          </Suspense>
        </SidebarContent>

        <SidebarFooter className="p-3 sm:p-4 border-t">
          <Button
            variant="ghost"
            className="w-full justify-start min-h-[44px] touch-manipulation"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4 mr-2" />
            <span className="text-sm sm:text-base">Logout</span>
          </Button>
        </SidebarFooter>
      </Sidebar>

      {upgradeFeatureId && (
        <UpgradeModal
          open={!!upgradeFeatureId}
          onOpenChange={(open) => !open && setUpgradeFeatureId(null)}
          featureId={upgradeFeatureId}
        />
      )}
    </>
  );
}

/**
 * Main Adaptive Sidebar component with context provider
 */
export function AdaptiveSidebar() {
  return (
    <ContextProvider>
      <AdaptiveSidebarInner />
    </ContextProvider>
  );
}

