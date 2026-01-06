/**
 * POSDemo Component
 * 
 * Simulates the POS/Cash Register with product grid, cart, and payment flow.
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CreditCard, Plus, Minus, Trash2, CheckCircle2, DollarSign } from 'lucide-react';

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

export function POSDemo() {
    const [cart, setCart] = useState<CartItem[]>([]);
    const [processing, setProcessing] = useState(false);
    const [success, setSuccess] = useState(false);

    // Auto-demo: simulate adding items
    useEffect(() => {
        const timer = setTimeout(() => {
            if (cart.length < 3 && !processing && !success) {
                const randomProduct = MOCK_PRODUCTS[Math.floor(Math.random() * MOCK_PRODUCTS.length)];
                addToCart(randomProduct);
            }
        }, 2500);
        return () => clearTimeout(timer);
    }, [cart, processing, success]);

    const addToCart = (product: Product) => {
        setCart(prev => {
            const existing = prev.find(p => p.id === product.id);
            if (existing) {
                return prev.map(p => p.id === product.id ? { ...p, qty: p.qty + 1 } : p);
            }
            return [...prev, { ...product, qty: 1 }];
        });
    };

    const removeFromCart = (id: string) => {
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
