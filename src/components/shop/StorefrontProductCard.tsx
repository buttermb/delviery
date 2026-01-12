import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Eye, Check, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import ProductImage from '@/components/ProductImage';
import { cleanProductName } from '@/utils/productName';

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
    accentColor = '#015358'
}: StorefrontProductCardProps) {
    const [isHovered, setIsHovered] = useState(false);
    const cleanedName = cleanProductName(product.product_name);
    const isOutStock = product.stock_quantity !== undefined && product.stock_quantity <= 0;
    const isLowStock = product.stock_quantity !== undefined && product.stock_quantity > 0 && product.stock_quantity <= 5;
    const hasSalePrice = product.sale_price != null && product.sale_price < product.price;
    const displayPrice = hasSalePrice ? product.sale_price : product.price;

    // Use secondary image on hover if available
    const displayImage = isHovered && product.images && product.images.length > 1
        ? product.images[1]
        : product.image_url;

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.4, delay: index * 0.05 }}
            className="group"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <div className="bg-white rounded-3xl border border-neutral-100 overflow-hidden shadow-sm hover:shadow-2xl hover:shadow-neutral-200/50 transition-all duration-500 h-full flex flex-col relative transform hover:-translate-y-2 backface-hidden">

                {/* Image Container */}
                <Link to={`/shop/${storeSlug}/product/${product.product_id}${isPreviewMode ? '?preview=true' : ''}`} className="block relative aspect-square overflow-hidden bg-neutral-50 cursor-pointer">
                    <div className="absolute inset-0 transition-transform duration-700 ease-out group-hover:scale-105">
                        <ProductImage
                            src={displayImage}
                            alt={cleanedName}
                            className={cn("h-full w-full object-cover", isOutStock && "grayscale opacity-50")}
                        />
                    </div>

                    {/* Quick Overlay Actions */}
                    <div className="absolute top-4 right-4 flex flex-col gap-2 translate-x-12 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all duration-300 ease-out z-10">
                        <button
                            onClick={(e) => { e.preventDefault(); onToggleWishlist(); }}
                            className={cn(
                                "w-10 h-10 rounded-full flex items-center justify-center shadow-lg transition-colors border",
                                isInWishlist ? "bg-red-50 text-red-500 border-red-100" : "bg-white text-neutral-400 hover:text-red-500 border-white"
                            )}
                        >
                            <svg className={cn("w-5 h-5 transition-transform active:scale-75", isInWishlist && "fill-current")} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" /></svg>
                        </button>
                        <button
                            onClick={(e) => { e.preventDefault(); onQuickView(); }}
                            className="w-10 h-10 rounded-full bg-white text-neutral-400 hover:text-[#015358] border border-white flex items-center justify-center shadow-lg transition-colors delay-75"
                            style={{ color: isHovered ? accentColor : undefined }}
                        >
                            <Eye className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Stock / Type / Sale Badges */}
                    <div className="absolute top-4 left-4 flex flex-col gap-2 pointer-events-none">
                        {hasSalePrice && (
                            <span className="bg-red-500 text-white backdrop-blur-md px-3 py-1 text-[10px] font-bold uppercase rounded-lg shadow-sm">
                                Sale
                            </span>
                        )}
                        {product.strain_type && (
                            <span className={cn(
                                "px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-lg backdrop-blur-md shadow-sm border",
                                product.strain_type === 'Indica' ? "bg-purple-100/90 text-purple-700 border-purple-200" :
                                    product.strain_type === 'Sativa' ? "bg-amber-100/90 text-amber-700 border-amber-200" :
                                        "bg-emerald-100/90 text-emerald-700 border-emerald-200"
                            )}>
                                {product.strain_type}
                            </span>
                        )}
                        {isLowStock && (
                            <span className="bg-orange-500/90 text-white backdrop-blur-md px-3 py-1 text-[10px] font-bold uppercase rounded-lg shadow-sm">
                                Low Stock
                            </span>
                        )}
                    </div>

                    {isOutStock && (
                        <div className="absolute inset-0 bg-white/40 backdrop-blur-[2px] flex items-center justify-center z-20">
                            <span className="bg-neutral-900 text-white px-4 py-2 text-xs font-bold uppercase tracking-widest rounded-lg shadow-xl transform -rotate-6">
                                Sold Out
                            </span>
                        </div>
                    )}
                </Link>

                {/* Content */}
                <div className="p-5 flex flex-col flex-1">
                    <div className="flex-1 space-y-2">
                        <Link to={`/shop/${storeSlug}/product/${product.product_id}${isPreviewMode ? '?preview=true' : ''}`} className="group-hover:opacity-80 transition-colors block">
                            <h3 className="font-bold text-lg leading-snug line-clamp-2" style={{ color: accentColor }} title={cleanedName}>
                                {cleanedName}
                            </h3>
                        </Link>
                        <p className="text-xs font-bold text-neutral-400 uppercase tracking-wider">{product.category}</p>

                        {(product.thc_content || product.cbd_content) && (
                            <div className="flex flex-wrap gap-2 text-[10px] font-bold text-neutral-500 pt-1">
                                {product.thc_content && <span className="bg-neutral-100 px-2 py-1 rounded-md">{product.thc_content}% THC</span>}
                                {product.cbd_content && <span className="bg-neutral-100 px-2 py-1 rounded-md">{product.cbd_content}% CBD</span>}
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="pt-5 mt-2 flex items-center justify-between border-t border-neutral-50">
                        <div className="flex flex-col">
                            <div className="flex items-baseline gap-2">
                                {displayPrice === 0 ? (
                                    <span className="text-xl font-extrabold text-emerald-600">Free</span>
                                ) : (
                                    <span className="text-xl font-extrabold" style={{ color: accentColor }}>${displayPrice?.toFixed(2)}</span>
                                )}
                                {hasSalePrice && (
                                    <span className="text-sm text-neutral-400 line-through">${product.price?.toFixed(2)}</span>
                                )}
                            </div>
                            {product.unit_type && <span className="text-[10px] text-neutral-400 font-medium">per {product.unit_type}</span>}
                        </div>

                        <Button
                            onClick={onQuickAdd}
                            disabled={isOutStock}
                            size="sm"
                            className={cn(
                                "rounded-full h-10 px-5 font-bold transition-all duration-300 shadow-md",
                                isAdded
                                    ? "bg-emerald-500 text-white hover:bg-emerald-600 w-auto"
                                    : isOutStock
                                        ? "bg-neutral-100 text-neutral-300 cursor-not-allowed"
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
                                        <Check className="w-4 h-4 mr-1.5" strokeWidth={3} />
                                        <span className="text-xs uppercase tracking-wider">Added</span>
                                    </motion.div>
                                ) : (
                                    <div className="flex items-center">
                                        <Plus className="w-4 h-4 mr-1.5" strokeWidth={3} />
                                        <span className="text-xs uppercase tracking-wider">Add</span>
                                    </div>
                                )}
                            </AnimatePresence>
                        </Button>
                    </div>
                </div>
            </div>
        </motion.div>
    );
}
