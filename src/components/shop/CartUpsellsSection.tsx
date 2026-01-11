/**
 * Cart Upsells Section
 * Shows bestselling products to encourage larger basket sizes
 */

import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useLuxuryTheme } from '@/components/shop/luxury';
import { useShop } from '@/pages/shop/ShopLayout';
import { useShopCart } from '@/hooks/useShopCart';
import {
    TrendingUp,
    Plus,
    Package,
    ChevronLeft,
    ChevronRight
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { useRef } from 'react';

interface Product {
    id: string;
    name: string;
    price: number;
    display_price: number;
    image_url: string | null;
    category: string;
    in_stock: boolean;
}

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

    // Fetch products from marketplace_products table directly
    const { data: products = [], isLoading } = useQuery({
        queryKey: ['upsell-products', storeId],
        queryFn: async (): Promise<Product[]> => {
            try {
                const { data, error } = await supabase
                    .from('marketplace_products')
                    .select('id, name, price, image_url, category, in_stock')
                    .eq('store_id', storeId)
                    .eq('in_stock', true)
                    .limit(maxItems + excludeProductIds.length + 5);

                if (error) {
                    console.warn('Failed to fetch upsell products:', error);
                    return [];
                }

                const mapped = (data || []).map(p => ({
                    id: p.id,
                    name: p.name,
                    price: p.price,
                    display_price: p.price,
                    image_url: p.image_url,
                    category: p.category || '',
                    in_stock: p.in_stock ?? true,
                }));

                return mapped
                    .filter(p => !excludeProductIds.includes(p.id))
                    .slice(0, maxItems);
            } catch (err) {
                console.warn('Failed to fetch upsell products:', err);
                return [];
            }
        },
        enabled: !!storeId,
        staleTime: 5 * 60 * 1000,
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

    const handleAddToCart = async (product: Product) => {
        await addItem({
            productId: product.id,
            name: product.name,
            price: product.price,
            quantity: 1,
            imageUrl: product.image_url || undefined,
        });
        toast({
            title: 'Added to cart',
            description: `${product.name} has been added to your cart.`
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
                    className="flex gap-4 overflow-x-auto scrollbar-hide pb-2"
                    style={{ scrollSnapType: 'x mandatory' }}
                >
                    {products.map((product) => (
                        <div
                            key={product.id}
                            className="w-40 flex-shrink-0"
                            style={{ scrollSnapAlign: 'start' }}
                        >
                            <Link to={`/shop/${storeSlug}/product/${product.id}`}>
                                <div className="aspect-square bg-muted rounded-lg mb-2 overflow-hidden">
                                    {product.image_url ? (
                                        <img
                                            src={product.image_url}
                                            alt={product.name}
                                            className="w-full h-full object-cover hover:scale-105 transition-transform"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                            <Package className="h-8 w-8 text-muted-foreground" />
                                        </div>
                                    )}
                                </div>
                            </Link>
                            <p className={`text-sm font-medium line-clamp-2 mb-1 ${isLuxuryTheme ? textPrimary : ''}`}>
                                {product.name}
                            </p>
                            <div className="flex items-center justify-between">
                                <span className={`text-sm font-bold ${isLuxuryTheme ? textPrimary : ''}`}>
                                    {formatCurrency(product.price)}
                                </span>
                                <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-7 w-7"
                                    onClick={() => handleAddToCart(product)}
                                    style={{ color: accentColor }}
                                >
                                    <Plus className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
