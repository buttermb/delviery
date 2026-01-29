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
  Leaf
} from 'lucide-react';
import { logger } from '@/lib/logger';
import { MobileBottomNav } from '@/components/shop/MobileBottomNav';
import { LuxuryNav } from '@/components/shop/LuxuryNav';
import { LuxuryFooter } from '@/components/shop/LuxuryFooter';
import { FloatingCartButton } from '@/components/shop/FloatingCartButton';
import { LuxuryAgeVerification } from '@/components/shop/LuxuryAgeVerification';
import { StorefrontAgeGate } from '@/components/shop/StorefrontAgeGate';
import { OfflineIndicator } from '@/components/pwa/OfflineIndicator';

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
  layout_config?: any[] | null;
  theme_config?: {
    theme?: 'default' | 'luxury' | 'minimal';
    colors?: {
      primary?: string;
      secondary?: string;
      accent?: string;
      background?: string;
    };
  } | null;
  operating_hours: Record<string, { open: string; close: string; closed: boolean }>;
  // Delivery settings
  free_delivery_threshold?: number;
  default_delivery_fee?: number;
  // Checkout settings
  checkout_settings?: {
    require_phone?: boolean;
    show_delivery_notes?: boolean;
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
}

const ShopContext = createContext<ShopContextType>({
  store: null,
  isLoading: true,
  cartItemCount: 0,
  setCartItemCount: () => { },
  isPreviewMode: false,
});

export const useShop = () => useContext(ShopContext);

