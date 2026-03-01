/**
 * Adaptive Sidebar Component
 * 
 * Main sidebar component that replaces TenantAdminSidebar
 * Adapts based on operation size, role, tier, and user preferences
 */
import { logger } from '@/lib/logger';

import { useParams, useLocation, useNavigate } from 'react-router-dom';
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LogOut, Settings, Settings2, ChevronDown, User, HelpCircle, RefreshCw, Search, Plus, ShoppingCart, LayoutDashboard, Package } from 'lucide-react';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useTenantFeatureToggles } from '@/hooks/useTenantFeatureToggles';
import { useSidebarConfig } from '@/hooks/useSidebarConfig';
import { useSidebarMigration } from '@/hooks/useSidebarMigration';
import { SidebarProvider as ContextProvider, useSidebar } from './SidebarContext';
import { SidebarSection } from './SidebarSection';
import { SidebarHotItems } from './SidebarHotItems';
import { SidebarFavorites } from './SidebarFavorites';
import { SidebarRecentlyUsed } from './SidebarRecentlyUsed';
import { SidebarSearch } from './SidebarSearch';
import { UpgradeModal } from '@/components/tenant-admin/UpgradeModal';
import { useState, Suspense, useMemo, useCallback } from 'react';
import type { FeatureId } from '@/lib/featureConfig';
import { Skeleton } from '@/components/ui/skeleton';
import { isRouteActive } from '@/lib/sidebar/isRouteActive';
import { CreditBalance } from '@/components/credits';
import { useCommandPaletteStore } from '@/components/tenant-admin/CommandPalette';
import { SidebarLoadingSkeleton } from './SidebarLoadingSkeleton';

/**
 * Static preset display names - hoisted outside component to avoid recreation on every render
 * This is a performance optimization as these values never change
 */
const PRESET_DISPLAY_NAMES: Record<string, string> = {
  default: 'Default',
  minimal: 'Minimal',
  sales_focus: 'Sales',
  operations_focus: 'Operations',
  financial_focus: 'Financial',
  full_featured: 'Full'
};

interface AdaptiveSidebarInnerProps {
  collapsible?: "offcanvas" | "icon" | "none";
}

/**
 * Inner sidebar component that uses context
 */
