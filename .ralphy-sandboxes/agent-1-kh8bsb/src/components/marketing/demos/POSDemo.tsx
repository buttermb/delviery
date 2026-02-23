/**
 * POSDemo Component
 * 
 * Simulates the POS/Cash Register with product grid, cart, and payment flow.
 * Mobile: Simplified product list with cart summary
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CreditCard, CheckCircle2, DollarSign, ShoppingCart, Zap } from 'lucide-react';
import { useMobileOptimized } from '@/hooks/useMobileOptimized';

interface Product {
    id: string;
    name: string;
    price: number;
    emoji: string;
}

interface CartItem extends Product {
    qty: number;
}

const MOCK_PRODUCTS: Product[] = [
    { id: '1', name: 'Premium OG', price: 45, emoji: '🌿' },
    { id: '2', name: 'Blue Dream', price: 38, emoji: '💙' },
    { id: '3', name: 'Sativa Pre-roll', price: 12, emoji: '📦' },
    { id: '4', name: 'Edibles Pack', price: 25, emoji: '🍫' },
    { id: '5', name: 'Vape Cart', price: 35, emoji: '💨' },
    { id: '6', name: 'CBD Oil', price: 55, emoji: '💧' },
];

// Mobile-optimized version
function POSDemoMobile() {
    const mockCart = [
        { name: 'Premium OG', price: 45, qty: 2 },
        { name: 'Blue Dream', price: 38, qty: 1 },
    ];
    const total = mockCart.reduce((sum, item) => sum + item.price * item.qty, 0);

    return (
        <div className="w-full min-h-[280px] bg-slate-50 rounded-xl overflow-hidden border border-slate-200 shadow-sm relative p-5">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center">
                        <CreditCard className="w-4 h-4 text-white" />
                    </div>
                    <div>
                        <div className="font-bold text-slate-900 text-sm">Point of Sale</div>
                        <div className="text-xs text-slate-500">Quick checkout</div>
                    </div>
                </div>
                <div className="flex items-center gap-1.5 text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-xs font-medium">Ready</span>
                </div>
            </div>

            {/* Product Grid (Simplified) */}
            <div className="grid grid-cols-3 gap-2 mb-4">
                {MOCK_PRODUCTS.slice(0, 6).map((product) => (
                    <div key={product.id} className="bg-white rounded-lg p-2 border border-slate-100 shadow-sm text-center">
                        <div className="text-xl mb-1">{product.emoji}</div>
                        <div className="text-xs text-slate-900 font-medium truncate">{product.name}</div>
                        <div className="text-xs text-indigo-600 font-bold">${product.price}</div>
                    </div>
                ))}
            </div>

            {/* Cart Summary */}
            <div className="bg-white rounded-xl p-3 border border-slate-100 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                        <ShoppingCart className="w-4 h-4" />
                        Cart ({mockCart.length} items)
                    </span>
                </div>
                {mockCart.map((item, i) => (
                    <div key={i} className="flex items-center justify-between py-1.5 border-b border-slate-50 last:border-0">
                        <span className="text-sm text-slate-700">{item.name} × {item.qty}</span>
                        <span className="text-sm font-medium text-slate-900">${item.price * item.qty}</span>
                    </div>
                ))}
                <div className="flex items-center justify-between pt-2 mt-2 border-t border-slate-100">
                    <span className="font-bold text-slate-900">Total</span>
                    <span className="text-lg font-bold text-indigo-600">${total}</span>
                </div>
            </div>

            {/* Pay Button */}
            <div className="mt-3">
                <div className="w-full py-3 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-center font-bold text-sm flex items-center justify-center gap-2">
                    <CreditCard className="w-4 h-4" />
                    Pay ${total}
                </div>
            </div>

            {/* Interactive Hint */}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-full shadow-lg">
                    <Zap className="w-3 h-3" />
                    POS Demo
                </div>
            </div>
        </div>
    );
}

