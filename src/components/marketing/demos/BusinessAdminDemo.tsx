/**
 * BusinessAdminDemo Component
 * 
 * Demonstrates the admin dashboard interface.
 * Desktop: Full sidebar and dashboard layout
 * Mobile: Simplified stats and order list
 */

import { motion } from 'framer-motion';
import LayoutDashboard from "lucide-react/dist/esm/icons/layout-dashboard";
import ShoppingCart from "lucide-react/dist/esm/icons/shopping-cart";
import Package from "lucide-react/dist/esm/icons/package";
import Users from "lucide-react/dist/esm/icons/users";
import Settings from "lucide-react/dist/esm/icons/settings";
import Bell from "lucide-react/dist/esm/icons/bell";
import Search from "lucide-react/dist/esm/icons/search";
import Menu from "lucide-react/dist/esm/icons/menu";
import MoreVertical from "lucide-react/dist/esm/icons/more-vertical";
import TrendingUp from "lucide-react/dist/esm/icons/trending-up";
import DollarSign from "lucide-react/dist/esm/icons/dollar-sign";
import Clock from "lucide-react/dist/esm/icons/clock";
import CheckCircle2 from "lucide-react/dist/esm/icons/check-circle-2";
import Zap from "lucide-react/dist/esm/icons/zap";
import { useMobileOptimized } from '@/hooks/useMobileOptimized';

