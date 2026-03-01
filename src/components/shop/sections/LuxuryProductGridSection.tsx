import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Search, Package } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useShop } from '@/pages/shop/ShopLayout';
import { useShopCart } from '@/hooks/useShopCart';
import { useWishlist } from '@/hooks/useWishlist';
import { toast } from 'sonner';
import { humanizeError } from '@/lib/humanizeError';
import { logger } from '@/lib/logger';
import { ProductQuickViewModal } from './ProductQuickViewModal';
import { CartPreviewPopup } from '../CartPreviewPopup';
import { cn } from '@/lib/utils';
import { StorefrontProductCard, type MarketplaceProduct } from '../StorefrontProductCard';
import { queryKeys } from '@/lib/queryKeys';

export interface LuxuryProductGridSectionProps {
  content?: {
    heading?: string;
    subheading?: string;
    show_search?: boolean;
    max_products?: number;
  };
  styles?: {
    accent_color?: string;
  };
  storeId?: string;
}

// MarketplaceProduct imported from ../StorefrontProductCard

export function LuxuryProductGridSection({ content, styles, storeId }: LuxuryProductGridSectionProps) {
  const { storeSlug } = useParams<{ storeSlug: string }>();
  const { isPreviewMode } = useShop();
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [quickViewProduct, setQuickViewProduct] = useState<MarketplaceProduct | null>(null);
  const [addedProducts, setAddedProducts] = useState<Set<string>>(new Set());
  // toast imported from sonner at top level

  const [lastAddedItem, setLastAddedItem] = useState<{
    name: string;
    price: number;
    imageUrl: string | null;
    quantity: number;
  } | null>(null);

  const { addItem, cartCount, subtotal } = useShopCart({
    storeId,
    onCartChange: () => { },
  });

  const { toggleItem: toggleWishlist, isInWishlist } = useWishlist({ storeId });

  const {
    heading = "Menu",
    subheading = "Live Inventory",
    show_search: _show_search = true,
    max_products = 50
  } = content || {};

  const customAccent = styles?.accent_color || '#015358';

  const { data: products = [], isLoading, error: _error } = useQuery({
    queryKey: queryKeys.shopPages.luxuryProducts(storeId),
    queryFn: async () => {
      if (!storeId || storeId.length < 32) return [];
      try {
        const { data, error } = await supabase
          .rpc('get_marketplace_products', { p_store_id: storeId });
        if (error) {
          logger.error('Failed to fetch products', error);
          return [];
        }
        return (data as unknown as MarketplaceProduct[]) ?? [];
      } catch (err) {
        logger.error('Error fetching products', err);
        return [];
      }
    },
    enabled: !!storeId,
    retry: 2,
  });

  const categories = useMemo(() => {
    return ["All", ...new Set(products.map(p => p.category).filter(Boolean).sort())];
  }, [products]);

  const filteredProducts = useMemo(() => {
    let filtered = products;

    if (debouncedSearch) {
      const query = debouncedSearch.toLowerCase();
      filtered = filtered.filter(p =>
        p.product_name?.toLowerCase().includes(query) ||
        p.category?.toLowerCase().includes(query) ||
        p.strain_type?.toLowerCase().includes(query)
      );
    }

    if (selectedCategory && selectedCategory !== "All") {
      filtered = filtered.filter(p => p.category === selectedCategory);
    }

    return filtered.slice(0, max_products);
  }, [products, debouncedSearch, selectedCategory, max_products]);

  const handleQuickAdd = (e: React.MouseEvent, product: MarketplaceProduct) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      addItem({
        productId: product.product_id,
        name: product.product_name,
        price: product.price,
        imageUrl: product.image_url,
        quantity: 1,
        variant: product.strain_type,
        metrcRetailId: product.metrc_retail_id,
        excludeFromDiscounts: product.exclude_from_discounts,
        minimumPrice: product.minimum_price,
        minExpiryDays: product.min_expiry_days,
      });

      setAddedProducts(prev => new Set(prev).add(product.product_id));
      setLastAddedItem({
        name: product.product_name,
        price: product.price,
        imageUrl: product.image_url,
        quantity: 1
      });

      setTimeout(() => {
        setAddedProducts(prev => {
          const next = new Set(prev);
          next.delete(product.product_id);
          return next;
        });
      }, 2000);
    } catch (error) {
      toast.error('Failed to add', { description: humanizeError(error) });
    }
  };

  const activeCategory = selectedCategory || "All";

  return (
    <section className="min-h-dvh bg-shop-bg pb-32" id="products">

      {/* Search Overlay (if active) */}
      <AnimatePresence>
        {searchQuery && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="border-b"
            style={{ backgroundColor: 'var(--storefront-card-bg, white)', borderColor: 'var(--storefront-border, #e5e7eb)' }}
          >
            <div className="container mx-auto px-4 py-4 flex items-center justify-between">
              <span className="text-sm" style={{ color: 'var(--storefront-text, #737373)', opacity: 0.7 }}>Showing results for <strong>"{searchQuery}"</strong></span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSearchQuery('')}
                style={{ color: 'var(--storefront-text, #a3a3a3)' }}
              >
                Clear Search
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sticky Category Strip - Premium Glassmorphism */}
      <div className="sticky top-20 z-40 backdrop-blur-md border-b shadow-sm transition-all duration-300" style={{ backgroundColor: 'color-mix(in srgb, var(--storefront-bg, white) 80%, transparent)', borderColor: 'var(--storefront-border, rgba(255,255,255,0.2))' }}>
        <div className="container mx-auto px-4 md:px-8">
          <div
            className="flex items-center gap-1 overflow-x-auto py-4 scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0"
            style={{ maskImage: 'linear-gradient(to right, transparent, black 20px, black 90%, transparent)' }}
          >
            {categories.map(cat => {
              const isActive = activeCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat === "All" ? null : cat)}
                  className={cn(
                    "relative px-6 py-2.5 rounded-full text-sm font-bold transition-colors z-10 whitespace-nowrap",
                    isActive ? "text-white" : ""
                  )}
                  style={!isActive ? { color: 'var(--storefront-text, #737373)', opacity: 0.7 } : undefined}
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeCategoryPill"
                      className="absolute inset-0 rounded-full shadow-lg -z-10"
                      style={{ backgroundColor: customAccent }}
                      transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    />
                  )}
                  {cat}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 md:px-8 pt-10">

        {/* Header - Staggered Fade In */}
        {!searchQuery && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-10 pl-1 ml-1"
            style={{ borderLeft: `4px solid ${customAccent}` }}
          >
            <h2 className="text-2xl sm:text-4xl font-extrabold ml-4 tracking-tight" style={{ color: customAccent }}>{heading}</h2>
            {subheading && <p className="ml-4 mt-2 font-medium" style={{ color: 'var(--storefront-text, #737373)', opacity: 0.6 }}>{subheading}</p>}
          </motion.div>
        )}

        {/* Loading State */}
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-6 lg:gap-8">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div key={i} className="rounded-2xl p-4 space-y-4 shadow-sm border" style={{ backgroundColor: 'var(--storefront-card-bg, white)', borderColor: 'var(--storefront-border, #f5f5f5)' }}>
                <Skeleton className="h-56 w-full rounded-xl" style={{ backgroundColor: 'var(--storefront-border, #f5f5f5)' }} />
                <Skeleton className="h-4 w-2/3" style={{ backgroundColor: 'var(--storefront-border, #f5f5f5)' }} />
                <Skeleton className="h-4 w-1/3" style={{ backgroundColor: 'var(--storefront-border, #f5f5f5)' }} />
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 text-center rounded-3xl border border-dashed" style={{ backgroundColor: 'var(--storefront-card-bg, white)', borderColor: 'var(--storefront-border, #d4d4d4)' }} data-testid="empty-product-grid">
            <div className="w-20 h-20 rounded-full flex items-center justify-center mb-6" style={{ backgroundColor: 'var(--storefront-border, #fafafa)', color: 'var(--storefront-text, #d4d4d4)' }}>
              <Package className="w-10 h-10" style={{ opacity: 0.4 }} />
            </div>
            <h3 className="text-2xl font-bold" style={{ color: customAccent }}>Coming soon</h3>
            <p className="mt-2 max-w-md mx-auto" style={{ color: 'var(--storefront-text, #737373)', opacity: 0.6 }}>Check back soon for new arrivals</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 text-center rounded-3xl border border-dashed" style={{ backgroundColor: 'var(--storefront-card-bg, white)', borderColor: 'var(--storefront-border, #d4d4d4)' }}>
            <div className="w-20 h-20 rounded-full flex items-center justify-center mb-6" style={{ backgroundColor: 'var(--storefront-border, #fafafa)', color: 'var(--storefront-text, #d4d4d4)' }}>
              <Search className="w-10 h-10" style={{ opacity: 0.4 }} />
            </div>
            <h3 className="text-2xl font-bold" style={{ color: customAccent }}>No matches found</h3>
            <p className="mt-2 max-w-md mx-auto" style={{ color: 'var(--storefront-text, #737373)', opacity: 0.6 }}>We couldn&apos;t find any products matching your filters.</p>
            <Button
              onClick={() => { setSearchQuery(''); setSelectedCategory(null); }}
              className="mt-8 text-white rounded-full px-8 py-6 text-lg font-bold shadow-lg"
              style={{ backgroundColor: customAccent }}
            >
              View All Products
            </Button>
          </div>
        ) : (
          /* Premium Product Grid */
          <motion.div
            layout
            className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-6 lg:gap-8 pb-20"
          >
            <AnimatePresence>
              {filteredProducts.map((product, index) => (
                <StorefrontProductCard
                  key={product.product_id}
                  product={product}
                  storeSlug={storeSlug}
                  isPreviewMode={isPreviewMode}
                  onQuickAdd={(e) => handleQuickAdd(e, product)}
                  isAdded={addedProducts.has(product.product_id)}
                  onToggleWishlist={() => toggleWishlist({
                    productId: product.product_id,
                    name: product.product_name,
                    price: product.price,
                    imageUrl: product.image_url,
                  })}
                  isInWishlist={isInWishlist(product.product_id)}
                  onQuickView={() => setQuickViewProduct(product)}
                  index={index}
                  accentColor={customAccent}
                />
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </div>

      <CartPreviewPopup
        item={lastAddedItem}
        cartCount={cartCount}
        cartTotal={subtotal}
        storeSlug={storeSlug ?? ''}
        onClose={() => setLastAddedItem(null)}
      />

      <ProductQuickViewModal
        product={quickViewProduct}
        isOpen={!!quickViewProduct}
        onClose={() => setQuickViewProduct(null)}
        onAddToCart={(_p, _a) => { }} // Pass actual handler if needed, currently reusing logic
        accentColor={customAccent}
      />
    </section>
  );
}

// Sub-component for performance and clean logic


// Add simple CSS usage for no-scrollbar utility if not present
// or presume Tailwind class 'scrollbar-hide' exists in utility layer
