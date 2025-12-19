/**
 * RecentlyViewedSection - Horizontal scrollable list of recently viewed products
 */

import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useShop } from '@/pages/shop/ShopLayout';
import { useRecentlyViewed } from '@/hooks/useRecentlyViewed';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Package, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { logger } from '@/lib/logger';
import { useRef } from 'react';
import { Button } from '@/components/ui/button';

interface RecentlyViewedSectionProps {
    currentProductId?: string;
    className?: string;
}

interface ProductData {
    product_id: string;
    product_name: string;
    price: number;
    sale_price: number | null;
    image_url: string | null;
    stock_quantity: number;
}

export function RecentlyViewedSection({ currentProductId, className = '' }: RecentlyViewedSectionProps) {
    const { storeSlug } = useParams();
    const { store } = useShop();
    const { recentlyViewed } = useRecentlyViewed();
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    // Filter out current product
    const productIds = currentProductId
        ? recentlyViewed.filter((id) => id !== currentProductId)
        : recentlyViewed;

    // Fetch product details
    const { data: products = [], isLoading } = useQuery({
        queryKey: ['recently-viewed-products', store?.id, productIds],
        queryFn: async () => {
            if (!store?.id || productIds.length === 0) return [];

            try {
                const { data, error } = await supabase
                    .rpc('get_marketplace_products', { p_store_id: store.id });

                if (error) {
                    logger.error('Failed to fetch recently viewed products', error);
                    return [];
                }

                const allProducts = (data || []) as ProductData[];
                // Filter and sort by recently viewed order
                const viewedProducts = productIds
                    .map((id) => allProducts.find((p) => p.product_id === id))
                    .filter((p) => p !== undefined) as ProductData[];

                return viewedProducts;
            } catch (err) {
                logger.error('Error fetching recently viewed products', err);
                return [];
            }
        },
        enabled: !!store?.id && productIds.length > 0,
    });

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
                        className="h-8 w-8"
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={() => scroll('right')}
                        className="h-8 w-8"
                    >
                        <ChevronRight className="w-4 h-4" />
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
                    products.map((product) => {
                        const displayPrice = product.sale_price || product.price;
                        const hasDiscount = product.sale_price && product.sale_price < product.price;
                        const inStock = product.stock_quantity > 0;

                        return (
                            <Link
                                key={product.product_id}
                                to={`/shop/${storeSlug}/products/${product.product_id}`}
                                className="flex-shrink-0 w-48 snap-start group"
                            >
                                <Card className="h-full hover:shadow-lg transition-shadow">
                                    <div className="aspect-square relative bg-muted rounded-t-lg overflow-hidden">
                                        {product.image_url ? (
                                            <img
                                                src={product.image_url}
                                                alt={product.product_name}
                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center">
                                                <Package className="w-12 h-12 text-muted-foreground" />
                                            </div>
                                        )}
                                        {hasDiscount && (
                                            <Badge
                                                className="absolute top-2 left-2"
                                                style={{ backgroundColor: store.primary_color }}
                                            >
                                                Sale
                                            </Badge>
                                        )}
                                        {!inStock && (
                                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                                <Badge variant="secondary">Out of Stock</Badge>
                                            </div>
                                        )}
                                    </div>
                                    <CardContent className="p-3">
                                        <h3 className="font-medium text-sm line-clamp-2 mb-1 group-hover:text-primary transition-colors">
                                            {product.product_name}
                                        </h3>
                                        <div className="flex items-center gap-1.5">
                                            <span
                                                className="font-bold text-sm"
                                                style={{ color: store.primary_color }}
                                            >
                                                {formatCurrency(displayPrice)}
                                            </span>
                                            {hasDiscount && (
                                                <span className="text-xs text-muted-foreground line-through">
                                                    {formatCurrency(product.price)}
                                                </span>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            </Link>
                        );
                    })
                )}
            </div>
        </div>
    );
}
