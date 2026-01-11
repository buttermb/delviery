/**
 * Dynamic Storefront Carousels
 * Placeholder - carousel features require additional database setup
 */

import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
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

interface Product {
    id: string;
    name: string;
    price: number;
    display_price: number;
    image_url: string | null;
    category: string;
    in_stock: boolean;
    min_expiry_days?: number;
}

interface DynamicCarouselProps {
    carousel: CarouselConfig;
    products: Product[];
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

    const handleQuickAdd = (product: Product) => {
        addItem({
            productId: product.id,
            name: product.name,
            price: product.display_price,
            quantity: 1,
            imageUrl: product.image_url || undefined,
            minExpiryDays: product.min_expiry_days,
        });
        toast({
            title: 'Added to cart!',
            description: product.name,
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
                    {products.map((product) => (
                        <div
                            key={product.id}
                            className={`flex-shrink-0 w-40 group relative rounded-lg overflow-hidden transition-all hover:scale-[1.02] ${isLuxuryTheme ? 'bg-white/5 hover:bg-white/10' : 'bg-muted/30 hover:bg-muted/50'
                                }`}
                        >
                            <Link to={`/shop/${storeSlug}/products/${product.id}`}>
                                <div className={`w-40 h-32 rounded-t-lg overflow-hidden ${isLuxuryTheme ? 'bg-white/5' : 'bg-muted'}`}>
                                    {product.image_url ? (
                                        <img
                                            src={product.image_url}
                                            alt={product.name}
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                            <Package className={`w-8 h-8 ${isLuxuryTheme ? 'text-white/20' : 'text-muted-foreground'}`} />
                                        </div>
                                    )}
                                </div>
                            </Link>
                            <div className="p-3">
                                <Link to={`/shop/${storeSlug}/products/${product.id}`}>
                                    <p className={`text-sm font-medium line-clamp-2 leading-tight mb-2 ${isLuxuryTheme ? textPrimary : ''}`}>
                                        {product.name}
                                    </p>
                                </Link>
                                <div className="flex items-center justify-between">
                                    <p className="text-sm font-bold" style={{ color: themeColor }}>
                                        {formatCurrency(product.display_price)}
                                    </p>
                                    <Button
                                        size="icon"
                                        variant="ghost"
                                        className={`h-7 w-7 ${isLuxuryTheme ? 'hover:bg-white/20' : 'hover:bg-primary/10'}`}
                                        onClick={() => handleQuickAdd(product)}
                                        disabled={!product.in_stock}
                                        title="Quick add to cart"
                                    >
                                        <Plus className="w-4 h-4" style={{ color: themeColor }} />
                                    </Button>
                                </div>
                                {product.category && (
                                    <Badge
                                        variant="secondary"
                                        className={`text-[10px] mt-1 ${isLuxuryTheme ? 'bg-white/10 text-white/60' : ''}`}
                                    >
                                        {product.category}
                                    </Badge>
                                )}
                            </div>
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
        queryKey: ['marketplace-products-map', storeId],
        queryFn: async () => {
            if (!storeId) return [];
            // Use existing RPC to get products with expiry
            const { data, error } = await supabase.rpc('get_marketplace_products', {
                p_store_id: storeId
            });

            if (error || !data) return [];

            return data.map((p: any) => ({
                id: p.product_id,
                name: p.product_name,
                price: p.price,
                display_price: p.price, // Logic for discounts could go here
                image_url: p.image_url,
                category: p.category,
                in_stock: p.stock_quantity > 0,
                min_expiry_days: p.min_expiry_days,
            })) as Product[];
        },
        enabled: !!storeId && !!carousels?.length,
    });

    if (!carousels?.length || !products?.length) return null;

    return (
        <div className="space-y-8 my-8">
            {carousels.map((carousel) => {
                // Filter products based on carousel config
                let displayProducts: Product[] = [];

                if (carousel.filter_type === 'manual') {
                    displayProducts = products.filter(p =>
                        carousel.product_ids?.includes(p.id)
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