export function POSDemo() {
    const { shouldUseStaticFallback } = useMobileOptimized();
    const [cart, setCart] = useState<CartItem[]>([]);
    const [processing, setProcessing] = useState(false);
    const [success, setSuccess] = useState(false);

    // Auto-demo: simulate adding items (skip on mobile)
    useEffect(() => {
        if (shouldUseStaticFallback) return;
        const timer = setTimeout(() => {
            if (cart.length < 3 && !processing && !success) {
                const randomProduct = MOCK_PRODUCTS[Math.floor(Math.random() * MOCK_PRODUCTS.length)];
                addToCart(randomProduct);
            }
        }, 2500);
        return () => clearTimeout(timer);
    }, [cart, processing, success, shouldUseStaticFallback]);

    // Mobile fallback
    if (shouldUseStaticFallback) {
        return <POSDemoMobile />;
    }

    const addToCart = (product: Product) => {
        setCart(prev => {
            const existing = prev.find(p => p.id === product.id);
            if (existing) {
                return prev.map(p => p.id === product.id ? { ...p, qty: p.qty + 1 } : p);
            }
            return [...prev, { ...product, qty: 1 }];
        });
    };

    const _removeFromCart = (id: string) => {
        setCart(prev => prev.filter(p => p.id !== id));
    };

    const total = cart.reduce((sum, item) => sum + item.price * item.qty, 0);

    const handlePayment = () => {
        if (cart.length === 0) return;
        setProcessing(true);
        setTimeout(() => {
            setProcessing(false);
            setSuccess(true);
            setTimeout(() => {
                setSuccess(false);
                setCart([]);
            }, 2000);
        }, 1500);
    };

    return (
        <div className="w-full h-full bg-[hsl(var(--marketing-bg))] rounded-xl overflow-hidden border border-[hsl(var(--marketing-border))] flex">
            {/* Product Grid */}
            <div className="flex-1 p-4">
                <div className="flex items-center gap-2 mb-4">
                    <CreditCard className="w-5 h-5 text-primary" />
                    <h3 className="font-semibold text-[hsl(var(--marketing-text))]">Point of Sale</h3>
                </div>

                <div className="grid grid-cols-3 gap-2">
                    {MOCK_PRODUCTS.map(product => (
                        <motion.button
                            key={product.id}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => addToCart(product)}
                            className="bg-[hsl(var(--marketing-bg-subtle))] border border-[hsl(var(--marketing-border))] rounded-lg p-3 text-left hover:border-primary/50 transition-colors"
                        >
                            <div className="text-2xl mb-1">{product.emoji}</div>
                            <div className="text-xs font-medium text-[hsl(var(--marketing-text))] truncate">{product.name}</div>
                            <div className="text-sm font-bold text-[hsl(var(--marketing-text))]">${product.price}</div>
                        </motion.button>
                    ))}
                </div>
            </div>

            {/* Cart Sidebar */}
            <div className="w-44 bg-[hsl(var(--marketing-bg-subtle))] border-l border-[hsl(var(--marketing-border))] flex flex-col">
                <div className="p-3 border-b border-[hsl(var(--marketing-border))]">
                    <div className="text-sm font-medium text-[hsl(var(--marketing-text-light))]">Cart</div>
                </div>

                <div className="flex-1 overflow-y-auto p-2 space-y-2">
                    <AnimatePresence>
                        {cart.map(item => (
                            <motion.div
                                key={item.id}
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                className="bg-[hsl(var(--marketing-bg))] rounded-lg p-2"
                            >
                                <div className="flex items-center justify-between">
                                    <span className="text-xs text-[hsl(var(--marketing-text))] truncate flex-1">{item.name}</span>
                                    <span className="text-xs text-[hsl(var(--marketing-text-light))]">x{item.qty}</span>
                                </div>
                                <div className="text-xs text-[hsl(var(--marketing-text))] mt-1">${item.price * item.qty}</div>
                            </motion.div>
                        ))}
                    </AnimatePresence>

                    {cart.length === 0 && (
                        <div className="text-xs text-zinc-600 text-center py-4">Empty cart</div>
                    )}
                </div>

                {/* Total & Pay */}
                <div className="p-3 border-t border-[hsl(var(--marketing-border))]">
                    <div className="flex justify-between mb-2">
                        <span className="text-sm text-[hsl(var(--marketing-text-light))]">Total</span>
                        <span className="text-lg font-bold text-[hsl(var(--marketing-text))]">${total}</span>
                    </div>

                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handlePayment}
                        disabled={cart.length === 0 || processing}
                        className={`w-full py-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${success
                            ? 'bg-[hsl(var(--marketing-accent))] text-white'
                            : processing
                                ? 'bg-blue-500 text-white animate-pulse'
                                : 'bg-primary text-primary-foreground hover:bg-primary/90'
                            }`}
                    >
                        {success ? (
                            <>
                                <CheckCircle2 className="w-4 h-4" />
                                Paid!
                            </>
                        ) : processing ? (
                            <>
                                <DollarSign className="w-4 h-4 animate-spin" />
                                Processing...
                            </>
                        ) : (
                            <>
                                <CreditCard className="w-4 h-4" />
                                Pay ${total}
                            </>
                        )}
                    </motion.button>
                </div>
            </div>
        </div>
    );
}
