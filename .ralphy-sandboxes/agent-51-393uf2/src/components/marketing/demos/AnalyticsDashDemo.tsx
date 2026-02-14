/**
 * AnalyticsDashDemo Component
 * 
 * Enhanced analytics demo with animated charts and KPIs.
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BarChart3, TrendingUp, DollarSign, Users, ShoppingCart } from 'lucide-react';

const MOCK_HOURLY_DATA = [35, 45, 60, 80, 95, 110, 90, 100, 120, 85, 70, 55];

export function AnalyticsDashDemo() {
    const [revenue, setRevenue] = useState(24890);
    const [orders, setOrders] = useState(156);
    const [customers, setCustomers] = useState(89);
    const [hourlyData, setHourlyData] = useState(MOCK_HOURLY_DATA);

    // Animate metrics
    useEffect(() => {
        const timer = setInterval(() => {
            setRevenue(prev => prev + Math.floor(Math.random() * 200) - 50);
            setOrders(prev => Math.max(100, prev + Math.floor(Math.random() * 6) - 2));
            setCustomers(prev => Math.max(50, prev + Math.floor(Math.random() * 4) - 1));
            setHourlyData(prev => prev.map(v => Math.max(20, v + Math.floor(Math.random() * 20) - 10)));
        }, 2500);
        return () => clearInterval(timer);
    }, []);

    const maxHeight = Math.max(...hourlyData);

    return (
        <div className="w-full h-full bg-[hsl(var(--marketing-bg))] rounded-xl overflow-hidden border border-[hsl(var(--marketing-border))] p-4">
            <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="w-5 h-5 text-primary" />
                <h3 className="font-semibold text-[hsl(var(--marketing-text))]">Analytics Dashboard</h3>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-4">
                {/* Revenue */}
                <motion.div className="bg-[hsl(var(--marketing-bg-subtle))] rounded-xl p-4 border border-[hsl(var(--marketing-border))]">
                    <div className="flex items-center gap-2 text-[hsl(var(--marketing-text-light))] text-sm mb-2">
                        <DollarSign className="w-4 h-4" />
                        Revenue
                    </div>
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={revenue}
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-2xl font-bold text-[hsl(var(--marketing-text))]"
                        >
                            ${revenue.toLocaleString()}
                        </motion.div>
                    </AnimatePresence>
                    <div className="flex items-center gap-1 text-emerald-400 text-sm mt-1">
                        <TrendingUp className="w-3 h-3" />
                        +18.2%
                    </div>
                </motion.div>

                {/* Orders */}
                <motion.div className="bg-[hsl(var(--marketing-bg-subtle))] rounded-xl p-4 border border-[hsl(var(--marketing-border))]">
                    <div className="flex items-center gap-2 text-[hsl(var(--marketing-text-light))] text-sm mb-2">
                        <ShoppingCart className="w-4 h-4" />
                        Orders
                    </div>
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={orders}
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-2xl font-bold text-[hsl(var(--marketing-text))]"
                        >
                            {orders}
                        </motion.div>
                    </AnimatePresence>
                    <div className="flex items-center gap-1 text-emerald-400 text-sm mt-1">
                        <TrendingUp className="w-3 h-3" />
                        +12.5%
                    </div>
                </motion.div>

                {/* Customers */}
                <motion.div className="bg-[hsl(var(--marketing-bg-subtle))] rounded-xl p-4 border border-[hsl(var(--marketing-border))]">
                    <div className="flex items-center gap-2 text-[hsl(var(--marketing-text-light))] text-sm mb-2">
                        <Users className="w-4 h-4" />
                        Customers
                    </div>
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={customers}
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-2xl font-bold text-[hsl(var(--marketing-text))]"
                        >
                            {customers}
                        </motion.div>
                    </AnimatePresence>
                    <div className="flex items-center gap-1 text-emerald-400 text-sm mt-1">
                        <TrendingUp className="w-3 h-3" />
                        +8.3%
                    </div>
                </motion.div>
            </div>

            {/* Chart */}
            <div className="bg-[hsl(var(--marketing-bg-subtle))] rounded-xl p-4 border border-[hsl(var(--marketing-border))] h-[calc(100%-180px)]">
                <div className="flex items-center justify-between mb-3">
                    <span className="text-sm text-[hsl(var(--marketing-text-light))]">Hourly Sales</span>
                    <span className="text-xs text-[hsl(var(--marketing-text-light))]">Last 12 hours</span>
                </div>
                <div className="flex items-end gap-2 h-[calc(100%-30px)]">
                    {hourlyData.map((value, i) => (
                        <motion.div
                            key={i}
                            className="flex-1 relative group"
                            initial={{ height: 0 }}
                            animate={{ height: `${(value / maxHeight) * 100}%` }}
                            transition={{ type: 'spring', stiffness: 100, damping: 15 }}
                        >
                            <div
                                className={`absolute inset-0 rounded-t-lg ${i === hourlyData.length - 1
                                    ? 'bg-gradient-to-t from-emerald-600 to-emerald-400'
                                    : 'bg-gradient-to-t from-primary/80 to-primary/40'
                                    }`}
                            />
                            <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-[hsl(var(--marketing-primary))] px-1.5 py-0.5 rounded text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity">
                                ${value}
                            </div>
                        </motion.div>
                    ))}
                </div>
                <div className="flex justify-between mt-2 text-xs text-[hsl(var(--marketing-text-light))]">
                    <span>12am</span>
                    <span>6am</span>
                    <span>12pm</span>
                    <span>Now</span>
                </div>
            </div>
        </div>
    );
}