export default function ShopLayout() {
  const { storeSlug } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [cartItemCount, setCartItemCount] = useState(0);
  const [ageVerified, setAgeVerified] = useState(false);

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
    queryKey: ['shop-store', storeSlug],
    queryFn: async (): Promise<StoreInfo | null> => {
      if (!storeSlug) return null;

      const { data, error } = await supabase
        .rpc('get_marketplace_store_by_slug' as any, { p_slug: storeSlug });

      if (error) {
        logger.error('Failed to fetch store', error, { component: 'ShopLayout' });
        throw error;
      }

      // Return null instead of undefined if no store found
      if (!data || !Array.isArray(data) || data.length === 0) {
        return null;
      }

      return data[0] as StoreInfo;
    },
    enabled: !!storeSlug,
    retry: false,
  });

  // SEO: Update page title - MUST be before conditional returns
  useEffect(() => {
    if (store?.store_name) {
      document.title = store.tagline
        ? `${store.store_name} | ${store.tagline}`
        : `${store.store_name} | Best Cannabis Delivery`;
    }
  }, [store?.store_name, store?.tagline]);

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
        window.dataLayer = window.dataLayer || [];
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
        const cart = localStorage.getItem(`shop_cart_${store.id}`);
        if (cart) {
          try {
            const items = JSON.parse(cart);
            setCartItemCount(items.reduce((sum: number, item: any) => sum + item.quantity, 0));
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
      const verified = localStorage.getItem(`age_verified_${store.id}`);
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
    const hours = store.operating_hours[dayName];

    if (!hours || hours.closed) return false;

    const currentTime = now.toTimeString().slice(0, 5);
    return currentTime >= hours.open && currentTime <= hours.close;
  };

  // Handle age verification
  const handleAgeVerification = (verified: boolean) => {
    if (verified && store?.id) {
      localStorage.setItem(`age_verified_${store.id}`, 'true');
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
        <main className="container mx-auto px-4 py-8">
          <Skeleton className="h-64 w-full mb-8" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-64" />
            ))}
          </div>
        </main>
      </div>
    );
  }

  // Store not found
  if (error || !store) {
    return (
      <div className="min-h-dvh bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Store Not Found</h1>
          <p className="text-muted-foreground mb-4">
            The store you're looking for doesn't exist or is no longer available.
          </p>
          <Button onClick={() => navigate('/')}>Go Home</Button>
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
  const isLuxuryTheme = store?.theme_config?.theme === 'luxury';

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
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full mx-4">
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

  // Apply theme colors
  const themeStyles = {
    '--store-primary': store.primary_color,
    '--store-secondary': store.secondary_color,
    '--store-accent': store.accent_color,
  } as React.CSSProperties;

  // Get accent color for theme elements
  const accentColor = store.theme_config?.colors?.accent || store.accent_color || '#10b981';

  // Handler for floating cart checkout
  const handleCartCheckout = () => {
    navigate(`/shop/${storeSlug}/checkout`);
  };

  // Luxury theme layout
  if (isLuxuryTheme) {
    return (
      <ShopContext.Provider value={{ store, isLoading, cartItemCount, setCartItemCount, isPreviewMode }}>
        <div className="min-h-dvh bg-[#F5F7F8] text-neutral-900" style={themeStyles}>
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
          <main>
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
            />
          )}

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
    <ShopContext.Provider value={{ store, isLoading, cartItemCount, setCartItemCount, isPreviewMode }}>
      <div
        className={`min-h-dvh ${isLuxuryTheme ? 'bg-black' : 'bg-background'}`}
        style={themeStyles}
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

        {/* Header - Luxury vs Standard */}
        <header className={`sticky top-0 z-50 ${isLuxuryTheme ? 'bg-black/80 backdrop-blur-xl border-b border-white/5' : 'bg-white border-b shadow-sm'}`}>
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
                ) : isLuxuryTheme ? (
                  <div className="flex items-center gap-2">
                    <Leaf className="w-6 h-6" style={{ color: accentColor }} />
                    <span className="text-xl font-light text-white">
                      {store.store_name}
                    </span>
                  </div>
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
                  to={`/shop/${storeSlug}/products${isPreviewMode ? '?preview=true' : ''}`}
                  className={`text-sm font-medium transition-colors ${isLuxuryTheme ? 'text-white/70 hover:text-white' : 'hover:text-primary'}`}
                >
                  Products
                </Link>
                <Link
                  to={`/shop/${storeSlug}/deals${isPreviewMode ? '?preview=true' : ''}`}
                  className={`text-sm font-medium transition-colors ${isLuxuryTheme ? 'text-white/70 hover:text-white' : 'hover:text-primary'}`}
                >
                  Deals
                </Link>
                {!isStoreOpen() && !isPreviewMode && (
                  <Badge variant="secondary" className={isLuxuryTheme ? 'bg-white/10 text-white/70' : 'bg-yellow-100 text-yellow-800'}>
                    <Clock className="w-3 h-3 mr-1" />
                    Currently Closed
                  </Badge>
                )}
              </nav>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" className={`hidden md:flex ${isLuxuryTheme ? 'text-white/70 hover:text-white hover:bg-white/10' : ''}`}>
                  <Search className="w-5 h-5" />
                </Button>
                {!isPreviewMode && (
                  <>
                    <Link to={`/shop/${storeSlug}/cart`} data-testid="cart-button">
                      <Button variant="ghost" size="icon" className="relative" data-testid="cart-count">
                        <ShoppingCart className="w-5 h-5" />
                        {cartItemCount > 0 && (
                          <Badge
                            className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs"
                            style={{ backgroundColor: store.primary_color }}
                          >
                            {cartItemCount}
                          </Badge>
                        )}
                      </Button>
                    </Link>
                    <Link to={`/shop/${storeSlug}/account`}>
                      <Button variant="ghost" size="icon">
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
                  {!isPreviewMode && (
                    <>
                      <Link
                        to={`/shop/${storeSlug}/cart`}
                        className="py-3 px-4 rounded-lg hover:bg-muted min-h-[44px] flex items-center touch-manipulation active:scale-[0.98]"
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        Cart ({cartItemCount})
                      </Link>
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
        <main>
          <Outlet />
        </main>

        {/* Footer - Luxury vs Standard */}
        {isLuxuryTheme ? (
          <LuxuryFooter accentColor={accentColor} />
        ) : (
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
        )}

        {/* Floating Cart Button for Luxury Theme */}
        {isLuxuryTheme && !isPreviewMode && (
          <FloatingCartButton
            primaryColor={accentColor}
            onCheckout={handleCartCheckout}
          />
        )}

        {/* Mobile Bottom Navigation - hide in preview mode and luxury theme */}
        {!isPreviewMode && !isLuxuryTheme && (
          <MobileBottomNav
            cartItemCount={cartItemCount}
            primaryColor={store.primary_color}
          />
        )}

        {/* Offline Indicator */}
        <OfflineIndicator position="top" showSyncStatus />

        {/* Global Age Gate */}
        <StorefrontAgeGate storeId={store?.id} />
      </div>
    </ShopContext.Provider>
  );
}
