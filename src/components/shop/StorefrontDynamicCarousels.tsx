/**
 * Dynamic Storefront Carousels
 * Placeholder - carousel features require additional database setup
 */

import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/lib/queryKeys';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useLuxuryTheme } from '@/components/shop/luxury';
import { useShop } from '@/pages/shop/ShopLayout';
import { useShopCart } from '@/hooks/useShopCart';
import { useToast } from '@/hooks/use-toast';
import {
    ChevronLeft,
    ChevronRight,
    Plus,
    Package,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { useRef } from 'react';

import { StorefrontProductCard, type MarketplaceProduct } from '@/components/shop/StorefrontProductCard';

interface CarouselConfig {
    id: string;
    title: string;
    subtitle: string | null;
    filter_type: string;
    product_ids: string[];
    max_items: number;
    card_style: string;
    background_color: string | null;
}

// Product interface replaced by MarketplaceProduct import

interface DynamicCarouselProps {
    carousel: CarouselConfig;
    products: MarketplaceProduct[];
}

function ProductCarousel({ carousel, products }: DynamicCarouselProps) {
    const { storeSlug } = useParams();
    const { store, setCartItemCount } = useShop();
    const { toast } = useToast();
    const scrollRef = useRef<HTMLDivElement>(null);
    const {
        isLuxuryTheme,
        accentColor,
        cardBg,
        cardBorder,
        textPrimary,
        textMuted
    } = useLuxuryTheme();

    const { addItem } = useShopCart({
        storeId: store?.id || '',
        onCartChange: setCartItemCount,
    });

    const scroll = (direction: 'left' | 'right') => {
        if (scrollRef.current) {
            const scrollAmount = 250;
            scrollRef.current.scrollBy({
                left: direction === 'left' ? -scrollAmount : scrollAmount,
                behavior: 'smooth'
            });
        }
    };

    const handleQuickAdd = (e: React.MouseEvent, product: MarketplaceProduct) => {
        addItem({
            productId: product.product_id,
            name: product.product_name,
            price: product.price, // Use base price, logic might need adjustment if display_price differs
            quantity: 1,
            imageUrl: product.image_url || undefined,
            minExpiryDays: product.min_expiry_days,
            variant: product.strain_type
        });
        toast({
            title: 'Added to cart!',
            description: product.product_name,
        });
    };

    const themeColor = isLuxuryTheme ? accentColor : store?.primary_color || '#10b981';
    const bgColor = carousel.background_color || (isLuxuryTheme ? 'transparent' : undefined);

    if (products.length === 0) return null;

    return (
        <Card
            className={isLuxuryTheme ? `${cardBg} ${cardBorder}` : ''}
            style={bgColor ? { backgroundColor: bgColor } : undefined}
        >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div>
                    <CardTitle className={`${isLuxuryTheme ? 'text-white font-light' : ''}`}>
                        {carousel.title}
                    </CardTitle>
                    {carousel.subtitle && (
                        <p className={`text-sm mt-1 ${isLuxuryTheme ? 'text-white/60' : 'text-muted-foreground'}`}>
                            {carousel.subtitle}
                        </p>
                    )}
                </div>
                <div className="flex gap-1">
                    <Button
                        variant="ghost"
                        size="icon"
                        className={`h-8 w-8 ${isLuxuryTheme ? 'text-white/60 hover:text-white hover:bg-white/10' : ''}`}
                        onClick={() => scroll('left')}
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className={`h-8 w-8 ${isLuxuryTheme ? 'text-white/60 hover:text-white hover:bg-white/10' : ''}`}
                        onClick={() => scroll('right')}
                    >
                        <ChevronRight className="w-4 h-4" />
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                <div
                    ref={scrollRef}
                    className="flex gap-4 overflow-x-auto scrollbar-hide pb-2 -mx-2 px-2"
                    style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                >
                    {products.map((product, index) => (
                        <div
                            key={product.product_id}
                            className="flex-shrink-0 w-48"
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
                                accentColor={carousel.card_style === 'luxury' ? accentColor : themeColor}
                            />
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}

interface StorefrontDynamicCarouselsProps {
    storeId: string;
}

export function StorefrontDynamicCarousels({ storeId }: StorefrontDynamicCarouselsProps) {
    const { data: carousels } = useQuery({
        queryKey: ['marketplace-carousels', storeId],
        queryFn: async () => {
            if (!storeId) return [];
            const { data } = await (supabase
                .from as any)('marketplace_carousels')
                .select('*')
                .eq('store_id', storeId)
                .eq('is_active', true)
                .order('sort_order');
            return (data || []) as CarouselConfig[];
        },
        enabled: !!storeId,
    });

    const { data: products } = useQuery({
        queryKey: queryKeys.shopProducts.carousels(storeId),
        queryFn: async () => {
            if (!storeId) return [];
            // Use existing RPC to get products with expiry
            const { data, error } = await supabase.rpc('get_marketplace_products', {
                p_store_id: storeId
            });

            if (error || !data) return [];

            // Map to MarketplaceProduct
            return data.map((p: any) => ({
                product_id: p.product_id,
                product_name: p.product_name,
                category: p.category || '',
                strain_type: p.strain_type || '',
                price: p.price,
                description: p.description || '',
                image_url: p.image_url,
                images: p.images || [],
                thc_content: p.thc_content,
                cbd_content: p.cbd_content,
                is_visible: true,
                display_order: 0,
                stock_quantity: p.stock_quantity,
                unit_type: p.unit_type,
                min_expiry_days: p.min_expiry_days
            })) as MarketplaceProduct[];
        },
        enabled: !!storeId && !!carousels?.length,
    });

    if (!carousels?.length || !products?.length) return null;

    return (
        <div className="space-y-8 my-8">
            {carousels.map((carousel) => {
                // Filter products based on carousel config
                let displayProducts: MarketplaceProduct[] = [];

                if (carousel.filter_type === 'manual') {
                    displayProducts = products.filter(p =>
                        carousel.product_ids?.includes(p.product_id)
                    );
                } else if (carousel.filter_type === 'newest') {
                    // Logic to find newest would need created_at, for now just take slice
                    displayProducts = products.slice(0, carousel.max_items);
                } else if (carousel.filter_type === 'category') {
                    // Category filtering logic would go here
                    displayProducts = products.slice(0, carousel.max_items);
                } else {
                    // Bestselling or default
                    displayProducts = products.slice(0, carousel.max_items);
                }

                if (displayProducts.length === 0) return null;

                return (
                    <ProductCarousel
                        key={carousel.id}
                        carousel={carousel}
                        products={displayProducts}
                    />
                );
            })}
        </div>
    );
}
