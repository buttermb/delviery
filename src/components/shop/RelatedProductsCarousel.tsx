/**
 * RelatedProductsCarousel - Horizontal scrollable carousel of related products from the same category
 */

import { useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useShop } from '@/pages/shop/ShopLayout';
import { useShopCart } from '@/hooks/useShopCart';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StorefrontProductCard, type MarketplaceProduct } from '@/components/shop/StorefrontProductCard';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import { queryKeys } from '@/lib/queryKeys';

interface RpcProduct {
  product_id: string;
  product_name: string;
  description: string | null;
  category: string | null;
  brand: string | null;
  sku: string | null;
  price: number;
  sale_price: number | null;
  image_url: string | null;
  images: string[] | null;
  is_featured: boolean;
  is_on_sale: boolean;
  stock_quantity: number;
  strain_type: string | null;
  thc_content: number | null;
  cbd_content: number | null;
  sort_order: number;
  created_at: string;
  metrc_retail_id: string | null;
  exclude_from_discounts: boolean;
  minimum_price: number | null;
  effects: string[] | null;
  min_expiry_days: number | null;
  unit_type?: string;
}

interface RelatedProductsCarouselProps {
  currentProductId: string;
  category: string;
  className?: string;
}

export function RelatedProductsCarousel({
  currentProductId,
  category,
  className = '',
}: RelatedProductsCarouselProps) {
  const { storeSlug } = useParams<{ storeSlug: string }>();
  const { store, setCartItemCount } = useShop();
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const { addItem } = useShopCart({
    storeId: store?.id,
    onCartChange: setCartItemCount,
  });

  const { data: relatedProducts = [] } = useQuery({
    queryKey: queryKeys.shopProducts.related(store?.id, category),
    queryFn: async (): Promise<MarketplaceProduct[]> => {
      if (!store?.id || !category) return [];

      try {
        const { data, error } = await supabase.rpc('get_marketplace_products', {
          p_store_id: store.id,
        });

        if (error) {
          logger.error('Failed to fetch related products', error);
          return [];
        }

        return (data ?? [])
          .filter(
            (p: RpcProduct) =>
              p.product_id !== currentProductId && p.category === category
          )
          .slice(0, 8)
          .map((p: RpcProduct): MarketplaceProduct => ({
            product_id: p.product_id,
            product_name: p.product_name,
            category: p.category ?? '',
            strain_type: p.strain_type ?? '',
            price: p.price,
            sale_price: p.sale_price,
            description: p.description ?? '',
            image_url: p.image_url,
            images: p.images ?? [],
            thc_content: p.thc_content,
            cbd_content: p.cbd_content,
            is_visible: true,
            display_order: p.sort_order,
            stock_quantity: p.stock_quantity,
            metrc_retail_id: p.metrc_retail_id,
            exclude_from_discounts: p.exclude_from_discounts,
            minimum_price: p.minimum_price ?? undefined,
            effects: p.effects ?? [],
            min_expiry_days: p.min_expiry_days ?? undefined,
            unit_type: p.unit_type,
          }));
      } catch (err) {
        logger.error('Error fetching related products', err);
        return [];
      }
    },
    enabled: !!store?.id && !!category,
  });

  const handleQuickAdd = (e: React.MouseEvent, product: MarketplaceProduct) => {
    e.preventDefault();
    e.stopPropagation();

    addItem({
      productId: product.product_id,
      name: product.product_name,
      price: product.sale_price ?? product.price,
      quantity: 1,
      imageUrl: product.image_url,
      minExpiryDays: product.min_expiry_days,
      variant: product.strain_type || undefined,
    });
    toast.success('Added to cart', {
      description: `${product.product_name} has been added to your cart.`,
    });
  };

  const scroll = (direction: 'left' | 'right') => {
    if (!scrollContainerRef.current) return;
    const scrollAmount = 300;
    scrollContainerRef.current.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
  };

  if (!store || relatedProducts.length === 0) {
    return null;
  }

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-6 sm:mb-8">
        <h2 className="text-2xl sm:text-3xl font-light text-white">
          You May Also Like
        </h2>
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="icon"
              onClick={() => scroll('left')}
              className="h-8 w-8 rounded-full border-white/10 bg-white/5 hover:bg-white/10 text-white"
              aria-label="Scroll left"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => scroll('right')}
              className="h-8 w-8 rounded-full border-white/10 bg-white/5 hover:bg-white/10 text-white"
              aria-label="Scroll right"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
          <Link
            to={`/shop/${storeSlug}/products`}
            className="text-sm text-white/50 hover:text-white transition-colors ml-2"
          >
            View All
          </Link>
        </div>
      </div>

      <div
        ref={scrollContainerRef}
        className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-hide"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {relatedProducts.map((product, index) => (
          <div
            key={product.product_id}
            className="w-[65vw] sm:w-[280px] flex-shrink-0 snap-start"
          >
            <StorefrontProductCard
              product={product}
              storeSlug={storeSlug}
              isPreviewMode={false}
              onQuickAdd={(e) => handleQuickAdd(e, product)}
              isAdded={false}
              onToggleWishlist={() => {}}
              isInWishlist={false}
              onQuickView={() => {}}
              index={index}
              accentColor={store.primary_color}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
