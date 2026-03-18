/**
 * OrderKanbanDemo Component
 * 
 * Simulates the Live Orders Kanban board with animating orders.
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingBag, Utensils, CheckCircle2, Clock } from 'lucide-react';

interface DemoOrder {
    id: string;
    total: number;
    source: string;
    minutes: number;
}

const INITIAL_ORDERS: Record<string, DemoOrder[]> = {
    new: [
        { id: '104', total: 85, source: 'Menu #2', minutes: 2 },
        { id: '105', total: 142, source: 'App Order', minutes: 0 },
    ],
    preparing: [
        { id: '103', total: 67, source: 'Menu #1', minutes: 6 },
        { id: '102', total: 234, source: 'Walk-in', minutes: 9 },
    ],
    ready: [
        { id: '101', total: 56, source: 'App Order', minutes: 14 },
    ],
};

export function OrderKanbanDemo() {
    const [orders, setOrders] = useState(INITIAL_ORDERS);

    // Simulate order movement
    useEffect(() => {
        const timer = setInterval(() => {
            setOrders(prev => {
                const newOrders = { ...prev };

                // Move a random order to the next stage
                if (prev.new.length > 0 && Math.random() > 0.5) {
                    const [order, ...rest] = prev.new;
                    newOrders.new = rest;
                    newOrders.preparing = [...prev.preparing, { ...order, minutes: 0 }];
                } else if (prev.preparing.length > 0 && Math.random() > 0.6) {
                    const [order, ...rest] = prev.preparing;
                    newOrders.preparing = rest;
                    newOrders.ready = [...prev.ready, { ...order, minutes: 0 }];
                } else if (Math.random() > 0.7) {
                    // Add new order
                    newOrders.new = [
                        { id: String(Math.floor(Math.random() * 900) + 100), total: Math.floor(Math.random() * 200) + 30, source: ['Menu #1', 'Menu #2', 'App Order'][Math.floor(Math.random() * 3)], minutes: 0 },
                        ...prev.new.slice(0, 3),
                    ];
                }

                // Update minutes
                Object.keys(newOrders).forEach(key => {
                    newOrders[key as keyof typeof newOrders] = newOrders[key as keyof typeof newOrders].map(o => ({
                        ...o,
                        minutes: o.minutes + 1,
                    }));
                });

                return newOrders;
            });
        }, 2000);

        return () => clearInterval(timer);
    }, []);

    const getUrgencyColor = (minutes: number) => {
        if (minutes < 5) return 'border-[hsl(var(--marketing-accent))] bg-[hsl(var(--marketing-accent))]/10';
        if (minutes < 10) return 'border-[hsl(var(--marketing-primary))] bg-[hsl(var(--marketing-primary))]/10';
        return 'border-red-500 bg-red-500/10';
    };

    const columns = [
        { id: 'new', label: 'New', icon: ShoppingBag, color: 'text-[hsl(var(--marketing-primary))] border-[hsl(var(--marketing-primary))]/30' },
        { id: 'preparing', label: 'Preparing', icon: Utensils, color: 'text-[hsl(var(--marketing-accent))] border-[hsl(var(--marketing-accent))]/30' },
        { id: 'ready', label: 'Ready', icon: CheckCircle2, color: 'text-[hsl(var(--marketing-text))] border-[hsl(var(--marketing-text))]/30' },
    ];

    return (
        <div className="w-full h-full bg-[hsl(var(--marketing-bg))] rounded-xl p-4 border border-[hsl(var(--marketing-border))]">
            <div className="flex items-center gap-2 mb-4">
                <ShoppingBag className="w-5 h-5 text-primary" />
                <h3 className="font-semibold text-[hsl(var(--marketing-text))]">Live Orders</h3>
            </div>

            <div className="grid grid-cols-3 gap-3 h-[calc(100%-40px)]">
                {columns.map(col => (
                    <div key={col.id} className="flex flex-col">
                        <div className={`flex items-center gap-2 pb-2 mb-2 border-b ${col.color}`}>
                            <col.icon className="w-4 h-4" />
                            <span className="text-sm font-medium text-[hsl(var(--marketing-text))]">{col.label}</span>
                            <span className="ml-auto bg-[hsl(var(--marketing-bg-subtle))] px-2 py-0.5 rounded-full text-xs text-[hsl(var(--marketing-text-light))]">
                                {orders[col.id as keyof typeof orders].length}
                            </span>
                        </div>

                        <div className="flex-1 overflow-y-auto space-y-2">
                            <AnimatePresence>
                                {orders[col.id as keyof typeof orders].map(order => (
                                    <motion.div
                                        key={order.id}
                                        layout
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.9 }}
                                        className={`rounded-lg p-3 border-2 ${getUrgencyColor(order.minutes)}`}
                                    >
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-sm font-bold text-[hsl(var(--marketing-text))]">#{order.id}</span>
                                            <span className="text-sm font-semibold text-[hsl(var(--marketing-text))]">${order.total}</span>
                                        </div>
                                        <div className="text-xs text-[hsl(var(--marketing-text-light))] mb-1">{order.source}</div>
                                        <div className="flex items-center gap-1 text-[hsl(var(--marketing-text-light))] text-xs">
                                            <Clock className="w-3 h-3" />
                                            {order.minutes}m ago
                                        </div>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
