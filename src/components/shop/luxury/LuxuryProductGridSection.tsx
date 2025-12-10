/**
 * Luxury Product Grid Section - BudDash-inspired premium product cards
 * Dark theme with glassmorphism effects
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useShop } from '@/pages/shop/ShopLayout';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Search, ShoppingCart, Star, Package } from 'lucide-react';

interface LuxuryProductGridSectionProps {
    content?: {
        heading?: string;
        subheading?: string;
        show_search?: boolean;
        featured_only?: boolean;
        limit?: number;
    };
    styles?: {
        accent_color?: string;
    };
    storeId: string;
}

interface Product {
    id: string;
    name: string;
    description: string | null;
    retail_price: number | null;
    price: number;
    image_url: string | null;
    category: string | null;
    strain_type: string | null;
    thc_percent: number | null;
    weight_grams: number | null;
}

export function LuxuryProductGridSection({ content, styles, storeId }: LuxuryProductGridSectionProps) {
    const { storeSlug } = useParams();
    const navigate = useNavigate();
    const { setCartItemCount } = useShop();
    const [searchQuery, setSearchQuery] = useState('');
    const accentColor = styles?.accent_color || '#10b981';

    // Fetch products from the store's tenant
    const { data: products, isLoading } = useQuery({
        queryKey: ['luxury-products', storeId, content?.featured_only],
        queryFn: async (): Promise<Product[]> => {
            // First get the tenant_id from the marketplace store
            const { data: storeData } = await supabase
                .from('marketplace_stores')
                .select('tenant_id')
                .eq('id', storeId)
                .single();

            if (!storeData?.tenant_id) return [];

            const limitCount = content?.limit || 12;

            const { data, error } = await supabase
                .from('products')
                .select('id, name, description, retail_price, price, image_url, category, strain_type, thc_percent, weight_grams')
                .eq('tenant_id', storeData.tenant_id)
                .eq('is_active', true)
                .gt('stock_quantity', 0)
                .order('created_at', { ascending: false })
                .limit(limitCount);

            if (error) throw error;
            return (data || []) as Product[];
        },
        enabled: !!storeId,
    });

    // Filter products by search
    const filteredProducts = products?.filter(product =>
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.category?.toLowerCase().includes(searchQuery.toLowerCase())
    ) || [];

    // Add to cart handler
    const handleAddToCart = (product: Product) => {
        const cartKey = `shop_cart_${storeId}`;
        const cart = JSON.parse(localStorage.getItem(cartKey) || '[]');

        const existingIndex = cart.findIndex((item: any) => item.productId === product.id);
        if (existingIndex >= 0) {
            cart[existingIndex].quantity += 1;
        } else {
            cart.push({
                productId: product.id,
                name: product.name,
                price: product.retail_price,
                quantity: 1,
                image_url: product.image_url,
            });
        }

        localStorage.setItem(cartKey, JSON.stringify(cart));
        setCartItemCount(cart.reduce((sum: number, item: any) => sum + item.quantity, 0));
    };

    if (isLoading) {
        return (
            <section id="products" className="py-24 bg-black">
                <div className="container mx-auto px-6">
                    <Skeleton className="h-8 w-64 mx-auto mb-4 bg-white/5" />
                    <Skeleton className="h-4 w-96 mx-auto mb-16 bg-white/5" />
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                            <Skeleton key={i} className="h-[400px] rounded-2xl bg-white/5" />
                        ))}
                    </div>
                </div>
            </section>
        );
    }

    return (
        <section id="products" className="py-24 bg-black relative">
            {/* Ambient glow */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div
                    className="absolute top-0 left-1/4 w-[800px] h-[400px] rounded-full blur-3xl opacity-5"
                    style={{ backgroundColor: accentColor }}
                />
            </div>

            <div className="container mx-auto px-6 relative z-10">
                {/* Header */}
                <div className="text-center mb-16">
                    <h2 className="text-3xl md:text-4xl font-extralight text-white mb-4">
                        {content?.heading || 'Featured Products'}
                    </h2>
                    <p className="text-white/50 font-light max-w-2xl mx-auto">
                        {content?.subheading || 'Curated selection of premium quality'}
                    </p>

                    {/* Search */}
                    {content?.show_search !== false && (
                        <div className="mt-8 max-w-md mx-auto relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                            <Input
                                type="text"
                                placeholder="Search products..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-11 bg-white/5 border-white/10 text-white placeholder:text-white/30 rounded-full focus:border-emerald-500/50"
                            />
                        </div>
                    )}
                </div>

                {/* Products Grid */}
                {filteredProducts.length === 0 ? (
                    <div className="text-center py-16">
                        <Package className="w-16 h-16 mx-auto mb-4 text-white/20" />
                        <p className="text-white/50">No products found</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {filteredProducts.map((product) => (
                            <LuxuryProductCard
                                key={product.id}
                                product={product}
                                accentColor={accentColor}
                                onAddToCart={() => handleAddToCart(product)}
                                onClick={() => navigate(`/shop/${storeSlug}/product/${product.id}`)}
                            />
                        ))}
                    </div>
                )}

                {/* View All Link */}
                {products && products.length >= (content?.limit || 12) && (
                    <div className="text-center mt-12">
                        <button
                            onClick={() => navigate(`/shop/${storeSlug}/products`)}
                            className="px-8 py-3 text-sm font-light tracking-wide text-white border border-white/10 rounded-full hover:border-white/30 hover:bg-white/5 transition-all"
                        >
                            View All Products
                        </button>
                    </div>
                )}
            </div>
        </section>
    );
}