// Mobile-optimized version
function BusinessAdminDemoMobile() {
    const stats = [
        { label: 'Revenue', value: '$24.5K', trend: '+12%', icon: DollarSign, color: 'text-indigo-600', bg: 'bg-indigo-50' },
        { label: 'Orders', value: '18', trend: '+4', icon: ShoppingCart, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    ];

    const orders = [
        { customer: 'Green Relief', amount: '$1,250', status: 'Processing' },
        { customer: 'Urban Wellness', amount: '$850', status: 'Completed' },
    ];

    return (
        <div className="w-full h-full min-h-[280px] bg-slate-50 rounded-lg overflow-hidden flex flex-col">
            {/* Header */}
            <div className="h-12 bg-slate-900 flex items-center justify-between px-4">
                <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded bg-indigo-600 flex items-center justify-center">
                        <span className="font-bold text-white text-xs">F</span>
                    </div>
                    <span className="text-white font-semibold text-sm">FloraIQ</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                    <span className="text-emerald-400 text-xs">Live</span>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 p-4 space-y-4">
                {/* Stats */}
                <div className="grid grid-cols-2 gap-3">
                    {stats.map((stat, i) => (
                        <div key={i} className="bg-white rounded-xl p-3 border border-slate-100 shadow-sm">
                            <div className="flex items-center gap-2 mb-1">
                                <div className={`p-1.5 rounded-lg ${stat.bg}`}>
                                    <stat.icon className={`w-4 h-4 ${stat.color}`} />
                                </div>
                            </div>
                            <div className="text-xl font-bold text-slate-900">{stat.value}</div>
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-slate-500">{stat.label}</span>
                                <span className="text-xs text-emerald-600 font-medium">{stat.trend}</span>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Orders */}
                <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-50">
                        <span className="text-sm font-semibold text-slate-900">Recent Orders</span>
                    </div>
                    {orders.map((order, i) => (
                        <div key={i} className="px-4 py-3 flex items-center justify-between border-b border-slate-50 last:border-0">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-medium text-xs">
                                    {order.customer.charAt(0)}
                                </div>
                                <span className="text-sm font-medium text-slate-900">{order.customer}</span>
                            </div>
                            <div className="text-right">
                                <div className="text-sm font-bold text-slate-900">{order.amount}</div>
                                <div className={`text-[10px] font-bold ${order.status === 'Completed' ? 'text-emerald-600' : 'text-amber-600'}`}>
                                    {order.status}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Chart Placeholder */}
                <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
                    <div className="text-sm font-semibold text-slate-900 mb-3">Revenue</div>
                    <div className="flex items-end gap-1 h-16">
                        {[40, 65, 45, 80, 55, 90, 75].map((h, i) => (
                            <div
                                key={i}
                                className="flex-1 bg-indigo-500 rounded-t-sm opacity-80"
                                style={{ height: `${h}%` }}
                            />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

export function BusinessAdminDemo() {
    const { shouldUseStaticFallback } = useMobileOptimized();

    // Mobile fallback
    if (shouldUseStaticFallback) {
        return <BusinessAdminDemoMobile />;
    }

    const sidebarItems = [
        { icon: LayoutDashboard, label: 'Dashboard', active: true },
        { icon: ShoppingCart, label: 'Orders' },
        { icon: Package, label: 'Inventory' },
        { icon: Users, label: 'Customers' },
        { icon: Menu, label: 'Menus' },
        { icon: Settings, label: 'Settings' },
    ];

    const stats = [
        {
            label: 'Total Revenue',
            value: '$24,592.00',
            trend: '+12.5%',
            positive: true,
            icon: DollarSign,
            color: 'bg-[hsl(var(--marketing-primary))]'
        },
        {
            label: 'Active Orders',
            value: '18',
            trend: '+4',
            positive: true,
            icon: ShoppingCart,
            color: 'bg-emerald-500'
        },
        {
            label: 'Low Stock Items',
            value: '3',
            trend: '-2',
            positive: true,
            icon: Package,
            color: 'bg-amber-500'
        },
        {
            label: 'New Customers',
            value: '156',
            trend: '+22.4%',
            positive: true,
            icon: Users,
            color: 'bg-blue-500'
        }
    ];

    const recentOrders = [
        { id: '#ORD-7829', customer: 'Green Relief Co.', amount: '$1,250.00', status: 'Processing', time: '2 min ago' },
        { id: '#ORD-7828', customer: 'Urban Wellness', amount: '$850.00', status: 'Completed', time: '15 min ago' },
        { id: '#ORD-7827', customer: 'High Tide Dispensary', amount: '$2,100.00', status: 'Completed', time: '1 hour ago' },
        { id: '#ORD-7826', customer: 'Nature\'s Gift', amount: '$420.00', status: 'Processing', time: '2 hours ago' },
    ];

    return (
        <div className="flex h-full w-full bg-slate-50 font-sans text-slate-800 overflow-hidden rounded-lg">

            {/* Sidebar - Mimicking App Sidebar */}
            <div className="w-16 md:w-56 bg-slate-900 text-white flex flex-col border-r border-slate-800">
                <div className="h-14 flex items-center px-4 md:px-6 border-b border-slate-800">
                    <div className="w-6 h-6 rounded bg-[hsl(var(--marketing-primary))] flex items-center justify-center mr-2">
                        <span className="font-bold text-white text-xs">F</span>
                    </div>
                    <span className="font-semibold hidden md:block tracking-tight">FloraIQ</span>
                </div>

                <div className="flex-1 py-4 space-y-1 px-3">
                    {sidebarItems.map((item, i) => (
                        <div
                            key={i}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-md cursor-pointer transition-colors ${item.active ? 'bg-[hsl(var(--marketing-primary))] text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
                        >
                            <item.icon className="w-5 h-5 flex-shrink-0" />
                            <span className="text-sm font-medium hidden md:block">{item.label}</span>
                        </div>
                    ))}
                </div>

                <div className="p-4 border-t border-slate-800 hidden md:block">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-700" />
                        <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">Demo Admin</div>
                            <div className="text-xs text-slate-400 truncate">admin@floraiq.com</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col min-w-0 bg-slate-50">

                {/* Top Header */}
                <div className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-6 shadow-sm z-10">
                    <div className="flex items-center gap-4 text-slate-400 w-1/3">
                        <Search className="w-4 h-4" />
                        <div className="h-2 w-32 bg-slate-100 rounded-full"></div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button className="p-2 text-slate-400 hover:bg-slate-50 rounded-full relative" aria-label="Notifications">
                            <Bell className="w-4 h-4" aria-hidden="true" />
                            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-white"></span>
                        </button>
                        <div className="w-8 h-8 rounded-full bg-[hsl(var(--marketing-primary))]/10 text-[hsl(var(--marketing-primary))] flex items-center justify-center font-bold text-xs border border-[hsl(var(--marketing-primary))]/20">
                            DA
                        </div>
                    </div>
                </div>

                {/* Dashboard Content */}
                <div className="flex-1 p-6 overflow-hidden flex flex-col">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-bold text-slate-900">Dashboard Overview</h2>
                        <div className="flex gap-2">
                            <div className="px-3 py-1.5 bg-white border border-slate-200 rounded-md text-xs font-medium text-slate-600 shadow-sm">Last 7 Days</div>
                            <div className="px-3 py-1.5 bg-[hsl(var(--marketing-primary))] text-white rounded-md text-xs font-medium shadow-sm">Export Report</div>
                        </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                        {stats.map((stat, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.1 }}
                                className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow"
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <div className={`p-2 rounded-lg ${stat.color} bg-opacity-10`}>
                                        <stat.icon className={`w-4 h-4 ${stat.color.replace('bg-', 'text-')}`} />
                                    </div>
                                    <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${stat.positive ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                                        {stat.trend}
                                    </span>
                                </div>
                                <div className="text-2xl font-bold text-slate-900">{stat.value}</div>
                                <div className="text-xs text-slate-500 mt-1">{stat.label}</div>
                            </motion.div>
                        ))}
                    </div>

                    {/* Main Visual Areas */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">

                        {/* Chart Area Mockup */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.4 }}
                            className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex flex-col"
                        >
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="font-semibold text-slate-900">Revenue Analytics</h3>
                                <MoreVertical className="w-4 h-4 text-slate-400" />
                            </div>
                            <div className="flex-1 flex items-end gap-2 px-2 pb-2">
                                {[40, 65, 45, 80, 55, 90, 75, 100, 85, 95].map((h, i) => (
                                    <div key={i} className="flex-1 bg-indigo-50 rounded-t-sm relative group overflow-hidden" style={{ height: `${h}%` }}>
                                        <div className="absolute inset-x-0 bottom-0 bg-[hsl(var(--marketing-primary))] h-full opacity-80 group-hover:opacity-100 transition-opacity" style={{ transformOrigin: 'bottom', transform: 'scaleY(1)' }}></div>
                                    </div>
                                ))}
                            </div>
                        </motion.div>

                        {/* Recent Activity List */}
                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.5 }}
                            className="bg-white rounded-xl border border-slate-200 shadow-sm p-0 overflow-hidden flex flex-col"
                        >
                            <div className="p-5 border-b border-slate-100">
                                <h3 className="font-semibold text-slate-900">Recent Orders</h3>
                            </div>
                            <div className="flex-1 overflow-y-auto">
                                {recentOrders.map((order, i) => (
                                    <div key={i} className="p-4 border-b border-slate-50 hover:bg-slate-50 transition-colors flex items-center justify-between group">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-medium text-xs group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                                                {order.customer.charAt(0)}
                                            </div>
                                            <div>
                                                <div className="text-sm font-medium text-slate-900">{order.customer}</div>
                                                <div className="text-xs text-slate-500">{order.id}</div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-sm font-bold text-slate-900">{order.amount}</div>
                                            <div className={`text-[10px] uppercase font-bold tracking-wider ${order.status === 'Completed' ? 'text-green-600' : 'text-amber-600'}`}>
                                                {order.status}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    </div>

                </div>
            </div>
        </div>
    );
}
