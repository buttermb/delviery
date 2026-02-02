/**
 * TVMetricsWidget Component
 * 
 * 4 large, glanceable stat cards for TV display:
 * - Today's Revenue
 * - Open Orders
 * - Average Order Value
 * - Items Sold
 */

import { cn } from '@/lib/utils';
import TrendingUp from "lucide-react/dist/esm/icons/trending-up";
import TrendingDown from "lucide-react/dist/esm/icons/trending-down";
import Minus from "lucide-react/dist/esm/icons/minus";
import { motion, AnimatePresence } from 'framer-motion';

interface MetricData {
    label: string;
    value: string | number;
    trend?: 'up' | 'down' | 'neutral';
    trendValue?: string;
    prefix?: string;
}

interface TVMetricsWidgetProps {
    todayRevenue: number;
    openOrders: number;
    avgOrderValue: number;
    itemsSold: number;
    yesterdayRevenue?: number;
    yesterdayOrders?: number;
}

function MetricCard({ label, value, trend, trendValue, prefix = '' }: MetricData) {
    const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
    const trendColor = trend === 'up' ? 'text-emerald-400' : trend === 'down' ? 'text-red-400' : 'text-zinc-500';

    return (
        <motion.div
            layout
            className="bg-zinc-800/50 rounded-2xl p-6 border border-zinc-700/50 flex flex-col items-center justify-center"
        >
            <AnimatePresence mode="wait">
                <motion.div
                    key={String(value)}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="text-6xl font-bold text-white tabular-nums"
                    style={{ fontSize: 'clamp(3rem, 5vw, 5rem)' }}
                >
                    {prefix}{typeof value === 'number' ? value.toLocaleString() : value}
                </motion.div>
            </AnimatePresence>

            <div className="text-xl text-zinc-400 mt-2 font-medium">
                {label}
            </div>

            {trend && trendValue && (
                <div className={cn("flex items-center gap-1 mt-2", trendColor)}>
                    <TrendIcon className="w-5 h-5" />
                    <span className="text-sm font-medium">{trendValue} vs yesterday</span>
                </div>
            )}
        </motion.div>
    );
}

export function TVMetricsWidget({
    todayRevenue,
    openOrders,
    avgOrderValue,
    itemsSold,
    yesterdayRevenue = 0,
    yesterdayOrders = 0,
}: TVMetricsWidgetProps) {
    // Calculate trends
    const revenueTrend = yesterdayRevenue > 0
        ? todayRevenue >= yesterdayRevenue ? 'up' : 'down'
        : 'neutral';

    const revenueChange = yesterdayRevenue > 0
        ? Math.abs(((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100).toFixed(0) + '%'
        : undefined;

    const formatCurrency = (amount: number) => {
        if (amount >= 10000) {
            return `$${(amount / 1000).toFixed(1)}K`;
        }
        return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
    };

    return (
        <div className="h-full flex flex-col">
            <h2 className="text-xl font-semibold text-zinc-300 mb-4 px-2">Key Metrics</h2>
            <div className="grid grid-cols-2 gap-4 flex-1">
                <MetricCard
                    label="Today's Revenue"
                    value={formatCurrency(todayRevenue)}
                    trend={revenueTrend}
                    trendValue={revenueChange}
                />
                <MetricCard
                    label="Open Orders"
                    value={openOrders}
                />
                <MetricCard
                    label="Avg Order"
                    value={formatCurrency(avgOrderValue)}
                />
                <MetricCard
                    label="Items Sold"
                    value={itemsSold}
                />
            </div>
        </div>
    );
}
