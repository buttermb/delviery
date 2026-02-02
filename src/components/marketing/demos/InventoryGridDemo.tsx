/**
 * InventoryGridDemo Component
 * 
 * Enhanced inventory demo with product grid, stock levels, and alerts.
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Package from "lucide-react/dist/esm/icons/package";
import AlertTriangle from "lucide-react/dist/esm/icons/alert-triangle";
import Search from "lucide-react/dist/esm/icons/search";
import Filter from "lucide-react/dist/esm/icons/filter";

interface InventoryProduct {
    id: string;
    name: string;
    stock: number;
    threshold: number;
    emoji: string;
}

const MOCK_INVENTORY: InventoryProduct[] = [
    { id: '1', name: 'Premium OG Kush', stock: 45, threshold: 10, emoji: '🌿' },
    { id: '2', name: 'Blue Dream', stock: 8, threshold: 15, emoji: '💙' },
    { id: '3', name: 'Sativa Pre-roll 5pk', stock: 3, threshold: 10, emoji: '📦' },
    { id: '4', name: 'Indica Gummies', stock: 67, threshold: 20, emoji: '🍫' },
    { id: '5', name: 'Hybrid Vape Cart', stock: 12, threshold: 15, emoji: '💨' },
    { id: '6', name: 'CBD Tincture 1000mg', stock: 34, threshold: 10, emoji: '💧' },
    { id: '7', name: 'Wedding Cake', stock: 5, threshold: 10, emoji: '🎂' },
    { id: '8', name: 'Gorilla Glue', stock: 89, threshold: 20, emoji: '🦍' },
];

export function InventoryGridDemo() {
    const [inventory, setInventory] = useState(MOCK_INVENTORY);
    const [searchQuery, setSearchQuery] = useState('');

    // Simulate stock changes
    useEffect(() => {
        const timer = setInterval(() => {
            setInventory(prev => prev.map(p => ({
                ...p,
                stock: Math.max(0, p.stock + Math.floor(Math.random() * 5) - 2),
            })));
        }, 4000);
        return () => clearInterval(timer);
    }, []);

    const getStockStatus = (stock: number, threshold: number) => {
        if (stock <= 5) return { color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30', label: 'Critical' };
        if (stock <= threshold) return { color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30', label: 'Low' };
        return { color: 'text-[hsl(var(--marketing-primary))]', bg: 'bg-[hsl(var(--marketing-primary))]/10', border: 'border-[hsl(var(--marketing-primary))]/30', label: 'Good' };
    };

    const filteredInventory = inventory.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const lowStockCount = inventory.filter(p => p.stock <= p.threshold).length;

    return (
        <div className="w-full h-full bg-[hsl(var(--marketing-bg))] rounded-xl overflow-hidden border border-[hsl(var(--marketing-border))]">
            {/* Header */}
            <div className="px-4 py-3 border-b border-[hsl(var(--marketing-border))] flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Package className="w-5 h-5 text-[hsl(var(--marketing-primary))]" />
                    <h3 className="font-semibold text-[hsl(var(--marketing-text))]">Inventory</h3>
                </div>

                {lowStockCount > 0 && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="flex items-center gap-1 text-amber-400 bg-amber-500/10 px-2 py-1 rounded-full text-xs"
                    >
                        <AlertTriangle className="w-3 h-3" />
                        {lowStockCount} low stock
                    </motion.div>
                )}
            </div>

            {/* Search Bar */}
            <div className="px-4 py-2 border-b border-[hsl(var(--marketing-border))]">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(var(--marketing-text-light))]" />
                    <input
                        type="text"
                        placeholder="Search products..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-[hsl(var(--marketing-bg-subtle))] border border-[hsl(var(--marketing-border))] rounded-lg pl-9 pr-3 py-2 text-sm text-[hsl(var(--marketing-text))] placeholder:text-[hsl(var(--marketing-text-light))] focus:outline-none focus:border-primary/50"
                    />
                </div>
            </div>

            {/* Product Grid */}
            <div className="p-3 grid grid-cols-4 gap-2 h-[calc(100%-100px)] overflow-y-auto">
                <AnimatePresence>
                    {filteredInventory.map(product => {
                        const status = getStockStatus(product.stock, product.threshold);
                        return (
                            <motion.div
                                key={product.id}
                                layout
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className={`${status.bg} rounded-lg p-3 border ${status.border}`}
                            >
                                <div className="text-xl mb-1">{product.emoji}</div>
                                <div className="text-xs font-medium text-[hsl(var(--marketing-text))] truncate mb-1">{product.name}</div>
                                <div className="flex items-center justify-between">
                                    <AnimatePresence mode="wait">
                                        <motion.span
                                            key={product.stock}
                                            initial={{ opacity: 0, y: 5 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className={`text-lg font-bold ${status.color}`}
                                        >
                                            {product.stock}
                                        </motion.span>
                                    </AnimatePresence>
                                    <span className={`text-xs ${status.color}`}>{status.label}</span>
                                </div>
                            </motion.div>
                        );
                    })}
                </AnimatePresence>
            </div>
        </div>
    );
}
