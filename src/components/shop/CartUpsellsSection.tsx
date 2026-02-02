/**
 * Cart Upsells Section
 * Shows bestselling products to encourage larger basket sizes
 */

import { useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { logger } from '@/lib/logger';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useLuxuryTheme } from '@/components/shop/luxury';
import { useShop } from '@/pages/shop/ShopLayout';
import { useShopCart } from '@/hooks/useShopCart';
import { StorefrontProductCard, type MarketplaceProduct } from '@/components/shop/StorefrontProductCard';
import TrendingUp from "lucide-react/dist/esm/icons/trending-up";
import ChevronLeft from "lucide-react/dist/esm/icons/chevron-left";
import ChevronRight from "lucide-react/dist/esm/icons/chevron-right";

interface CartUpsellsSectionProps {
    storeId: string;
    excludeProductIds?: string[];
    maxItems?: number;
}

export function CartUpsellsSection({
    storeId,
    excludeProductIds = [],
    maxItems = 8
}: CartUpsellsSectionProps) {
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
        storeId,
        onCartChange: setCartItemCount,
    });

    // Fetch products using the RPC that we know exists
    const { data: products = [], isLoading } = useQuery({
        queryKey: ['upsell-products', storeId],
        queryFn: async (): Promise<MarketplaceProduct[]> => {
            try {
                // Use the RPC that exists in the schema
                const { data, error } = await supabase
                    .rpc('get_marketplace_products', { p_store_id: storeId });

                if (error) {
                    logger.warn('Failed to fetch upsell products', error);
                    return [];
                }

                // Cast and map to MarketplaceProduct interface
                const allProducts = (data as unknown as any[]) || [];

                return allProducts
                    .filter((p: any) => (p.stock_quantity || 0) > 0 && !excludeProductIds.includes(p.product_id))
                    .map((p: any) => ({
                        product_id: p.product_id,
                        product_name: p.product_name,
                        category: p.category || '',
                        strain_type: p.strain_type || '', // Ensure field exists
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
                    }))
                    .slice(0, maxItems);
            } catch (err) {
                logger.warn('Failed to fetch upsell products', err);
                return [];
            }
        },
        enabled: !!storeId,
        staleTime: 5 * 60 * 1000,
    });

    const scroll = (direction: 'left' | 'right') => {
        if (scrollRef.current) {
            const scrollAmount = 300;
            // Use scrollLeft property directly for better browser compatibility
            const newScrollLeft = scrollRef.current.scrollLeft + (direction === 'left' ? -scrollAmount : scrollAmount);
            scrollRef.current.scrollTo({
                left: newScrollLeft,
                behavior: 'smooth'
            });
        }
    };

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
        toast({
            title: 'Added to cart',
            description: `${product.product_name} has been added to your cart.`
        });
    };

    const handleAddToCart = async (product: MarketplaceProduct) => {
        await addItem({
            productId: product.product_id,
            name: product.product_name,
            price: product.price,
            quantity: 1,
            imageUrl: product.image_url || undefined,
            minExpiryDays: product.min_expiry_days,
        });
        toast({
            title: 'Added to cart',
            description: `${product.product_name} has been added to your cart.`
        });
    };

    if (isLoading) {
        return (
            <Card className={isLuxuryTheme ? `${cardBg} ${cardBorder}` : ''}>
                <CardHeader>
                    <Skeleton className="h-6 w-48" />
                </CardHeader>
                <CardContent>
                    <div className="flex gap-4 overflow-hidden">
                        {[...Array(4)].map((_, i) => (
                            <div key={i} className="w-40 flex-shrink-0">
                                <Skeleton className="h-40 w-full rounded-lg mb-2" />
                                <Skeleton className="h-4 w-full mb-1" />
                                <Skeleton className="h-4 w-20" />
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (!products.length) return null;

    return (
        <Card className={isLuxuryTheme ? `${cardBg} ${cardBorder}` : ''}>
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className={`flex items-center gap-2 ${isLuxuryTheme ? textPrimary : ''}`}>
                    <TrendingUp className="h-5 w-5" />
                    You Might Also Like
                </CardTitle>
                <div className="flex gap-1">
                    <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => scroll('left')}
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => scroll('right')}
                    >
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                <div
                    ref={scrollRef}
                    className="flex gap-4 overflow-x-auto scrollbar-hide pb-4 px-1"
                    style={{ scrollSnapType: 'x mandatory' }}
                >
                    {products.map((product, index) => (
                        <div
                            key={product.product_id}
                            className="w-48 flex-shrink-0"
                            style={{ scrollSnapAlign: 'start' }}
                        >
                            <StorefrontProductCard
                                product={product}
                                storeSlug={storeSlug!}
                                isPreviewMode={false}
                                onQuickAdd={(e) => handleQuickAdd(e, product)}
                                isAdded={false} // Simplified for upsells
                                onToggleWishlist={() => { }} // Wishlist not critical for upsell card
                                isInWishlist={false}
                                onQuickView={() => { }} // Could add this but simplier to click through
                                index={index}
                                accentColor={accentColor}
                            />
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
