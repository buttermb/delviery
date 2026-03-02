/**
 * ProductQuickViewModal
 * 
 * Luxury-styled modal for quick product preview without leaving the grid.
 */

import { motion } from 'framer-motion';
import { X, Plus, Minus, ShoppingCart, Leaf } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { useState } from 'react';
import ProductImage from '@/components/ProductImage';
import { cleanProductName } from '@/utils/productName';
import { formatCurrency } from '@/lib/utils/formatCurrency';

interface MarketplaceProduct {
    product_id: string;
    product_name: string;
    category: string;
    strain_type: string;
    price: number;
    description: string;
    image_url: string | null;
    thc_content: number | null;
    cbd_content: number | null;
}

interface ProductQuickViewModalProps {
    product: MarketplaceProduct | null;
    isOpen: boolean;
    onClose: () => void;
    onAddToCart: (product: MarketplaceProduct, quantity: number) => void;
    accentColor?: string;
}

const strainTypeColors: Record<string, { bg: string; text: string }> = {
    'Sativa': { bg: 'bg-amber-500/20', text: 'text-amber-400' },
    'Indica': { bg: 'bg-purple-500/20', text: 'text-purple-400' },
    'Hybrid': { bg: 'bg-emerald-500/20', text: 'text-emerald-400' },
};

export function ProductQuickViewModal({
    product,
    isOpen,
    onClose,
    onAddToCart,
    accentColor = '#10b981',
}: ProductQuickViewModalProps) {
    const [quantity, setQuantity] = useState(1);

    if (!product) return null;

    const cleanedName = cleanProductName(product.product_name);
    const strainColors = strainTypeColors[product.strain_type] || strainTypeColors['Hybrid'];

    const handleAddToCart = () => {
        onAddToCart(product, quantity);
        setQuantity(1);
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent
                className="max-w-3xl p-0 bg-card border-border overflow-hidden rounded-2xl"
                aria-describedby="product-quick-view-description"
            >
                <VisuallyHidden>
                    <DialogTitle>Quick View: {cleanedName}</DialogTitle>
                </VisuallyHidden>

                {/* Close button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 z-20 p-2 rounded-full bg-black/50 hover:bg-black/80 transition-colors"
                >
                    <X className="w-5 h-5 text-white" />
                </button>

                <div className="grid md:grid-cols-2">
                    {/* Image Section */}
                    <div className="relative h-64 md:h-full min-h-[300px] bg-black overflow-hidden">
                        <motion.div
                            initial={{ scale: 1.1, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ duration: 0.5 }}
                            className="absolute inset-0"
                        >
                            <ProductImage
                                src={product.image_url}
                                alt={cleanedName}
                                className="w-full h-full object-cover"
                            />
                        </motion.div>

                        {/* Gradient overlay */}
                        <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent md:bg-gradient-to-r pointer-events-none" />

                        {/* Strain badge */}
                        {product.strain_type && (
                            <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.2 }}
                                className="absolute top-4 left-4"
                            >
                                <Badge className={`${strainColors.bg} ${strainColors.text} border-none px-3 py-1`}>
                                    <Leaf className="w-3 h-3 mr-1" />
                                    {product.strain_type}
                                </Badge>
                            </motion.div>
                        )}
                    </div>

                    {/* Content Section */}
                    <div className="p-6 md:p-8 flex flex-col">
                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.3 }}
                        >
                            {/* Category */}
                            {product.category && (
                                <p className="text-muted-foreground text-xs tracking-widest uppercase mb-2">
                                    {product.category}
                                </p>
                            )}

                            {/* Product Name */}
                            <h2 className="text-foreground text-2xl md:text-3xl mb-4">
                                {cleanedName}
                            </h2>

                            {/* THC/CBD */}
                            {(product.thc_content || product.cbd_content) && (
                                <div className="flex gap-4 mb-4">
                                    {product.thc_content && (
                                        <div className="px-3 py-1.5 rounded-lg bg-muted border border-border">
                                            <span className="text-muted-foreground text-xs mr-2">THC</span>
                                            <span className="text-foreground font-medium">{product.thc_content}%</span>
                                        </div>
                                    )}
                                    {product.cbd_content && (
                                        <div className="px-3 py-1.5 rounded-lg bg-muted border border-border">
                                            <span className="text-muted-foreground text-xs mr-2">CBD</span>
                                            <span className="text-foreground font-medium">{product.cbd_content}%</span>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Description */}
                            <p
                                id="product-quick-view-description"
                                className="text-muted-foreground text-sm leading-relaxed mb-6 line-clamp-4"
                            >
                                {product.description || 'Premium quality product from our curated selection.'}
                            </p>

                            {/* Price */}
                            <div className="mb-6">
                                <span className="text-muted-foreground text-xs tracking-wider uppercase">Price</span>
                                <p
                                    className="text-3xl"
                                    style={{ color: accentColor }}
                                >
                                    {formatCurrency(product.price)}
                                </p>
                            </div>

                            {/* Quantity Selector */}
                            <div className="flex items-center gap-4 mb-6">
                                <span className="text-muted-foreground text-sm">Quantity</span>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setQuantity(Math.max(1, quantity - 1))}
                                        className="w-8 h-8 rounded-full bg-muted hover:bg-muted/80 flex items-center justify-center transition-colors"
                                    >
                                        <Minus className="w-4 h-4 text-foreground" />
                                    </button>
                                    <span className="text-foreground font-medium w-8 text-center">{quantity}</span>
                                    <button
                                        onClick={() => setQuantity(quantity + 1)}
                                        className="w-8 h-8 rounded-full bg-muted hover:bg-muted/80 flex items-center justify-center transition-colors"
                                    >
                                        <Plus className="w-4 h-4 text-foreground" />
                                    </button>
                                </div>
                            </div>

                            {/* Add to Cart Button */}
                            <Button
                                onClick={handleAddToCart}
                                className="w-full py-6 rounded-full text-sm font-bold tracking-wider uppercase transition-all duration-300 transform active:scale-[0.98]"
                                style={{
                                    backgroundColor: accentColor,
                                    color: 'black'
                                }}
                            >
                                <ShoppingCart className="w-4 h-4 mr-2" />
                                Add to Cart - {formatCurrency(product.price * quantity)}
                            </Button>
                        </motion.div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
