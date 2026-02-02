/**
 * TVLiveOrdersWidget Component
 * 
 * Simplified Kanban-style order display for TV:
 * - 3 columns: NEW | PREPARING | READY
 * - Color-coded urgency based on time
 * - Real-time updates
 */

import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import Clock from "lucide-react/dist/esm/icons/clock";
import ShoppingBag from "lucide-react/dist/esm/icons/shopping-bag";
import Utensils from "lucide-react/dist/esm/icons/utensils";
import CheckCircle2 from "lucide-react/dist/esm/icons/check-circle-2";

export interface TVOrder {
    id: string;
    orderNumber: string;
    source: string;
    total: number;
    status: 'new' | 'preparing' | 'ready' | 'completed';
    createdAt: Date;
    itemCount?: number;
}

interface TVLiveOrdersWidgetProps {
    orders: TVOrder[];
}

function getTimeAgo(date: Date): string {
    const minutes = Math.floor((Date.now() - date.getTime()) / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes === 1) return '1m ago';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
}

function getUrgencyColor(date: Date): string {
    const minutes = Math.floor((Date.now() - date.getTime()) / 60000);
    if (minutes < 5) return 'border-emerald-500 bg-emerald-500/10';
    if (minutes < 10) return 'border-amber-500 bg-amber-500/10';
    return 'border-red-500 bg-red-500/10';
}

function OrderCard({ order }: { order: TVOrder }) {
    const urgencyColor = getUrgencyColor(order.createdAt);

    return (
        <motion.div
            layout
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className={cn(
                "rounded-xl p-4 border-2",
                urgencyColor
            )}
        >
            <div className="flex items-center justify-between mb-2">
                <span className="text-2xl font-bold text-white">
                    #{order.orderNumber}
                </span>
                <span className="text-lg font-semibold text-emerald-400">
                    ${order.total.toFixed(0)}
                </span>
            </div>

            <div className="text-sm text-zinc-400 mb-2">
                {order.source}
            </div>

            <div className="flex items-center gap-2 text-zinc-500">
                <Clock className="w-4 h-4" />
                <span className="text-sm font-medium">
                    {getTimeAgo(order.createdAt)}
                </span>
            </div>
        </motion.div>
    );
}

function OrderColumn({
    title,
    icon: Icon,
    orders,
    color
}: {
    title: string;
    icon: typeof ShoppingBag;
    orders: TVOrder[];
    color: string;
}) {
    return (
        <div className="flex flex-col h-full">
            {/* Column Header */}
            <div className={cn("flex items-center gap-3 mb-4 pb-3 border-b", color)}>
                <Icon className="w-6 h-6" />
                <span className="text-xl font-bold">{title}</span>
                <span className="ml-auto bg-zinc-700 px-3 py-1 rounded-full text-lg font-semibold">
                    {orders.length}
                </span>
            </div>

            {/* Order Cards */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                <AnimatePresence>
                    {orders.map(order => (
                        <OrderCard key={order.id} order={order} />
                    ))}
                </AnimatePresence>

                {orders.length === 0 && (
                    <div className="text-center text-zinc-600 py-8">
                        No orders
                    </div>
                )}
            </div>
        </div>
    );
}

export function TVLiveOrdersWidget({ orders }: TVLiveOrdersWidgetProps) {
    const newOrders = orders.filter(o => o.status === 'new');
    const preparingOrders = orders.filter(o => o.status === 'preparing');
    const readyOrders = orders.filter(o => o.status === 'ready');

    return (
        <div className="h-full flex flex-col">
            <h2 className="text-xl font-semibold text-zinc-300 mb-4 px-2">Live Orders</h2>
            <div className="grid grid-cols-3 gap-6 flex-1 min-h-0">
                <OrderColumn
                    title="New"
                    icon={ShoppingBag}
                    orders={newOrders}
                    color="text-blue-400 border-blue-400/30"
                />
                <OrderColumn
                    title="Preparing"
                    icon={Utensils}
                    orders={preparingOrders}
                    color="text-amber-400 border-amber-400/30"
                />
                <OrderColumn
                    title="Ready"
                    icon={CheckCircle2}
                    orders={readyOrders}
                    color="text-emerald-400 border-emerald-400/30"
                />
            </div>
        </div>
    );
}
