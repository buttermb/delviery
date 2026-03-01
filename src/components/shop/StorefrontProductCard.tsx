import { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Eye, Check, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import ProductImage from '@/components/ProductImage';
import { cleanProductName } from '@/utils/productName';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { usePrefetch } from '@/hooks/usePrefetch';
import { useShop } from '@/pages/shop/ShopLayout';
import { queryKeys } from '@/lib/queryKeys';
import { supabase } from '@/integrations/supabase/client';

export interface MarketplaceProduct {
    product_id: string;
    product_name: string;
    category: string;
    strain_type: string;
    price: number;
    sale_price?: number | null; // Promotional price set by admin
    description: string;
    image_url: string | null;
    images?: string[] | null;
    thc_content: number | null;
    cbd_content: number | null;
    is_visible: boolean;
    display_order: number;
    stock_quantity?: number;
    metrc_retail_id?: string | null;
    exclude_from_discounts?: boolean;
    minimum_price?: number;
    effects?: string[];
    min_expiry_days?: number;
    unit_type?: string;
}

interface StorefrontProductCardProps {
    product: MarketplaceProduct;
    storeSlug?: string;
    isPreviewMode: boolean;
    onQuickAdd: (e: React.MouseEvent) => void;
    isAdded: boolean;
    onToggleWishlist: () => void;
    isInWishlist: boolean;
    onQuickView: () => void;
    index: number;
    accentColor?: string;
    // Feature toggles from Easy Mode
    showSaleBadge?: boolean;
    showNewBadge?: boolean;
    showStrainBadge?: boolean;
    showStockWarning?: boolean;
}

export function StorefrontProductCard({
    product,
    storeSlug,
    isPreviewMode,
    onQuickAdd,
    isAdded,
    onToggleWishlist,
    isInWishlist,
    onQuickView,
    index,
    accentColor = '#015358',
    // Feature toggles - default to true for backwards compatibility
    showSaleBadge = true,
    showNewBadge = true,
    showStrainBadge = true,
    showStockWarning = true,
}: StorefrontProductCardProps) {
    const [isHovered, setIsHovered] = useState(false);
    const cleanedName = cleanProductName(product.product_name);
    const isOutStock = product.stock_quantity !== undefined && product.stock_quantity <= 0;
    const isLowStock = product.stock_quantity !== undefined && product.stock_quantity > 0 && product.stock_quantity <= 5;
    const hasSalePrice = product.sale_price != null && product.sale_price < product.price;
    const displayPrice = hasSalePrice ? product.sale_price : product.price;

    // Check if product is new (added in last 7 days) - based on display_order as proxy
    const isNew = product.display_order !== undefined && product.display_order <= 7;

    // Use secondary image on hover if available
    const displayImage = isHovered && product.images && product.images.length > 1
        ? product.images[1]
        : product.image_url;

    // Get first 2 effects for display
    const displayEffects = product.effects?.slice(0, 2) ?? [];

    // Prefetch product detail data on hover
    const { store } = useShop();
    const { prefetchQuery } = usePrefetch();

    const handlePrefetch = useCallback(() => {
        setIsHovered(true);
        if (!store?.id) return;

        prefetchQuery(
            queryKeys.shopProducts.detail(store.id, product.product_id),
            async () => {
                const { data, error } = await supabase
                    .rpc('get_marketplace_products', { p_store_id: store.id });
                if (error) throw error;
                const products = data ?? [];
                return products.find(
                    (p: { product_id: string }) => p.product_id === product.product_id
                ) ?? null;
            }
        );
    }, [store?.id, product.product_id, prefetchQuery]);

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.4, delay: index * 0.05 }}
            className="group h-full"
            onMouseEnter={handlePrefetch}
            onMouseLeave={() => setIsHovered(false)}
        >
            <div className="rounded-3xl border overflow-hidden shadow-sm hover:shadow-2xl transition-all duration-500 h-full flex flex-col relative transform hover:-translate-y-2 backface-hidden" style={{ backgroundColor: 'var(--storefront-card-bg, white)', borderColor: 'var(--storefront-border, #f5f5f5)' }}>

                {/* Image Container */}
                <Link to={`/shop/${storeSlug}/products/${product.product_id}${isPreviewMode ? '?preview=true' : ''}`} className="block relative aspect-square overflow-hidden cursor-pointer" style={{ backgroundColor: 'var(--storefront-card-bg, #fafafa)' }}>
            <div className="bg-card rounded-3xl border border-border overflow-hidden shadow-sm hover:shadow-2xl transition-all duration-500 h-full flex flex-col relative transform hover:-translate-y-2 backface-hidden">

                {/* Image Container */}
                <Link to={`/shop/${storeSlug}/products/${product.product_id}${isPreviewMode ? '?preview=true' : ''}`} className="block relative aspect-square overflow-hidden bg-muted cursor-pointer">
                    <div className="absolute inset-0 transition-transform duration-700 ease-out group-hover:scale-105">
                        <ProductImage
                            src={displayImage}
                            alt={cleanedName}
                            className={cn("h-full w-full object-cover", isOutStock && "grayscale opacity-50")}
                        />
                    </div>

                    {/* Quick Overlay Actions - always visible on mobile, hover-reveal on desktop */}
                    <div className="absolute top-3 right-3 sm:top-4 sm:right-4 flex flex-col gap-2 sm:translate-x-12 sm:opacity-0 sm:group-hover:translate-x-0 sm:group-hover:opacity-100 transition-all duration-300 ease-out z-10">
                        <button
                            onClick={(e) => { e.preventDefault(); onToggleWishlist(); }}
                            aria-label={isInWishlist ? "Remove from wishlist" : "Add to wishlist"}
                            className={cn(
                                "w-11 h-11 rounded-full flex items-center justify-center shadow-lg transition-colors border",
                                isInWishlist ? "bg-red-50 text-red-500 border-red-100" : "bg-white dark:bg-zinc-900 text-neutral-400 hover:text-red-500 border-white dark:border-zinc-900"
                                "w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center shadow-lg transition-colors border",
                                isInWishlist ? "bg-red-50 text-red-500 border-red-100" : "hover:text-red-500"
                                "w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center shadow-lg transition-colors border",
                                isInWishlist ? "bg-destructive/10 text-destructive border-destructive/20" : "bg-card text-muted-foreground hover:text-destructive border-card"
                            )}
                            style={!isInWishlist ? { backgroundColor: 'var(--storefront-card-bg, white)', borderColor: 'var(--storefront-border, white)', color: 'var(--storefront-text, #a3a3a3)' } : undefined}
                        >
                            <svg className={cn("w-5 h-5 transition-transform active:scale-75", isInWishlist && "fill-current")} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" /></svg>
                        </button>
                        <button
                            onClick={(e) => { e.preventDefault(); onQuickView(); }}
                            aria-label="Quick view product"
                            className="w-11 h-11 rounded-full bg-white dark:bg-zinc-900 text-neutral-400 hover:text-shop-primary border border-white dark:border-zinc-900 flex items-center justify-center shadow-lg transition-colors delay-75"
                            className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-card text-muted-foreground hover:text-shop-primary border border-card flex items-center justify-center shadow-lg transition-colors delay-75"
                            style={{ color: isHovered ? accentColor : undefined }}
                            className="w-9 h-9 sm:w-10 sm:h-10 rounded-full hover:text-shop-primary flex items-center justify-center shadow-lg transition-colors delay-75"
                            style={{ backgroundColor: 'var(--storefront-card-bg, white)', borderColor: 'var(--storefront-border, white)', color: isHovered ? accentColor : 'var(--storefront-text, #a3a3a3)' }}
                        >
                            <Eye className="w-5 h-5" aria-hidden="true" />
                        </button>
                    </div>

                    {/* Stock / Type / Sale / New Badges - controlled by feature toggles */}
                    <div className="absolute top-4 left-4 flex flex-col gap-2 pointer-events-none">
                        {showNewBadge && isNew && !hasSalePrice && (
                            <span className="bg-gradient-to-r from-info to-primary text-info-foreground backdrop-blur-md px-3 py-1 text-[10px] font-bold uppercase rounded-lg shadow-sm">
                                New
                            </span>
                        )}
                        {showSaleBadge && hasSalePrice && (
                            <span className="bg-destructive text-destructive-foreground backdrop-blur-md px-3 py-1 text-[10px] font-bold uppercase rounded-lg shadow-sm">
                                Sale
                            </span>
                        )}
                        {showStrainBadge && product.strain_type && (
                            <span className={cn(
                                "px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-lg backdrop-blur-md shadow-sm border",
                                product.strain_type === 'Indica' ? "bg-purple-100/90 text-purple-700 border-purple-200" :
                                    product.strain_type === 'Sativa' ? "bg-amber-100/90 text-amber-700 border-amber-200" :
                                        "bg-emerald-100/90 text-emerald-700 border-emerald-200"
                            )}>
                                {product.strain_type}
                            </span>
                        )}
                        {showStockWarning && isLowStock && (
                            <span className="bg-warning/90 text-warning-foreground backdrop-blur-md px-3 py-1 text-[10px] font-bold uppercase rounded-lg shadow-sm">
                                Low Stock
                            </span>
                        )}
                    </div>

                    {isOutStock && (
                        <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center z-20">
                            <span className="bg-neutral-900 text-white px-4 py-2 text-xs font-bold uppercase tracking-widest rounded-lg shadow-xl transform -rotate-6">
                        <div className="absolute inset-0 bg-background/40 backdrop-blur-[2px] flex items-center justify-center z-20">
                            <span className="bg-foreground text-background px-4 py-2 text-xs font-bold uppercase tracking-widest rounded-lg shadow-xl transform -rotate-6">
                                Sold Out
                            </span>
                        </div>
                    )}
                </Link>

                {/* Content */}
                <div className="p-3 sm:p-5 flex flex-col flex-1">
                    <div className="flex-1 space-y-2">
                        <Link to={`/shop/${storeSlug}/products/${product.product_id}${isPreviewMode ? '?preview=true' : ''}`} className="group-hover:opacity-80 transition-colors block">
                            <h3 className="font-bold text-base sm:text-lg leading-snug line-clamp-2" style={{ color: accentColor }} title={cleanedName}>
                                {cleanedName}
                            </h3>
                        </Link>
                        <p className="text-sm font-bold text-neutral-400 uppercase tracking-wider">{product.category}</p>
                        {product.category && (
                            <Badge variant="secondary" className="text-[10px] font-semibold uppercase tracking-wider w-fit">
                                {product.category}
                            </Badge>
                        )}

                        {(product.thc_content || product.cbd_content) && (
                            <div className="flex flex-wrap gap-2 text-xs font-bold text-neutral-500 pt-1">
                                {product.thc_content && <span className="bg-neutral-100 px-2 py-1 rounded-md">{product.thc_content}% THC</span>}
                                {product.cbd_content && <span className="bg-neutral-100 px-2 py-1 rounded-md">{product.cbd_content}% CBD</span>}
                        <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--storefront-text, #a3a3a3)', opacity: 0.6 }}>{product.category}</p>

                        {(product.thc_content || product.cbd_content) && (
                            <div className="flex flex-wrap gap-2 text-[10px] font-bold pt-1" style={{ color: 'var(--storefront-text, #737373)' }}>
                                {product.thc_content && <span className="px-2 py-1 rounded-md" style={{ backgroundColor: 'var(--storefront-border, #f5f5f5)' }}>{product.thc_content}% THC</span>}
                                {product.cbd_content && <span className="px-2 py-1 rounded-md" style={{ backgroundColor: 'var(--storefront-border, #f5f5f5)' }}>{product.cbd_content}% CBD</span>}
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{product.category}</p>

                        {(product.thc_content || product.cbd_content) && (
                            <div className="flex flex-wrap gap-2 text-[10px] font-bold text-muted-foreground pt-1">
                                {product.thc_content && <span className="bg-muted px-2 py-1 rounded-md">{product.thc_content}% THC</span>}
                                {product.cbd_content && <span className="bg-muted px-2 py-1 rounded-md">{product.cbd_content}% CBD</span>}
                            </div>
                        )}

                        {/* Effects Tags */}
                        {displayEffects.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 pt-1">
                                {displayEffects.map((effect, idx) => (
                                    <span
                                        key={idx}
                                        className="text-xs px-2 py-0.5 rounded-full border font-medium"
                                        style={{
                                            borderColor: `${accentColor}30`,
                                            color: accentColor,
                                            backgroundColor: `${accentColor}08`
                                        }}
                                    >
                                        {effect}
                                    </span>
                                ))}
                            </div>
                        )}

                        {/* Stock Status */}
                        {showStockWarning && product.stock_quantity !== undefined && (
                            <p className={cn(
                                "text-[11px] font-semibold pt-1",
                                isOutStock ? "text-red-500" :
                                isLowStock ? "text-orange-500" :
                                "text-emerald-600"
                            )}>
                                {isOutStock ? "Out of Stock" : isLowStock ? `Only ${product.stock_quantity} left` : "In Stock"}
                            </p>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="px-3 pt-2 pb-3 sm:px-5 sm:pt-3 sm:pb-5 mt-auto flex items-center justify-between border-t border-neutral-50">
                <div className="px-3 pt-2 pb-3 sm:px-5 sm:pt-5 sm:pb-0 mt-2 flex items-center justify-between border-t" style={{ borderColor: 'var(--storefront-border, #fafafa)' }}>
                <div className="px-3 pt-2 pb-3 sm:px-5 sm:pt-5 sm:pb-0 mt-2 flex items-center justify-between border-t border-border">
                    <div className="flex flex-col">
                        <div className="flex items-baseline gap-2">
                            {displayPrice === 0 ? (
                                <span className="text-base sm:text-xl font-extrabold text-success">Free</span>
                            ) : (
                                <span className="text-base sm:text-xl font-extrabold" style={{ color: accentColor }}>{formatCurrency(displayPrice)}</span>
                            )}
                            {hasSalePrice && (
                                <span className="text-sm text-neutral-400 line-through">{formatCurrency(product.price)}</span>
                            )}
                        </div>
                        {product.unit_type && <span className="text-xs text-neutral-400 font-medium">per {product.unit_type}</span>}
                                <span className="text-sm line-through" style={{ color: 'var(--storefront-text, #a3a3a3)', opacity: 0.5 }}>${product.price?.toFixed(2)}</span>
                            )}
                        </div>
                        {product.unit_type && <span className="text-[10px] font-medium" style={{ color: 'var(--storefront-text, #a3a3a3)', opacity: 0.5 }}>per {product.unit_type}</span>}
                                <span className="text-sm text-muted-foreground line-through">${product.price?.toFixed(2)}</span>
                            )}
                        </div>
                        {product.unit_type && <span className="text-[10px] text-muted-foreground font-medium">per {product.unit_type}</span>}
                    </div>

                    <Button
                        onClick={onQuickAdd}
                        disabled={isOutStock}
                        size="sm"
                        className={cn(
                            "rounded-full h-11 px-3 sm:px-5 font-bold transition-all duration-300 shadow-md",
                            isAdded
                                ? "bg-success text-success-foreground hover:bg-success/90 w-auto"
                                : isOutStock
                                    ? "cursor-not-allowed opacity-30"
                                    ? "bg-muted text-muted-foreground cursor-not-allowed"
                                    : "text-white hover:opacity-90 hover:shadow-lg active:scale-95"
                        )}
                        style={!isAdded && !isOutStock ? { backgroundColor: accentColor } : undefined}
                    >
                        <AnimatePresence mode="wait">
                            {isAdded ? (
                                <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    exit={{ scale: 0 }}
                                    className="flex items-center"
                                >
                                    <Check className="w-4 h-4 sm:mr-1.5" strokeWidth={3} aria-hidden="true" />
                                    <span className="hidden sm:inline text-sm uppercase tracking-wider">Added</span>
                                </motion.div>
                            ) : (
                                <div className="flex items-center">
                                    <Plus className="w-4 h-4 sm:mr-1.5" strokeWidth={3} aria-hidden="true" />
                                    <span className="hidden sm:inline text-sm uppercase tracking-wider">Add</span>
                                </div>
                            )}
                        </AnimatePresence>
                    </Button>
                </div>
            </div>
        </motion.div>
    );
}
