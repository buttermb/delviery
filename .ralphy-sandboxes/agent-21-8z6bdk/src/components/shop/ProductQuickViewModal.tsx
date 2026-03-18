/**
 * ProductQuickViewModal - Quick product preview modal
 * Allows users to view product details and add to cart without leaving the catalog
 */

import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useShop } from '@/pages/shop/ShopLayout';
import { useShopCart } from '@/hooks/useShopCart';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
    ShoppingCart,
    Plus,
    Minus,
    ExternalLink,
    Package,
    X,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { logger } from '@/lib/logger';
import { queryKeys } from '@/lib/queryKeys';
import ProductImage from '@/components/ProductImage';

interface ProductQuickViewModalProps {
    productId: string | null;
    isOpen: boolean;
    onClose: () => void;
}

interface QuickViewProduct {
    product_id: string;
    product_name: string;
    description: string | null;
    price: number;
    sale_price: number | null;
    image_url: string | null;
    stock_quantity: number;
    category: string | null;
}

export function ProductQuickViewModal({
    productId,
    isOpen,
    onClose,
}: ProductQuickViewModalProps) {
    const { storeSlug } = useParams<{ storeSlug: string }>();
    const { store, setCartItemCount } = useShop();
    const [quantity, setQuantity] = useState(1);

    const { addItem } = useShopCart({
        storeId: store?.id,
        onCartChange: setCartItemCount,
    });

    // Fetch product details
    const { data: product, isLoading } = useQuery({
        queryKey: queryKeys.shopPages.quickView(store?.id, productId),
        queryFn: async () => {
            if (!store?.id || !productId) return null;

            try {
                const { data, error } = await supabase
                    .rpc('get_marketplace_products', { p_store_id: store.id });

                if (error) {
                    logger.error('Failed to fetch quick view product', error);
                    return null;
                }

                const products = (data ?? []) as QuickViewProduct[];
                return products.find((p) => p.product_id === productId) || null;
            } catch (err) {
                logger.error('Error fetching quick view product', err);
                return null;
            }
        },
        enabled: !!store?.id && !!productId && isOpen,
    });

    const handleAddToCart = () => {
        if (!product) return;

        addItem({
            productId: product.product_id,
            quantity,
            price: product.sale_price || product.price,
            name: product.product_name,
            imageUrl: product.image_url,
        });

        toast.success('Added to cart', {
            description: `${quantity}x ${product.product_name}`,
        });

        // Close modal and reset quantity
        setQuantity(1);
        onClose();
    };

    const handleClose = () => {
        setQuantity(1);
        onClose();
    };

    if (!store) return null;

    const displayPrice = product?.sale_price || product?.price || 0;
    const hasDiscount = product?.sale_price && product.sale_price < product.price;
    const inStock = (product?.stock_quantity ?? 0) > 0;

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="sr-only">Quick View</DialogTitle>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="absolute right-4 top-4"
                        onClick={handleClose}
                        aria-label="Close"
                    >
                        <X className="w-4 h-4" />
                    </Button>
                </DialogHeader>

                {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                    </div>
                ) : product ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Image */}
                        <div className="aspect-square relative bg-muted rounded-lg overflow-hidden">
                            <ProductImage
                                src={product.image_url}
                                alt={product.product_name || 'Product image'}
                                className="w-full h-full"
                            />
                            {hasDiscount && (
                                <Badge className="absolute top-2 left-2" style={{ backgroundColor: store.primary_color }}>
                                    Sale
                                </Badge>
                            )}
                            {!inStock && (
                                <div className="absolute inset-0 bg-black/50 flex items-center justify-center" role="presentation">
                                    <Badge variant="secondary">Out of Stock</Badge>
                                </div>
                            )}
                        </div>

                        {/* Details */}
                        <div className="flex flex-col">
                            <div className="flex-1">
                                {product.category && (
                                    <p className="text-xs text-muted-foreground mb-1">{product.category}</p>
                                )}
                                <h2 className="text-2xl font-bold mb-2">{product.product_name}</h2>

                                {/* Price */}
                                <div className="flex items-baseline gap-2 mb-4">
                                    <span
                                        className="text-2xl font-bold"
                                        style={{ color: store.primary_color }}
                                    >
                                        {formatCurrency(displayPrice)}
                                    </span>
                                    {hasDiscount && (
                                        <span className="text-lg text-muted-foreground line-through">
                                            {formatCurrency(product.price)}
                                        </span>
                                    )}
                                </div>

                                {/* Description */}
                                {product.description && (
                                    <p className="text-sm text-muted-foreground mb-4 line-clamp-3">
                                        {product.description.replace(/<[^>]*>/g, '')}
                                    </p>
                                )}

                                {/* Quantity */}
                                <div className="mb-4">
                                    <p className="text-sm font-medium mb-2">Quantity</p>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                                            disabled={quantity <= 1}
                                            aria-label="Decrease quantity"
                                        >
                                            <Minus className="w-4 h-4" />
                                        </Button>
                                        <span className="w-12 text-center font-medium">{quantity}</span>
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            onClick={() => setQuantity((q) => Math.min(99, q + 1))}
                                            disabled={quantity >= 99}
                                            aria-label="Increase quantity"
                                        >
                                            <Plus className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="space-y-2">
                                <Button
                                    className="w-full"
                                    size="lg"
                                    style={{ backgroundColor: store.primary_color }}
                                    onClick={handleAddToCart}
                                    disabled={!inStock}
                                >
                                    <ShoppingCart className="w-4 h-4 mr-2" />
                                    {inStock ? 'Add to Cart' : 'Out of Stock'}
                                </Button>
                                <Link to={`/shop/${storeSlug}/products/${productId}`} onClick={handleClose}>
                                    <Button variant="outline" className="w-full" size="lg">
                                        <ExternalLink className="w-4 h-4 mr-2" />
                                        View Full Details
                                    </Button>
                                </Link>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-12">
                        <Package className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                        <p className="text-muted-foreground">Product not found</p>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
