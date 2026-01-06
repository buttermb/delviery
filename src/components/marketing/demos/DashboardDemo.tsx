/**
 * DashboardDemo Component
 * 
 * Simulates the TV Dashboard / Command Center for demo purposes.
 * Shows animated metrics, live clock, and activity feed.
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUp, ShoppingBag, DollarSign, Package, Clock, Wifi } from 'lucide-react';

const MOCK_METRICS = [
    { label: "Today's Revenue", value: 12450, prefix: '$', trend: '+18%' },
    { label: 'Open Orders', value: 23, trend: '+5' },
    { label: 'Avg Order', value: 54, prefix: '$', trend: '+12%' },
    { label: 'Items Sold', value: 287, trend: '+34' },
];

const MOCK_ORDERS = [
    { id: '001', status: 'new', source: 'Menu #3', time: '2m ago' },
    { id: '002', status: 'preparing', source: 'App', time: '8m ago' },
    { id: '003', status: 'ready', source: 'Menu #1', time: '15m ago' },
    { id: '004', status: 'new', source: 'App', time: '1m ago' },
];

export function DashboardDemo() {
    const [time, setTime] = useState(new Date());
    const [metrics, setMetrics] = useState(MOCK_METRICS);

    // Animate clock
    useEffect(() => {
        const timer = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    // Animate metrics periodically
    useEffect(() => {
        const timer = setInterval(() => {
            setMetrics(prev => prev.map(m => ({
                ...m,
                value: m.value + Math.floor(Math.random() * 10) - 3,
            })));
        }, 3000);
        return () => clearInterval(timer);
    }, []);

    return (
        <div className="w-full h-full bg-[hsl(var(--marketing-bg))] rounded-xl overflow-hidden border border-[hsl(var(--marketing-border))] shadow-2xl">
            {/* Header */}
            <div className="bg-[hsl(var(--marketing-bg))] px-4 py-3 flex items-center justify-between border-b border-[hsl(var(--marketing-border))]">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[hsl(var(--marketing-primary))] to-[hsl(var(--marketing-secondary))] flex items-center justify-center shadow-lg shadow-[hsl(var(--marketing-primary))]/20">
                        <Package className="w-4 h-4 text-white" />
                    </div>
                    <span className="font-bold text-[hsl(var(--marketing-text))]">Demo Store</span>
                </div>
                <div className="text-center">
                    <div className="text-2xl font-mono font-bold text-[hsl(var(--marketing-accent))] tabular-nums shadow-[0_0_15px_rgba(234,179,8,0.2)]">
                        {time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                </div>
                <div className="flex items-center gap-2 text-[hsl(var(--marketing-accent))]">
                    <Wifi className="w-4 h-4" />
                    <span className="text-xs font-medium">Live</span>
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[hsl(var(--marketing-accent))] opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-[hsl(var(--marketing-accent))]"></span>
                    </span>
                </div>
            </div>

            {/* Main Grid */}
            <div className="grid grid-cols-2 gap-3 p-3 h-[calc(100%-60px)]">
                {/* Left - Order Cards */}
                <div className="bg-[hsl(var(--marketing-primary))]/5 rounded-lg p-3 border border-[hsl(var(--marketing-primary))]/10">
                    <div className="flex items-center gap-2 mb-3">
                        <ShoppingBag className="w-4 h-4 text-[hsl(var(--marketing-primary))]" />
                        <span className="text-sm font-medium text-[hsl(var(--marketing-text))]">Live Orders</span>
                    </div>
                    <div className="space-y-2">
                        <AnimatePresence>
                            {MOCK_ORDERS.map((order, i) => (
                                <motion.div
                                    key={order.id}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: i * 0.1 }}
                                    className={`flex items-center justify-between p-2 rounded-lg border backdrop-blur-sm transition-colors ${order.status === 'new' ? 'bg-[hsl(var(--marketing-primary))]/20 border-[hsl(var(--marketing-primary))]/30' :
                                        order.status === 'preparing' ? 'bg-[hsl(var(--marketing-secondary))]/20 border-[hsl(var(--marketing-secondary))]/30' :
                                            'bg-[hsl(var(--marketing-accent))]/10 border-[hsl(var(--marketing-accent))]/30'
                                        }`}
                                >
                                    <span className="text-sm font-bold text-[hsl(var(--marketing-text))]">#{order.id}</span>
                                    <span className="text-xs text-[hsl(var(--marketing-text-light))]">{order.source}</span>
                                    <span className="text-xs text-[hsl(var(--marketing-text-light))] flex items-center gap-1">
                                        <Clock className="w-3 h-3" /> {order.time}
                                    </span>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>
                </div>

                {/* Right - Metrics */}
                <div className="grid grid-cols-2 gap-2">
                    {metrics.map((metric, i) => (
                        <motion.div
                            key={metric.label}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: i * 0.1 }}
                            className="bg-[hsl(var(--marketing-primary))]/5 rounded-lg p-3 border border-[hsl(var(--marketing-primary))]/10 flex flex-col items-center justify-center relative overflow-hidden group"
                        >
                            <div className="absolute inset-0 bg-[hsl(var(--marketing-primary))]/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                            <AnimatePresence mode="wait">
                                <motion.div
                                    key={metric.value}
                                    initial={{ opacity: 0, y: 5 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="text-xl font-bold text-[hsl(var(--marketing-text))] relative z-10"
                                >
                                    {metric.prefix}{metric.value.toLocaleString()}
                                </motion.div>
                            </AnimatePresence>
                            <div className="text-xs text-[hsl(var(--marketing-text-light))] mt-1 relative z-10">{metric.label}</div>
                            <div className="text-xs text-[hsl(var(--marketing-accent))] flex items-center gap-0.5 mt-1 relative z-10">
                                <TrendingUp className="w-3 h-3" />
                                {metric.trend}
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>
        </div>
    );
}
