/**
 * Adaptive Sidebar Component
 * 
 * Main sidebar component that replaces TenantAdminSidebar
 * Adapts based on operation size, role, tier, and user preferences
 */

import { NavLink, useParams, useLocation, useNavigate } from 'react-router-dom';
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
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LogOut, Settings, ChevronDown, User, HelpCircle, Layout } from 'lucide-react';
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

interface AdaptiveSidebarInnerProps {
  collapsible?: "offcanvas" | "icon" | "none";
}

/**
 * Inner sidebar component that uses context
 */
export function AdaptiveSidebarInner({ collapsible = "offcanvas" }: AdaptiveSidebarInnerProps) {
  const { tenantSlug } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { tenant, logout } = useTenantAdminAuth();
  const { sidebarConfig, hotItems, favorites, operationSize } = useSidebarConfig();
  const { trackFeatureClick, toggleFavorite, preferences } = useSidebar();
  const [upgradeFeatureId, setUpgradeFeatureId] = useState<FeatureId | null>(null);
  
  // Run storage migration on mount
  useSidebarMigration();

  const currentPreset = preferences?.layoutPreset || 'default';
  const presetNames: Record<string, string> = {
    default: 'Default',
    minimal: 'Minimal',
    sales_focus: 'Sales',
    operations_focus: 'Operations',
    financial_focus: 'Financial',
    full_featured: 'Full'
  };

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
      <Sidebar data-tutorial="navigation-sidebar" collapsible={collapsible}>
        <SidebarHeader className="p-0 border-b">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-full p-3 sm:p-4 flex items-center gap-2 hover:bg-accent/50 transition-colors group cursor-pointer relative overflow-hidden">
                {/* Subtle pulse animation on the background */}
                <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                
                <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-white font-bold text-base sm:text-lg flex-shrink-0 relative z-10 group-hover:scale-110 transition-transform">
                  {tenant?.slug?.charAt(0).toUpperCase() || "T"}
                </div>
                <div className="flex flex-col min-w-0 flex-1 relative z-10">
                  <span className="font-semibold text-xs sm:text-sm truncate">{tenant?.slug || "Tenant Admin"}</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] sm:text-xs text-muted-foreground">Business Admin</span>
                    <Badge 
                      variant="secondary" 
                      className="text-[9px] px-1.5 py-0 h-4 cursor-pointer hover:bg-primary/10 transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/${tenantSlug}/admin/settings?tab=sidebar`);
                      }}
                    >
                      <Layout className="h-2.5 w-2.5 mr-0.5" />
                      {presetNames[currentPreset]}
                    </Badge>
                  </div>
                </div>
                <ChevronDown className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors relative z-10 group-hover:translate-y-0.5 transition-transform" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuItem onClick={() => navigate(`/${tenantSlug}/admin/settings`)}>
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate(`/${tenantSlug}/admin/profile`)}>
                <User className="h-4 w-4 mr-2" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate(`/${tenantSlug}/admin/help`)}>
                <HelpCircle className="h-4 w-4 mr-2" />
                Help & Support
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
          <div className="text-xs text-muted-foreground text-center">
            Click header for quick actions
          </div>
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
export function AdaptiveSidebar({ collapsible = "offcanvas" }: AdaptiveSidebarInnerProps = {}) {
  return (
    <ContextProvider>
      <AdaptiveSidebarInner collapsible={collapsible} />
    </ContextProvider>
  );
}

