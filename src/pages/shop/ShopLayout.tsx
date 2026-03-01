/**
 * Shop Layout
 * Customer-facing storefront layout wrapper with navigation
 * Supports multiple themes including luxury dark theme
 */

import { useEffect, useState, createContext, useContext } from 'react';
import { Outlet, Link, useParams, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ShoppingCart,
  Menu,
  X,
  User,
  Search,
  Clock,
  AlertTriangle,
  Store,
  Share2,
} from 'lucide-react';
import { logger } from '@/lib/logger';
import { getThemeById, applyCSSVariables } from '@/lib/storefrontThemes';
import { MobileBottomNav } from '@/components/shop/MobileBottomNav';
import { LuxuryNav } from '@/components/shop/LuxuryNav';
import { LuxuryFooter } from '@/components/shop/LuxuryFooter';
import { FloatingCartButton } from '@/components/shop/FloatingCartButton';
import { LuxuryAgeVerification } from '@/components/shop/LuxuryAgeVerification';
import { StorefrontAgeGate } from '@/components/shop/StorefrontAgeGate';
import { OfflineIndicator } from '@/components/pwa/OfflineIndicator';
import { CartDrawer } from '@/components/shop/CartDrawer';
import { StorefrontShareDialog } from '@/components/shop/StorefrontShareDialog';
import { useShopCart } from '@/hooks/useShopCart';
import { queryKeys } from '@/lib/queryKeys';
import { STORAGE_KEYS } from '@/constants/storageKeys';
import { safeStorage } from '@/utils/safeStorage';

interface StoreInfo {
  id: string;
  tenant_id: string;
  store_name: string;
  slug: string;
  tagline: string | null;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  is_active: boolean;
  is_public: boolean;
  require_age_verification: boolean;
  minimum_age: number;
  layout_config?: Record<string, unknown>[] | null;
  theme_config?: {
    theme_id?: string;
    theme?: 'default' | 'luxury' | 'minimal';
    colors?: {
      primary?: string;
      secondary?: string;
      accent?: string;
      background?: string;
      text?: string;
    };
    typography?: {
      fontFamily?: string;
    };
  } | null;
  operating_hours: Record<string, unknown>;
  // Delivery settings
  free_delivery_threshold?: number;
  default_delivery_fee?: number;
  // Checkout settings
  checkout_settings?: {
    require_phone?: boolean;
    show_delivery_notes?: boolean;
    venmo_handle?: string;
    zelle_email?: string;
  };
  payment_methods?: string[];
  // Analytics
  ga4_measurement_id?: string | null;
}

interface ShopContextType {
  store: StoreInfo | null;
  isLoading: boolean;
  cartItemCount: number;
  setCartItemCount: (count: number) => void;
  isPreviewMode: boolean;
  openCartDrawer: () => void;
}

const ShopContext = createContext<ShopContextType>({
  store: null,
  isLoading: true,
  cartItemCount: 0,
  setCartItemCount: () => { },
  isPreviewMode: false,
  openCartDrawer: () => { },
});

export const useShop = () => useContext(ShopContext);