export function AdaptiveSidebarInner({ collapsible = "offcanvas" }: AdaptiveSidebarInnerProps) {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { tenant, logout } = useTenantAdminAuth();
  const { sidebarConfig, hotItems, favorites, operationSize: _operationSize, isLoading } = useSidebarConfig();
  const { trackFeatureClick, toggleFavorite: _toggleFavorite, preferences, searchQuery, setSearchQuery } = useSidebar();
  const [upgradeFeatureId, setUpgradeFeatureId] = useState<FeatureId | null>(null);
  const { flags } = useTenantFeatureToggles();

  // Run storage migration on mount
  useSidebarMigration();

  const currentPreset = preferences?.layoutPreset || 'default';

  /**
   * Memoize navigation items to prevent unnecessary re-renders
   *
   * Dependencies explained:
   * - sidebarConfig: The main navigation configuration from useSidebarConfig
   * - hotItems: Quick access items based on business context
   * - favorites: User's favorited navigation items
   *
   * All three come from useSidebarConfig() which already memoizes them internally,
   * but we memoize the derived booleans here to avoid recalculating on each render
   */
  const navItems = useMemo(() => {
    // Defensive: ensure arrays are valid (useSidebarConfig should already return arrays)
    const safeHotItems = Array.isArray(hotItems) ? hotItems : [];
    const safeFavorites = Array.isArray(favorites) ? favorites : [];
    const safeSidebarConfig = Array.isArray(sidebarConfig) ? sidebarConfig : [];

    return {
      sidebarConfig: safeSidebarConfig,
      hotItems: safeHotItems,
      favorites: safeFavorites,
      // Pre-compute boolean checks to avoid recalculating in JSX
      hasHotItems: safeHotItems.length > 0,
      hasFavorites: safeFavorites.length > 0,
      hasSections: safeSidebarConfig.length > 0,
    };
  }, [sidebarConfig, hotItems, favorites]);

  /**
   * Memoize preset display name
   * Dependencies: currentPreset (derived from preferences?.layoutPreset)
   * Uses hoisted PRESET_DISPLAY_NAMES constant (no dependency needed for static values)
   */
  const currentPresetDisplayName = useMemo(
    () => PRESET_DISPLAY_NAMES[currentPreset] || currentPreset,
    [currentPreset]
  );

  // All hooks must be called before any early returns to follow React's rules of hooks
  const isActive = useCallback((url: string) => {
    if (!tenantSlug) return false;
    return isRouteActive(url, tenantSlug, location.pathname, location.search);
  }, [tenantSlug, location.pathname, location.search]);

  const handleLogout = useCallback(async () => {
    await logout();
  }, [logout]);

  const handleLockedItemClick = useCallback((featureId: FeatureId) => {
    setUpgradeFeatureId(featureId);
  }, []);

  const handleItemClick = useCallback((_itemId: string, featureId?: string) => {
    if (featureId) {
      trackFeatureClick(featureId);
    }
  }, [trackFeatureClick]);

  // Memoize navigation handlers to prevent unnecessary re-renders of child components
  const handleNavigateToDashboard = useCallback(() => {
    if (tenantSlug) navigate(`/${tenantSlug}/admin/dashboard`);
  }, [navigate, tenantSlug]);

  const handleNavigateToSettings = useCallback(() => {
    if (tenantSlug) navigate(`/${tenantSlug}/admin/settings`);
  }, [navigate, tenantSlug]);

  const handleNavigateToProfile = useCallback(() => {
    if (tenantSlug) navigate(`/${tenantSlug}/admin/profile`);
  }, [navigate, tenantSlug]);

  const handleNavigateToHelp = useCallback(() => {
    if (tenantSlug) navigate(`/${tenantSlug}/admin/help`);
  }, [navigate, tenantSlug]);

  const handleNavigateToNewOrder = useCallback(() => {
    if (tenantSlug) navigate(`/${tenantSlug}/admin/orders/new`);
  }, [navigate, tenantSlug]);

  const handleNavigateToNewProduct = useCallback(() => {
    if (tenantSlug) navigate(`/${tenantSlug}/admin/inventory/products/new`);
  }, [navigate, tenantSlug]);

  const handleNavigateToPOS = useCallback(() => {
    if (tenantSlug) navigate(`/${tenantSlug}/admin/pos-system`);
  }, [navigate, tenantSlug]);

  const handleNavigateToSettingsSidebar = useCallback(() => {
    if (tenantSlug) navigate(`/${tenantSlug}/admin/settings?tab=sidebar`);
  }, [navigate, tenantSlug]);

  const handleNavigateToFeatures = useCallback(() => {
    if (tenantSlug) navigate(`/${tenantSlug}/admin/settings-hub?tab=features`);
  }, [navigate, tenantSlug]);

  // Guard against missing tenant slug - AFTER all hooks are called
  if (!tenantSlug) {
    logger.error('AdaptiveSidebar rendered without tenantSlug', new Error('Missing tenantSlug'), { component: 'AdaptiveSidebar' });
    return null;
  }

  // Show loading skeleton while navigation config is loading
  if (isLoading) {
    return <SidebarLoadingSkeleton collapsible={collapsible} />;
  }

  return (
    <>
      <Sidebar data-tutorial="navigation-sidebar" collapsible={collapsible} className="dark:bg-gray-900 dark:text-white">
        {/* Streamlined Header with Integrated Credits */}
        <SidebarHeader className="p-0 border-b group-data-[collapsible=icon]:p-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-full p-3 flex items-center gap-3 hover:bg-accent/50 transition-colors group cursor-pointer group-data-[collapsible=icon]:p-2 group-data-[collapsible=icon]:justify-center">
                <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center text-white font-bold text-base flex-shrink-0 group-hover:scale-105 transition-transform group-data-[collapsible=icon]:w-8 group-data-[collapsible=icon]:h-8">
                  {tenant?.slug?.charAt(0).toUpperCase() || "T"}
                </div>
                <div className="flex flex-col min-w-0 flex-1 gap-0 group-data-[collapsible=icon]:hidden">
                  <span className="font-semibold text-sm truncate">{tenant?.slug || "Tenant Admin"}</span>
                  <div className="flex items-center gap-1.5">
                    <CreditBalance variant="badge" showLabel={false} />
                  </div>
                </div>
                <ChevronDown className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors flex-shrink-0 group-data-[collapsible=icon]:hidden" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuItem onClick={handleNavigateToDashboard}>
                <LayoutDashboard className="h-4 w-4 mr-2" />
                Dashboard
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleNavigateToSettings}>
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleNavigateToProfile}>
                <User className="h-4 w-4 mr-2" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleNavigateToHelp}>
                <HelpCircle className="h-4 w-4 mr-2" />
                Help & Support
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-destructive focus-visible:text-destructive">
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarHeader>

        {/* Unified Search & Quick Actions Bar — hidden when collapsed */}
        <div className="px-3 py-2 border-b space-y-2 group-data-[collapsible=icon]:hidden">
          {/* Menu Filter Search */}
          <SidebarSearch
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Filter menu..."
          />

          {/* Command Palette Trigger - only show when not filtering */}
          {!searchQuery && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-muted-foreground hover:text-foreground h-8 text-xs"
              onClick={() => useCommandPaletteStore.getState().setOpen(true)}
            >
              <Search className="mr-2 h-3.5 w-3.5" />
              <span className="flex-1 text-left">Commands & Search...</span>
              <kbd className="pointer-events-none hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
                ⌘K
              </kbd>
            </Button>
          )}

          {/* Quick Actions */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="flex-1 h-8 text-xs gap-1.5"
              onClick={handleNavigateToNewOrder}
            >
              <Plus className="h-3.5 w-3.5" />
              Order
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="flex-1 h-8 text-xs gap-1.5"
              onClick={handleNavigateToNewProduct}
            >
              <Package className="h-3.5 w-3.5" />
              Product
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="flex-1 h-8 text-xs gap-1.5"
              onClick={handleNavigateToPOS}
            >
              <ShoppingCart className="h-3.5 w-3.5" />
              POS
            </Button>
          </div>
        </div>

        <SidebarContent>
          <Suspense fallback={
            <div className="p-4 space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          }>
            {/* Recently Used Section */}
            <SidebarRecentlyUsed />

            {/* Hot Items Section */}
            {navItems.hasHotItems && (
              <SidebarHotItems />
            )}

            {/* Favorites Section */}
            {navItems.hasFavorites && (
              <SidebarFavorites />
            )}

            {/* Main Sections */}
            {navItems.hasSections ? (
              navItems.sidebarConfig.map((section) => (
                <SidebarSection
                  key={section.section}
                  section={section}
                  isActive={isActive}
                  onItemClick={handleItemClick}
                  onLockedItemClick={handleLockedItemClick}
                />
              ))
            ) : (
              /* Phase 4: Improved empty state */
              <div className="p-6 text-center space-y-4">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">
                    No menu items available
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Layout: <span className="font-semibold">{currentPresetDisplayName}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {tenant ? `Tenant: ${tenant.slug}` : 'Loading tenant...'}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    logger.info('Manual sidebar reload triggered', { component: 'AdaptiveSidebar' });
                    window.location.reload();
                  }}
                  className="w-full"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Reload Navigation
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleNavigateToSettingsSidebar}
                  className="w-full"
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Go to Settings
                </Button>
              </div>
            )}
          </Suspense>
        </SidebarContent>

        {/* Useful Footer with Quick Links */}
        <SidebarFooter className="p-2 border-t group-data-[collapsible=icon]:p-1 bg-sidebar">
          <div className="flex items-center justify-between gap-1 group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:gap-0.5">
            <Button
              variant="ghost"
              size="sm"
              className="flex-1 h-8 text-xs text-muted-foreground hover:text-foreground group-data-[collapsible=icon]:w-8 group-data-[collapsible=icon]:h-8 group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:flex-none"
              onClick={handleNavigateToSettings}
              title="Settings"
            >
              <Settings className="h-3.5 w-3.5 mr-1 group-data-[collapsible=icon]:mr-0" />
              <span className="group-data-[collapsible=icon]:hidden">Settings</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="flex-1 h-8 text-xs text-muted-foreground hover:text-foreground group-data-[collapsible=icon]:w-8 group-data-[collapsible=icon]:h-8 group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:flex-none"
              onClick={handleNavigateToHelp}
              title="Help"
            >
              <HelpCircle className="h-3.5 w-3.5 mr-1 group-data-[collapsible=icon]:mr-0" />
              <span className="group-data-[collapsible=icon]:hidden">Help</span>
            </Button>
          </div>
          {/* Features count — desktop only, useless on mobile */}
          <button
            onClick={handleNavigateToFeatures}
            className="hidden md:flex items-center gap-1.5 w-full px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-accent/50 group-data-[collapsible=icon]:hidden"
          >
            <Settings2 className="h-3 w-3" />
            <span>
              {Object.values(flags).filter(Boolean).length} features enabled
              {' · '}
              <span className="underline underline-offset-2">Manage</span>
            </span>
          </button>
          {/* Keyboard shortcuts — desktop only, no keyboard on mobile */}
          <div className="hidden md:block text-[10px] text-muted-foreground/60 text-center mt-1 group-data-[collapsible=icon]:!hidden">
            <kbd className="px-1 py-0.5 rounded bg-muted/50 font-mono">⌘B</kbd> toggle • <kbd className="px-1 py-0.5 rounded bg-muted/50 font-mono">⌘K</kbd> search
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