// Luxury Product Card Component
function LuxuryProductCard({
    product,
    accentColor,
    onAddToCart,
    onClick
}: {
    product: Product;
    accentColor: string;
    onAddToCart: () => void;
    onClick: () => void;
}) {
    const [imageError, setImageError] = useState(false);

    return (
        <div
            className="group relative bg-white/[0.02] backdrop-blur-xl rounded-2xl overflow-hidden border border-white/[0.05] hover:border-white/[0.1] transition-all duration-500 cursor-pointer"
            onClick={onClick}
        >
            {/* Image */}
            <div className="relative aspect-square overflow-hidden bg-gradient-to-br from-neutral-900 to-black">
                {product.image_url && !imageError ? (
                    <img
                        src={product.image_url}
                        alt={product.name}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                        onError={() => setImageError(true)}
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center">
                        <Package className="w-16 h-16 text-white/10" />
                    </div>
                )}

                {/* Overlay gradient */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                {/* Quick add button */}
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onAddToCart();
                    }}
                    className="absolute bottom-4 left-1/2 -translate-x-1/2 translate-y-8 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300 px-6 py-2.5 rounded-full text-sm font-light flex items-center gap-2"
                    style={{ backgroundColor: accentColor }}
                >
                    <ShoppingCart className="w-4 h-4" />
                    Add to Cart
                </button>

                {/* Category badge */}
                {product.category && (
                    <div className="absolute top-4 left-4 px-3 py-1 bg-black/50 backdrop-blur-md rounded-full text-xs text-white/70 font-light">
                        {product.category}
                    </div>
                )}

                {/* Strain type indicator */}
                {product.strain_type && (
                    <div
                        className="absolute top-4 right-4 w-2 h-2 rounded-full"
                        style={{
                            backgroundColor: product.strain_type === 'sativa' ? '#22c55e' :
                                product.strain_type === 'indica' ? '#a855f7' : '#eab308'
                        }}
                        title={product.strain_type}
                    />
                )}
            </div>

            {/* Content */}
            <div className="p-5">
                <h3 className="text-white font-light text-lg mb-2 line-clamp-1 group-hover:text-emerald-400 transition-colors">
                    {product.name}
                </h3>

                {product.description && (
                    <p className="text-white/40 text-sm font-light line-clamp-2 mb-4">
                        {product.description}
                    </p>
                )}


                <div className="flex items-center justify-between">
                    <span
                        className="text-xl font-light"
                        style={{ color: accentColor }}
                    >
                        ${(product.retail_price || product.price).toFixed(2)}
                    </span>

                    {product.thc_percent && (
                        <span className="text-xs text-white/30 font-light">
                            THC {product.thc_percent}%
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}
