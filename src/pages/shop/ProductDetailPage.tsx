/**
 * Product Detail Page — Orchestrator
 * Composes gallery, info panel, and tabs into the full product detail view.
 * Data fetching and business logic live here; rendering is delegated to sub-components.
 */

import { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import type { RpcProduct, ProductDetails, ProductReview } from '@/pages/shop/product-detail/types';
import { transformProduct } from '@/pages/shop/product-detail/types';
import { ProductGallery } from '@/pages/shop/product-detail/ProductGallery';
import { ProductInfo } from '@/pages/shop/product-detail/ProductInfo';
import { ProductTabs } from '@/pages/shop/product-detail/ProductTabs';
import { useJsonLd } from '@/pages/shop/product-detail/useJsonLd';
import { supabase } from '@/integrations/supabase/client';
import { useShop } from './ShopLayout';
import { useLuxuryTheme } from '@/components/shop/luxury';
import { useShopCart } from '@/hooks/useShopCart';
import { useRecentlyViewed } from '@/hooks/useRecentlyViewed';
import { Button } from '@/components/ui/button';
import { ProductDetailSkeleton } from '@/components/shop/ProductDetailSkeleton';
import { EnhancedStickyAddToCart } from '@/components/shop/EnhancedStickyAddToCart';
import { ScrollProgress } from '@/components/shop/ScrollProgress';
import { CartPreviewPopup } from '@/components/shop/CartPreviewPopup';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import { safeJsonParse } from '@/lib/utils/sanitize';
import { queryKeys } from '@/lib/queryKeys';
import { safeStorage } from '@/utils/safeStorage';
import { ChevronRight, Package } from 'lucide-react';
import { cn } from '@/lib/utils';
import { STORAGE_KEYS } from '@/constants/storageKeys';

export function ProductDetailPage() {
  const { storeSlug, productId, productSlug } = useParams<{ storeSlug: string; productId: string; productSlug: string }>();
  const { store, setCartItemCount } = useShop();

  const isSlugBased = !!productSlug && !productId;
  const identifier = productSlug || productId;
  const { isLuxuryTheme, accentColor } = useLuxuryTheme();

  const { addItem, cartCount, subtotal } = useShopCart({
    storeId: store?.id,
    onCartChange: setCartItemCount,
  });

  const [isWishlisted, setIsWishlisted] = useState(false);
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const [lastAddedItem, setLastAddedItem] = useState<{
    name: string;
    price: number;
    imageUrl: string | null;
    quantity: number;
  } | null>(null);

  const { addToRecentlyViewed } = useRecentlyViewed();

  // --- Data Fetching ---

  const { data: product, isLoading: productLoading } = useQuery({
    queryKey: isSlugBased
      ? queryKeys.shopProducts.detailBySlug(store?.id, identifier)
      : queryKeys.shopProducts.detail(store?.id, identifier),
    queryFn: async () => {
      if (!store?.id || !identifier) return null;

      try {
        if (isSlugBased) {
          const { data, error } = await supabase
            .rpc('get_product_by_slug', {
              p_store_id: store.id,
              p_slug: identifier
            });

          if (error) {
            logger.error('Failed to fetch product by slug', error);
            return null;
          }

          if (data && data.length > 0) {
            const item = data[0];
            return {
              product_id: item.product_id,
              name: item.product_name,
              description: item.description,
              short_description: item.description?.substring(0, 150) || null,
              category: item.category,
              price: item.price,
              display_price: item.sale_price || item.price,
              compare_at_price: item.sale_price ? item.price : null,
              image_url: item.image_url,
              images: item.images ?? [],
              in_stock: item.stock_quantity > 0,
              stock_quantity: item.stock_quantity,
              is_featured: item.is_featured,
              marketplace_category_name: item.category,
              variants: [],
              tags: [],
              brand: item.brand,
              sku: item.sku,
              strain_type: item.strain_type,
              thc_content: item.thc_content,
              cbd_content: item.cbd_content,
              metrc_retail_id: (item as unknown as Record<string, unknown>).metrc_retail_id as string ?? null,
              exclude_from_discounts: (item as unknown as Record<string, unknown>).exclude_from_discounts as boolean ?? false,
              minimum_price: (item as unknown as Record<string, unknown>).minimum_price as number ?? null,
              effects: ((item as unknown as Record<string, unknown>).effects as string[]) ?? [],
              slug: item.slug,
            } as ProductDetails & { slug?: string };
          }
          return null;
        } else {
          const { data, error } = await supabase
            .rpc('get_marketplace_products', { p_store_id: store.id });

          if (error) {
            logger.error('Failed to fetch product', error);
            return null;
          }

          const products = (data ?? []).map((item: RpcProduct) => transformProduct(item));
          return products.find((p: ProductDetails) => p.product_id === identifier) || null;
        }
      } catch (err) {
        logger.error('Error fetching product', err);
        return null;
      }
    },
    enabled: !!store?.id && !!identifier,
  });

  const { data: reviews = [] } = useQuery({
    queryKey: queryKeys.shopProducts.reviews(store?.id, product?.product_id),
    queryFn: async () => {
      if (!store?.id || !product?.product_id) return [];

      const { data, error } = await supabase
        .from('marketplace_reviews')
        .select('id, customer_name, rating, title, comment, is_verified_purchase, created_at')
        .eq('store_id', store.id)
        .eq('product_id', product.product_id)
        .eq('is_approved', true)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      return data as ProductReview[];
    },
    enabled: !!store?.id && !!product?.product_id,
  });

  const { data: relatedProducts = [] } = useQuery({
    queryKey: queryKeys.shopProducts.related(store?.id, product?.category || undefined),
    queryFn: async () => {
      if (!store?.id || !product?.category) return [];

      const { data, error } = await supabase
        .rpc('get_marketplace_products', { p_store_id: store.id });

      if (error) throw error;
      return (data ?? [])
        .map((item: RpcProduct) => transformProduct(item))
        .filter((p: ProductDetails) => p.product_id !== product?.product_id && p.category === product.category)
        .slice(0, 4);
    },
    enabled: !!store?.id && !!product?.category,
  });

  // --- Derived State ---

  const averageRating = useMemo(() => {
    if (reviews.length === 0) return 0;
    return reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
  }, [reviews]);

  const allImages = useMemo(() => {
    if (!product) return [];
    const images = product.images?.length ? product.images : [];
    if (product.image_url && !images.includes(product.image_url)) {
      return [product.image_url, ...images];
    }
    return images.length ? images : [product.image_url].filter(Boolean);
  }, [product]);

  const hasDiscount = product?.compare_at_price && product.compare_at_price > product.display_price;
  const discountPercent = hasDiscount
    ? Math.round((1 - product.display_price / product.compare_at_price!) * 100)
    : 0;

  // --- Side Effects ---

  useEffect(() => {
    if (store?.id && product?.product_id) {
      const wishlist = safeJsonParse<string[]>(safeStorage.getItem(`${STORAGE_KEYS.SHOP_WISHLIST_PREFIX}${store.id}`), []);
      setIsWishlisted(wishlist.includes(product.product_id));
    }
  }, [store?.id, product?.product_id]);

  useJsonLd({
    product: product as (ProductDetails & { slug?: string }) | null | undefined,
    store,
    storeSlug,
    allImages,
    reviews,
    averageRating,
    addToRecentlyViewed,
  });

  // --- Handlers ---

  const toggleWishlist = () => {
    if (!store?.id || !product?.product_id) return;

    try {
      const wishlist = safeJsonParse<string[]>(safeStorage.getItem(`${STORAGE_KEYS.SHOP_WISHLIST_PREFIX}${store.id}`), []);
      let newWishlist;

      if (isWishlisted) {
        newWishlist = wishlist.filter((id: string) => id !== product.product_id);
        toast.success('Removed from wishlist');
      } else {
        newWishlist = [...wishlist, product.product_id];
        toast.success('Added to wishlist');
      }

      safeStorage.setItem(`${STORAGE_KEYS.SHOP_WISHLIST_PREFIX}${store.id}`, JSON.stringify(newWishlist));
      setIsWishlisted(!isWishlisted);
    } catch (error) {
      logger.error('Wishlist operation failed', error);
      toast.success(isWishlisted ? 'Removed from wishlist' : 'Added to wishlist');
      setIsWishlisted(!isWishlisted);
    }
  };

  const handleAddToCart = (quantity: number, variant: string | null) => {
    if (!store?.id || !product) return;

    setIsAddingToCart(true);

    addItem({
      productId: product.product_id,
      quantity,
      price: product.display_price,
      name: product.name,
      imageUrl: product.image_url,
      variant: variant || undefined,
      metrcRetailId: product.metrc_retail_id,
      excludeFromDiscounts: product.exclude_from_discounts,
      minimumPrice: product.minimum_price ?? undefined,
      minExpiryDays: product.min_expiry_days,
    });

    setLastAddedItem({
      name: product.name,
      price: product.display_price,
      imageUrl: product.image_url,
      quantity,
    });

    setTimeout(() => {
      setIsAddingToCart(false);
    }, 1500);
  };

  // --- Render ---

  if (!store) return null;

  if (productLoading) {
    return <ProductDetailSkeleton />;
  }

  if (!product) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <Package className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
        <h1 className="text-2xl font-bold mb-2">Product Not Found</h1>
        <p className="text-muted-foreground mb-6">
          This product doesn't exist or is no longer available.
        </p>
        <Link to={`/shop/${storeSlug}/products`}>
          <Button style={{ backgroundColor: store.primary_color }}>
            Browse Products
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className={`min-h-dvh overflow-x-hidden ${isLuxuryTheme ? 'bg-zinc-950 text-white selection:bg-white/20' : 'bg-background'}`}>
      {/* Ambient Background Effects */}
      {isLuxuryTheme && (
        <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
          <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-purple-900/10 blur-[150px] animate-pulse" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-emerald-900/10 blur-[150px] animate-pulse" style={{ animationDelay: '2s' }} />
        </div>
      )}

      <ScrollProgress color={accentColor} />
      <CartPreviewPopup
        item={lastAddedItem}
        cartCount={cartCount}
        cartTotal={subtotal}
        storeSlug={storeSlug ?? ''}
        onClose={() => setLastAddedItem(null)}
      />

      <div className="relative z-10 pt-16 sm:pt-24 pb-20">
        <div className="container mx-auto px-4 max-w-7xl">
          {/* Breadcrumbs */}
          <nav className="flex items-center space-x-2 text-xs sm:text-sm text-muted-foreground mb-4 sm:mb-8 overflow-x-auto whitespace-nowrap scrollbar-hide">
            <Link to={`/shop/${storeSlug}`} className="hover:text-primary transition-colors flex-shrink-0">Home</Link>
            <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
            <Link to={`/shop/${storeSlug}/products`} className="hover:text-primary transition-colors flex-shrink-0">Shop</Link>
            <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
            <span className={cn("truncate max-w-[180px] sm:max-w-none", isLuxuryTheme ? "text-white/60" : "text-foreground")}>{product.name}</span>
          </nav>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-12 lg:gap-20">
            <ProductGallery
              productName={product.name}
              allImages={allImages}
              inStock={product.in_stock}
              stockQuantity={product.stock_quantity}
              discountPercent={discountPercent}
              isWishlisted={isWishlisted}
              onToggleWishlist={toggleWishlist}
            />

            <ProductInfo
              product={product}
              averageRating={averageRating}
              reviewCount={reviews.length}
              isLuxuryTheme={isLuxuryTheme}
              onAddToCart={handleAddToCart}
              isAddingToCart={isAddingToCart}
            />
          </div>

          <ProductTabs
            product={product}
            reviews={reviews}
            averageRating={averageRating}
            relatedProducts={relatedProducts}
            storeId={store.id}
            storeSlug={storeSlug ?? ''}
            primaryColor={store.primary_color || '#10b981'}
            isLuxuryTheme={isLuxuryTheme}
          />

          <EnhancedStickyAddToCart
            product={{
              product_id: product.product_id,
              name: product.name,
              display_price: product.display_price,
              compare_at_price: product.compare_at_price,
              in_stock: product.in_stock,
              image_url: product.image_url,
            }}
            primaryColor={store.primary_color}
            onAddToCart={async () => {
              handleAddToCart(1, null);
            }}
            onToggleWishlist={toggleWishlist}
            isWishlisted={isWishlisted}
          />
        </div>
      </div>
    </div>
  );
}