export default function ShopLayout() {
  const { storeSlug } = useParams<{ storeSlug: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [cartItemCount, setCartItemCount] = useState(0);
  const [ageVerified, setAgeVerified] = useState(false);
  const [cartDrawerOpen, setCartDrawerOpen] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);

  // Check if in preview mode
  const isPreviewMode = searchParams.get('preview') === 'true';

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  // Fetch store by slug
  const { data: store, isLoading, error } = useQuery({
    queryKey: queryKeys.shopPages.store(storeSlug),
    queryFn: async (): Promise<StoreInfo | null> => {
      if (!storeSlug) return null;

      const { data, error } = await supabase
        .rpc('get_marketplace_store_by_slug', { p_slug: storeSlug });

      if (error) {
        logger.error('Failed to fetch store', error, { component: 'ShopLayout' });
        throw error;
      }

      // Return null instead of undefined if no store found
      if (!data || !Array.isArray(data) || data.length === 0) {
        return null;
      }

      return data[0] as unknown as StoreInfo;
    },
    enabled: !!storeSlug,
    retry: false,
  });

  // Cart management via useShopCart for drawer integration
  const shopCart = useShopCart({
    storeId: store?.id,
    onCartChange: setCartItemCount,
  });

  const openCartDrawer = () => setCartDrawerOpen(true);

  // SEO: Update page title - MUST be before conditional returns
  useEffect(() => {
    if (store?.store_name) {
      document.title = store.tagline
        ? `${store.store_name} | ${store.tagline}`
        : `${store.store_name} | Best Cannabis Delivery`;
    }
  }, [store?.store_name, store?.tagline]);

  // Theme: Apply --storefront-* CSS variables and load Google Fonts
  useEffect(() => {
    if (!store?.theme_config) return;

    const themeId = store.theme_config.theme_id;
    const preset = themeId ? getThemeById(themeId) : undefined;
    const root = document.documentElement;
    const { colors, typography } = store.theme_config;

    if (preset) {
      // Apply the full preset CSS variables to <html>
      applyCSSVariables(root, preset);
      root.style.setProperty('--storefront-font-heading', preset.typography.fonts.heading);
      root.style.setProperty('--storefront-font-body', preset.typography.fonts.body);

      // Load Google Fonts for the theme
      const fonts = [preset.typography.fonts.heading, preset.typography.fonts.body];
      const uniqueFonts = [...new Set(fonts)].filter(f => f && f !== 'system-ui');
      if (uniqueFonts.length > 0) {
        const fontParam = uniqueFonts.map(f => f.replace(/ /g, '+')).join('&family=');
        const linkId = 'storefront-theme-fonts';
        let link = document.getElementById(linkId) as HTMLLinkElement | null;
        if (!link) {
          link = document.createElement('link');
          link.id = linkId;
          link.rel = 'stylesheet';
          document.head.appendChild(link);
        }
        link.href = `https://fonts.googleapis.com/css2?family=${fontParam}:wght@300;400;500;600;700&display=swap`;
      }

      logger.debug('Applied theme preset CSS variables', { themeId });
    } else if (colors) {
      // Fallback: apply custom colors from theme_config directly
      if (colors.background) root.style.setProperty('--storefront-bg', colors.background);
      if (colors.text) root.style.setProperty('--storefront-text', colors.text);
      if (colors.primary) root.style.setProperty('--storefront-primary', colors.primary);
      if (colors.accent) root.style.setProperty('--storefront-accent', colors.accent);
      if (typography?.fontFamily) {
        root.style.setProperty('--storefront-font-body', typography.fontFamily);
        root.style.setProperty('--storefront-font-heading', typography.fontFamily);
      }

      logger.debug('Applied custom theme colors', { colors });
    }

    return () => {
      // Cleanup: remove CSS variables when unmounting
      const props = [
        '--storefront-bg', '--storefront-text', '--storefront-primary', '--storefront-accent',
        '--storefront-card-bg', '--storefront-border', '--storefront-radius', '--storefront-shadow',
        '--storefront-font-heading', '--storefront-font-body',
      ];
      props.forEach(prop => root.style.removeProperty(prop));
    };
  }, [store?.theme_config]);

  // GA4 Analytics: Inject Google Analytics script
  useEffect(() => {
    if (store?.ga4_measurement_id && !isPreviewMode) {
      const measurementId = store.ga4_measurement_id;

      // Check if script already exists
      if (document.getElementById('ga4-script')) return;

      // Add gtag.js script
      const script = document.createElement('script');
      script.id = 'ga4-script';
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
      document.head.appendChild(script);

      // Initialize gtag
      const inlineScript = document.createElement('script');
      inlineScript.id = 'ga4-inline';
      inlineScript.textContent = `
        window.dataLayer = window.dataLayer ?? [];
        function gtag(){dataLayer.push(arguments);}
        gtag('js', new Date());
        gtag('config', '${measurementId}', {
          page_path: window.location.pathname,
          send_page_view: true
        });
      `;
      document.head.appendChild(inlineScript);

      // Track page view on route changes
      return () => {
        const existingScript = document.getElementById('ga4-script');
        const existingInline = document.getElementById('ga4-inline');
        if (existingScript) existingScript.remove();
        if (existingInline) existingInline.remove();
      };
    }
  }, [store?.ga4_measurement_id, isPreviewMode]);

  // Load cart from localStorage and listen for updates
  useEffect(() => {
    if (store?.id) {
      // Initial load
      const loadCart = () => {
        const cart = safeStorage.getItem(`${STORAGE_KEYS.SHOP_CART_PREFIX}${store.id}`);
        if (cart) {
          try {
            const items = JSON.parse(cart);
            setCartItemCount(items.reduce((sum: number, item: { quantity: number }) => sum + item.quantity, 0));
          } catch {
            // Invalid cart data
          }
        }
      };

      loadCart();

      // Listen for cart updates from useShopCart hook
      const handleCartUpdate = ((event: CustomEvent<{ storeId: string; count: number }>) => {
        if (event.detail?.storeId === store.id && typeof event.detail?.count === 'number') {
          setCartItemCount(event.detail.count);
        } else {
          // Fallback: reload from localStorage
          loadCart();
        }
      }) as EventListener;

      window.addEventListener('cartUpdated', handleCartUpdate);
      return () => window.removeEventListener('cartUpdated', handleCartUpdate);
    }
  }, [store?.id]);

  // Check age verification
  useEffect(() => {
    if (store?.require_age_verification) {
      const verified = safeStorage.getItem(`${STORAGE_KEYS.AGE_VERIFIED_PREFIX}${store.id}`);
      setAgeVerified(verified === 'true');
    } else {
      setAgeVerified(true);
    }
  }, [store]);
  // Check if store is open
  const isStoreOpen = () => {
    if (!store?.operating_hours) return true;

    const now = new Date();
    const dayName = now.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    const hours = store.operating_hours[dayName] as { open: string; close: string; closed: boolean } | undefined;

    if (!hours || hours.closed) return false;

    const currentTime = now.toTimeString().slice(0, 5);
    return currentTime >= hours.open && currentTime <= hours.close;
  };

  // Handle age verification
  const handleAgeVerification = (verified: boolean) => {
    if (verified && store?.id) {
      safeStorage.setItem(`${STORAGE_KEYS.AGE_VERIFIED_PREFIX}${store.id}`, 'true');
      setAgeVerified(true);
    } else {
      navigate('/');
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-dvh bg-background">
        <header className="border-b">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <Skeleton className="h-10 w-40" />
            <div className="flex gap-4">
              <Skeleton className="h-10 w-10 rounded-full" />
              <Skeleton className="h-10 w-10 rounded-full" />
            </div>
          </div>
        </header>
        <main id="main-content" tabIndex={-1} className="container mx-auto px-4 py-8 focus:outline-none">
          <Skeleton className="h-64 w-full mb-8" />
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-48 sm:h-64" />
            ))}
          </div>
        </main>
      </div>
    );
  }

  // Store not found — styled 404 page
  if (error || !store) {
    return (
      <div className="min-h-dvh bg-gradient-to-b from-muted/40 to-background flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-muted">
            <Store className="h-12 w-12 text-muted-foreground" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight mb-3">Store Not Found</h1>
          <p className="text-muted-foreground mb-2">
            The store you&apos;re looking for doesn&apos;t exist or has been taken offline.
          </p>
          <p className="text-sm text-muted-foreground mb-8">
            Check the URL and try again.
          </p>
          <Button onClick={() => navigate('/')} size="lg">
            Go Home
          </Button>
        </div>
      </div>
    );
  }

  // Store inactive - show different message for public vs preview
  if (!store.is_active && !isPreviewMode) {
    return (
      <div className="min-h-dvh bg-background flex items-center justify-center">
        <div className="text-center">
          <Clock className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
          <h1 className="text-2xl font-bold mb-2">Coming Soon</h1>
          <p className="text-muted-foreground">
            This store is getting ready to launch. Check back soon!
          </p>
        </div>
      </div>
    );
  }

  // Determine if using luxury theme - defensive null check
  const isLuxuryTheme = store?.theme_config?.theme === 'luxury' || store?.theme_config?.theme_id === 'luxury';

  // Age verification gate (skip in preview mode)
  if (store.require_age_verification && !ageVerified && !isPreviewMode) {
    // Use luxury age verification for luxury theme
    if (isLuxuryTheme) {
      return (
        <LuxuryAgeVerification
          storeName={store.store_name}
          logoUrl={store.logo_url}
          minimumAge={store.minimum_age}
          storeId={store.id}
          onVerify={(verified) => handleAgeVerification(verified)}
        />
      );
    }

    return (
      <div
        className="min-h-dvh flex items-center justify-center"
        style={{ backgroundColor: store.primary_color }}
      >
        <div className="bg-white dark:bg-zinc-950 rounded-lg shadow-xl p-8 max-w-md w-full mx-4">
          {store.logo_url && (
            <img
              src={store.logo_url}
              alt={store.store_name}
              className="h-16 mx-auto mb-6"
            />
          )}
          <h1 className="text-2xl font-bold text-center mb-2">Age Verification Required</h1>
          <p className="text-center text-muted-foreground mb-6">
            You must be {store.minimum_age}+ years old to access this store.
          </p>
          <div className="flex gap-4">
            <Button
              className="flex-1"
              variant="outline"
              onClick={() => handleAgeVerification(false)}
            >
              I'm Under {store.minimum_age}
            </Button>
            <Button
              className="flex-1"
              style={{ backgroundColor: store.primary_color }}
              onClick={() => handleAgeVerification(true)}
            >
              I'm {store.minimum_age}+
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Apply theme colors — merge legacy vars with storefront theme preset
  const resolvedPreset = store.theme_config?.theme_id
    ? getThemeById(store.theme_config.theme_id)
    : undefined;

  const themeStyles = {
    '--store-primary': store.theme_config?.colors?.primary || store.primary_color,
    '--store-secondary': store.theme_config?.colors?.secondary || store.secondary_color,
    '--store-accent': store.theme_config?.colors?.accent || store.accent_color,
    ...(resolvedPreset ? {
      '--storefront-bg': resolvedPreset.cssVariables['--storefront-bg'],
      '--storefront-text': resolvedPreset.cssVariables['--storefront-text'],
      '--storefront-primary': resolvedPreset.cssVariables['--storefront-primary'],
      '--storefront-accent': resolvedPreset.cssVariables['--storefront-accent'],
      '--storefront-card-bg': resolvedPreset.cssVariables['--storefront-card-bg'],
      '--storefront-border': resolvedPreset.cssVariables['--storefront-border'],
      '--storefront-radius': resolvedPreset.cssVariables['--storefront-radius'],
      '--storefront-shadow': resolvedPreset.cssVariables['--storefront-shadow'],
      backgroundColor: resolvedPreset.cssVariables['--storefront-bg'],
      color: resolvedPreset.cssVariables['--storefront-text'],
    } : store.theme_config?.colors ? {
      '--storefront-primary': store.theme_config.colors.primary,
      '--storefront-accent': store.theme_config.colors.accent,
      '--storefront-bg': store.theme_config.colors.background,
      '--storefront-text': store.theme_config.colors.text,
      backgroundColor: store.theme_config.colors.background ?? undefined,
      color: store.theme_config.colors.text ?? undefined,
    } : {}),
  } as React.CSSProperties;

  // Get accent color for theme elements
  const accentColor = store.theme_config?.colors?.accent || store.accent_color || '#10b981';

  // Luxury theme layout
  if (isLuxuryTheme) {
    return (
      <ShopContext.Provider value={{ store, isLoading, cartItemCount, setCartItemCount, isPreviewMode, openCartDrawer }}>
        <div className="min-h-dvh bg-shop-bg text-neutral-900" style={themeStyles} data-testid="storefront-wrapper" data-theme="luxury">
          {/* Admin Preview Banner */}
          {isPreviewMode && (
            <div className="bg-amber-500 text-amber-950 px-4 py-2 text-center font-medium flex items-center justify-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              <span>Preview Mode - This store is not yet live</span>
              {!store.is_active && (
                <Badge variant="secondary" className="ml-2 bg-amber-600 text-white">
                  Draft
                </Badge>
              )}
            </div>
          )}

          {/* Luxury Navigation */}
          <LuxuryNav
            cartItemCount={cartItemCount}
          />

          {/* Main Content */}
          <main id="main-content" tabIndex={-1} className="focus:outline-none">
            <Outlet />
          </main>

          {/* Luxury Footer */}
          <LuxuryFooter />

          {/* Floating Cart Button - hide in preview mode */}
          {!isPreviewMode && (
            <FloatingCartButton />
          )}

          {/* Mobile Bottom Navigation - hide in preview mode */}
          {!isPreviewMode && (
            <MobileBottomNav
              cartItemCount={cartItemCount}
              primaryColor="#10b981"
              onCartClick={openCartDrawer}
            />
          )}

          {/* Cart Drawer */}
          <CartDrawer
            isOpen={cartDrawerOpen}
            onClose={() => setCartDrawerOpen(false)}
            items={shopCart.cartItems.map((item) => ({
              productId: item.productId,
              name: item.name,
              price: item.price,
              quantity: item.quantity,
              imageUrl: item.imageUrl,
              variant: item.variant,
            }))}
            onUpdateQuantity={(productId, quantity, variant) => {
              shopCart.setQuantity(productId, quantity, variant);
            }}
            onRemoveItem={(productId, variant) => {
              shopCart.removeItem(productId, variant);
            }}
            accentColor={accentColor}
            deliveryFee={store.default_delivery_fee}
            freeDeliveryThreshold={store.free_delivery_threshold}
          />

          {/* Share Dialog */}
          <StorefrontShareDialog
            open={shareDialogOpen}
            onOpenChange={setShareDialogOpen}
            storeName={store.store_name}
            storeSlug={store.slug}
          />

          {/* Offline Indicator */}
          <OfflineIndicator position="top" showSyncStatus />

          {/* Global Age Gate */}
          <StorefrontAgeGate storeId={store?.id} />
        </div>
      </ShopContext.Provider>
    );
  }

  // Default theme layout
  return (
    <ShopContext.Provider value={{ store, isLoading, cartItemCount, setCartItemCount, isPreviewMode, openCartDrawer }}>
      <div
        className={`min-h-dvh ${resolvedPreset?.darkMode ? 'bg-black' : 'bg-background'}`}
        style={themeStyles}
        data-testid="storefront-wrapper"
        data-theme={store.theme_config?.theme_id || (isLuxuryTheme ? 'luxury' : 'default')}
      >
        {/* Admin Preview Banner */}
        {isPreviewMode && (
          <div className="bg-amber-500 text-amber-950 px-4 py-2 text-center font-medium flex items-center justify-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            <span>Preview Mode - This store is not yet live</span>
            {!store.is_active && (
              <Badge variant="secondary" className="ml-2 bg-amber-600 text-white">
                Draft
              </Badge>
            )}
          </div>
        )}

        {/* Sticky Header */}
        <header className="sticky top-0 z-50 bg-white dark:bg-zinc-950 border-b shadow-sm">
          <div className="container mx-auto px-4 py-3">
            <div className="flex items-center justify-between">
              {/* Logo / Store Name */}
              <Link to={`/shop/${storeSlug}${isPreviewMode ? '?preview=true' : ''}`} className="flex items-center gap-3">
                {store.logo_url ? (
                  <img
                    src={store.logo_url}
                    alt={store.store_name}
                    className="h-10 object-contain"
                  />
                ) : (
                  <span
                    className="text-xl font-bold"
                    style={{ color: store.primary_color }}
                  >
                    {store.store_name}
                  </span>
                )}
              </Link>

              {/* Desktop Navigation */}
              <nav className="hidden md:flex items-center gap-6">
                <Link
                  to={`/shop/${storeSlug}${isPreviewMode ? '?preview=true' : ''}`}
                  className="text-sm font-medium transition-colors hover:text-primary"
                >
                  Home
                </Link>
                <Link
                  to={`/shop/${storeSlug}/products${isPreviewMode ? '?preview=true' : ''}`}
                  className="text-sm font-medium transition-colors hover:text-primary"
                >
                  Products
                </Link>
                <Link
                  to={`/shop/${storeSlug}/deals${isPreviewMode ? '?preview=true' : ''}`}
                  className="text-sm font-medium transition-colors hover:text-primary"
                >
                  Deals
                </Link>
                {!isStoreOpen() && !isPreviewMode && (
                  <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
                    <Clock className="w-3 h-3 mr-1" />
                    Currently Closed
                  </Badge>
                )}
              </nav>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" className="hidden md:flex" aria-label="Search products">
                  <Search className="w-5 h-5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className={`hidden md:flex ${isLuxuryTheme ? 'text-white/70 hover:text-white hover:bg-white/10' : ''}`}
                  onClick={() => setShareDialogOpen(true)}
                  aria-label="Share store"
                >
                  <Share2 className="w-5 h-5" />
                </Button>
                {!isPreviewMode && (
                  <>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="relative"
                      data-testid="cart-button"
                      onClick={openCartDrawer}
                      aria-label="Shopping cart"
                    >
                      <ShoppingCart className="w-5 h-5" />
                      {cartItemCount > 0 && (
                        <Badge
                          className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs"
                          style={{ backgroundColor: store.primary_color }}
                          data-testid="cart-count"
                        >
                          {cartItemCount}
                        </Badge>
                      )}
                    </Button>
                    <Link to={`/shop/${storeSlug}/account`}>
                      <Button variant="ghost" size="icon" aria-label="My account">
                        <User className="w-5 h-5" />
                      </Button>
                    </Link>
                  </>
                )}

                {/* Mobile Menu Button */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="md:hidden"
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
                >
                  {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                </Button>
              </div>
            </div>

            {/* Mobile Menu */}
            {mobileMenuOpen && (
              <nav className="md:hidden py-4 border-t mt-3" role="navigation" aria-label="Mobile menu">
                <div className="flex flex-col gap-2">
                  <Link
                    to={`/shop/${storeSlug}${isPreviewMode ? '?preview=true' : ''}`}
                    className="py-3 px-4 rounded-lg hover:bg-muted min-h-[44px] flex items-center touch-manipulation active:scale-[0.98]"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Home
                  </Link>
                  <Link
                    to={`/shop/${storeSlug}/products${isPreviewMode ? '?preview=true' : ''}`}
                    className="py-3 px-4 rounded-lg hover:bg-muted min-h-[44px] flex items-center touch-manipulation active:scale-[0.98]"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Products
                  </Link>
                  <Link
                    to={`/shop/${storeSlug}/deals${isPreviewMode ? '?preview=true' : ''}`}
                    className="py-3 px-4 rounded-lg hover:bg-muted min-h-[44px] flex items-center touch-manipulation active:scale-[0.98]"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Deals & Promos
                  </Link>
                  <button
                    className="py-3 px-4 rounded-lg hover:bg-muted min-h-[44px] flex items-center gap-2 touch-manipulation active:scale-[0.98] text-left"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      setShareDialogOpen(true);
                    }}
                  >
                    <Share2 className="w-4 h-4" />
                    Share Store
                  </button>
                  {!isPreviewMode && (
                    <>
                      <button
                        className="py-3 px-4 rounded-lg hover:bg-muted min-h-[44px] flex items-center touch-manipulation active:scale-[0.98] text-left"
                        onClick={() => {
                          setMobileMenuOpen(false);
                          openCartDrawer();
                        }}
                      >
                        Cart ({cartItemCount})
                      </button>
                      <Link
                        to={`/shop/${storeSlug}/account`}
                        className="py-3 px-4 rounded-lg hover:bg-muted min-h-[44px] flex items-center touch-manipulation active:scale-[0.98]"
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        Account
                      </Link>
                    </>
                  )}
                </div>
              </nav>
            )}
          </div>
        </header>

        {/* Main Content */}
        <main id="main-content" tabIndex={-1} className="focus:outline-none">
          <Outlet />
        </main>

        {/* Footer */}
        <footer className="border-t mt-16 bg-muted/50 pb-24 md:pb-0">
          <div className="container mx-auto px-4 py-8">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="text-center md:text-left">
                <p className="font-semibold">{store.store_name}</p>
                {store.tagline && (
                  <p className="text-sm text-muted-foreground">{store.tagline}</p>
                )}
              </div>
              {!isPreviewMode && (
                <div className="flex gap-4 text-sm text-muted-foreground">
                  <Link to={`/shop/${storeSlug}/orders`} className="hover:underline">
                    Track Order
                  </Link>
                  <span>•</span>
                  <Link to={`/shop/${storeSlug}/account`} className="hover:underline">
                    Account
                  </Link>
                </div>
              )}
            </div>
            <div className="mt-6 pt-6 border-t text-center text-xs text-muted-foreground">
              © {new Date().getFullYear()} {store.store_name}. All rights reserved.
            </div>
          </div>
        </footer>

        {/* Mobile Bottom Navigation - hide in preview mode */}
        {!isPreviewMode && (
          <MobileBottomNav
            cartItemCount={cartItemCount}
            primaryColor={store.primary_color}
            onCartClick={openCartDrawer}
          />
        )}

        {/* Cart Drawer */}
        <CartDrawer
          isOpen={cartDrawerOpen}
          onClose={() => setCartDrawerOpen(false)}
          items={shopCart.cartItems.map((item) => ({
            productId: item.productId,
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            imageUrl: item.imageUrl,
            variant: item.variant,
          }))}
          onUpdateQuantity={(productId, quantity, variant) => {
            shopCart.setQuantity(productId, quantity, variant);
          }}
          onRemoveItem={(productId, variant) => {
            shopCart.removeItem(productId, variant);
          }}
          accentColor={store.primary_color}
          deliveryFee={store.default_delivery_fee}
          freeDeliveryThreshold={store.free_delivery_threshold}
        />

        {/* Share Dialog */}
        <StorefrontShareDialog
          open={shareDialogOpen}
          onOpenChange={setShareDialogOpen}
          storeName={store.store_name}
          storeSlug={store.slug}
        />

        {/* Offline Indicator */}
        <OfflineIndicator position="top" showSyncStatus />

        {/* Global Age Gate */}
        <StorefrontAgeGate storeId={store?.id} />
      </div>
    </ShopContext.Provider>
  );
}
