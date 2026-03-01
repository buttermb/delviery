/**
 * RecentlyViewedSection - Horizontal scrollable list of recently viewed products
 */

import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useShop } from '@/pages/shop/ShopLayout';
import { useRecentlyViewed } from '@/hooks/useRecentlyViewed';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { logger } from '@/lib/logger';
import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { useShopCart } from '@/hooks/useShopCart';
import { toast } from 'sonner';
import { StorefrontProductCard, type MarketplaceProduct } from '@/components/shop/StorefrontProductCard';
import { queryKeys } from '@/lib/queryKeys';

interface RecentlyViewedSectionProps {
    currentProductId?: string;
    className?: string;
}

// ProductData replaced by MarketplaceProduct import

export function RecentlyViewedSection({ currentProductId, className = '' }: RecentlyViewedSectionProps) {
    const { storeSlug } = useParams<{ storeSlug: string }>();
    const { store } = useShop();
    const { recentlyViewed } = useRecentlyViewed();
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    // Filter out current product
    const productIds = currentProductId
        ? recentlyViewed.filter((id) => id !== currentProductId)
        : recentlyViewed;

    // Cart integration
    const { addItem } = useShopCart({
        storeId: store?.id,
        onCartChange: () => { },
    });
    // Fetch product details
    const { data: products = [], isLoading } = useQuery({
        queryKey: queryKeys.recentlyViewed.byStore(store?.id, productIds),
        queryFn: async (): Promise<MarketplaceProduct[]> => {
            if (!store?.id || productIds.length === 0) return [];

            try {
                const { data, error } = await supabase
                    .rpc('get_marketplace_products', { p_store_id: store.id });

                if (error) {
                    logger.error('Failed to fetch recently viewed products', error);
                    return [];
                }

                const allProducts = data ?? [];

                // Map to MarketplaceProduct
                const mappedProducts = allProducts.map(p => ({
                    product_id: p.product_id,
                    product_name: p.product_name,
                    category: p.category ?? '',
                    strain_type: p.strain_type ?? '',
                    price: p.price,
                    description: p.description ?? '',
                    image_url: p.image_url,
                    images: p.images ?? [],
                    thc_content: p.thc_content,
                    cbd_content: p.cbd_content,
                    is_visible: true,
                    display_order: 0,
                    stock_quantity: p.stock_quantity,
                    unit_type: p.unit_type,
                    min_expiry_days: p.min_expiry_days
                }));

                // Filter and sort by recently viewed order
                const viewedProducts = productIds
                    .map((id) => mappedProducts.find((p) => p.product_id === id))
                    .filter((p) => p !== undefined) as MarketplaceProduct[];

                return viewedProducts;
            } catch (err) {
                logger.error('Error fetching recently viewed products', err);
                return [];
            }
        },
        enabled: !!store?.id && productIds.length > 0,
    });

    const handleQuickAdd = async (e: React.MouseEvent, product: MarketplaceProduct) => {
        e.preventDefault();
        e.stopPropagation();

        await addItem({
            productId: product.product_id,
            name: product.product_name,
            price: product.price,
            quantity: 1,
            imageUrl: product.image_url,
            minExpiryDays: product.min_expiry_days,
            variant: product.strain_type
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

    if (!store || productIds.length === 0 || products.length === 0) {
        return null;
    }

    return (
        <div className={className}>
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">Recently Viewed</h2>
                <div className="flex gap-1">
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={() => scroll('left')}
                        className="h-11 w-11"
                        aria-label="Previous"
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </Button>
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={() => scroll('right')}
                        className="h-11 w-11"
                        aria-label="Next"
                    >
                        <ChevronRight className="w-5 h-5" />
                    </Button>
                </div>
            </div>

            <div
                ref={scrollContainerRef}
                className="flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-hide"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
                {isLoading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                        <div
                            key={i}
                            className="flex-shrink-0 w-48 aspect-[3/4] bg-muted rounded-lg animate-pulse snap-start"
                        />
                    ))
                ) : (
                    products.map((product, index) => (
                        <div
                            key={product.product_id}
                            className="w-48 flex-shrink-0 snap-start"
                        >
                            <StorefrontProductCard
                                product={product}
                                storeSlug={storeSlug!}
                                isPreviewMode={false}
                                onQuickAdd={(e) => handleQuickAdd(e, product)}
                                isAdded={false}
                                onToggleWishlist={() => { }}
                                isInWishlist={false}
                                onQuickView={() => { }}
                                index={index}
                                accentColor={store.primary_color}
                            />
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
