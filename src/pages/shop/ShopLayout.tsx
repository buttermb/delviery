/**
 * Shop Layout
 * Customer-facing storefront layout wrapper with navigation
 */

import { useEffect, useState, createContext, useContext } from 'react';
import { Outlet, Link, useParams, useNavigate, useSearchParams } from 'react-router-dom';
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
  AlertTriangle
} from 'lucide-react';
import { logger } from '@/lib/logger';
import { MobileBottomNav } from '@/components/shop/MobileBottomNav';

interface StoreInfo {
  id: string;
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
  theme_config?: any | null;
  operating_hours: Record<string, { open: string; close: string; closed: boolean }>;
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [cartItemCount, setCartItemCount] = useState(0);
  const [ageVerified, setAgeVerified] = useState(false);

  // Check if in preview mode
  const isPreviewMode = searchParams.get('preview') === 'true';

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

  // Load cart from localStorage
  useEffect(() => {
    if (store?.id) {
      const cart = localStorage.getItem(`shop_cart_${store.id}`);
      if (cart) {
        try {
          const items = JSON.parse(cart);
          setCartItemCount(items.reduce((sum: number, item: any) => sum + item.quantity, 0));
        } catch {
          // Invalid cart data
        }
      }
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
      <div className="min-h-screen bg-background">
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
      <div className="min-h-screen bg-background flex items-center justify-center">
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
      <div className="min-h-screen bg-background flex items-center justify-center">
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

  // Age verification gate (skip in preview mode)
  if (store.require_age_verification && !ageVerified && !isPreviewMode) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
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

  // SEO: Update page title
  useEffect(() => {
    if (store?.store_name) {
      document.title = store.tagline
        ? `${store.store_name} | ${store.tagline}`
        : `${store.store_name} | Best Cannabis Delivery`;
    }
  }, [store?.store_name, store?.tagline]);

  return (
    <ShopContext.Provider value={{ store, isLoading, cartItemCount, setCartItemCount, isPreviewMode }}>
      <div className="min-h-screen bg-background" style={themeStyles}>
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

        {/* Header */}
        <header className="sticky top-0 z-50 bg-white border-b shadow-sm">
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
                  to={`/shop/${storeSlug}/products${isPreviewMode ? '?preview=true' : ''}`}
                  className="text-sm font-medium hover:text-primary transition-colors"
                >
                  Products
                </Link>
                {!isStoreOpen() && !isPreviewMode && (
                  <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                    <Clock className="w-3 h-3 mr-1" />
                    Currently Closed
                  </Badge>
                )}
              </nav>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" className="hidden md:flex">
                  <Search className="w-5 h-5" />
                </Button>
                {!isPreviewMode && (
                  <>
                    <Link to={`/shop/${storeSlug}/cart`}>
                      <Button variant="ghost" size="icon" className="relative">
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
              <nav className="md:hidden py-4 border-t mt-3">
                <div className="flex flex-col gap-2">
                  <Link
                    to={`/shop/${storeSlug}/products${isPreviewMode ? '?preview=true' : ''}`}
                    className="py-2 px-4 rounded-lg hover:bg-muted"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Products
                  </Link>
                  {!isPreviewMode && (
                    <>
                      <Link
                        to={`/shop/${storeSlug}/cart`}
                        className="py-2 px-4 rounded-lg hover:bg-muted"
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        Cart ({cartItemCount})
                      </Link>
                      <Link
                        to={`/shop/${storeSlug}/account`}
                        className="py-2 px-4 rounded-lg hover:bg-muted"
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

        {/* Footer */}
        <footer className="border-t mt-16 bg-muted/50 pb-20 md:pb-0">
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
          />
        )}
      </div>
    </ShopContext.Provider>
  );
}
