/**
 * Cart Preview Popup
 * Shows a floating preview when an item is added to cart
 */

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingCart, X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import ProductImage from '@/components/ProductImage';
import { formatCurrency } from '@/lib/utils/formatCurrency';

interface CartPreviewItem {
    name: string;
    price: number;
    imageUrl: string | null;
    quantity: number;
}

interface CartPreviewPopupProps {
    item: CartPreviewItem | null;
    cartCount: number;
    cartTotal: number;
    storeSlug: string;
    onClose: () => void;
    autoDismissMs?: number;
}

export function CartPreviewPopup({
    item,
    cartCount,
    cartTotal,
    storeSlug,
    onClose,
    autoDismissMs = 4000,
}: CartPreviewPopupProps) {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        if (item) {
            setIsVisible(true);
            const timer = setTimeout(() => {
                setIsVisible(false);
                setTimeout(onClose, 300); // Wait for exit animation
            }, autoDismissMs);
            return () => clearTimeout(timer);
        }
    }, [item, autoDismissMs, onClose]);

    return (
        <AnimatePresence>
            {isVisible && item && (
                <motion.div
                    initial={{ opacity: 0, y: -20, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                    transition={{ duration: 0.3, ease: [0.2, 0.65, 0.3, 0.9] }}
                    className="fixed top-4 right-4 z-50 w-80 bg-neutral-900/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl shadow-black/50 overflow-hidden"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
                        <div className="flex items-center gap-2 text-success">
                            <Check className="w-4 h-4" />
                            <span className="text-sm font-medium">Added to Cart</span>
                        </div>
                        <button
                            onClick={() => {
                                setIsVisible(false);
                                setTimeout(onClose, 300);
                            }}
                            className="p-1 hover:bg-white/10 rounded-full transition-colors"
                        >
                            <X className="w-4 h-4 text-white/50" />
                        </button>
                    </div>

                    {/* Item Preview */}
                    <div className="flex items-center gap-3 p-4">
                        <div className="w-16 h-16 rounded-lg overflow-hidden bg-white/5 flex-shrink-0">
                            <ProductImage
                                src={item.imageUrl}
                                alt={item.name}
                                className="w-full h-full object-cover"
                            />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-white text-sm font-medium truncate">{item.name}</p>
                            <p className="text-white/50 text-xs">Qty: {item.quantity}</p>
                            <p className="text-white font-medium">{formatCurrency(item.price)}</p>
                        </div>
                    </div>

                    {/* Cart Summary */}
                    <div className="px-4 py-3 bg-white/[0.02] border-t border-white/5">
                        <div className="flex items-center justify-between text-sm mb-3">
                            <span className="text-white/50">Cart ({cartCount} items)</span>
                            <span className="text-white font-medium">{formatCurrency(cartTotal)}</span>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                    setIsVisible(false);
                                    setTimeout(onClose, 300);
                                }}
                                className="flex-1 text-white border-white/10 hover:bg-white/10 rounded-full text-xs"
                            >
                                Continue Shopping
                            </Button>
                            <Link to={`/shop/${storeSlug}/cart`} className="flex-1">
                                <Button
                                    size="sm"
                                    className="w-full rounded-full text-xs" style={{ backgroundColor: 'var(--storefront-primary, white)', color: 'var(--storefront-bg, black)' }}
                                >
                                    <ShoppingCart className="w-3 h-3 mr-1" />
                                    View Cart
                                </Button>
                            </Link>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
