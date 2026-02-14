/**
 * InteractiveDemoPage
 * 
 * Redesigned immersive product tour with vertical navigation and application-window styling.
 * Focuses on professional, clean aesthetics with consistent branding.
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { SEOHead } from '@/components/SEOHead';
import { MarketingNav } from '@/components/marketing/MarketingNav';
import { MarketingFooter } from '@/components/marketing/MarketingFooter';
import { ForceLightMode } from '@/components/marketing/ForceLightMode';
import { CTASection } from '@/components/marketing/CTASection';
import {
    LayoutDashboard,
    ShoppingCart,
    Package,
    CreditCard,
    QrCode,
    BarChart3,
    Truck,
    ArrowRight,
    CheckCircle2,
    Terminal
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Demo components
import { DashboardDemo } from '@/components/marketing/demos/DashboardDemo';
import { OrderKanbanDemo } from '@/components/marketing/demos/OrderKanbanDemo';
import { InventoryGridDemo } from '@/components/marketing/demos/InventoryGridDemo';
import { POSDemo } from '@/components/marketing/demos/POSDemo';
import { QRMenuDemo } from '@/components/marketing/demos/QRMenuDemo';
import { AnalyticsDashDemo } from '@/components/marketing/demos/AnalyticsDashDemo';
import { LiveMapDemo } from '@/components/marketing/demos/LiveMapDemo';
import { StorefrontDemo } from '@/components/marketing/demos/StorefrontDemo';

const DEMO_TABS = [
    {
        id: 'dashboard',
        label: 'Command Center',
        icon: LayoutDashboard,
        subtitle: 'Real-time Operations',
        description: 'A unified view of your entire distribution network. Monitor active orders, fleet status, and revenue in real-time.',
        features: ['Live metric tracking', 'Activity feed', 'Multi-location view'],
        component: DashboardDemo,
    },
    {
        id: 'orders',
        label: 'Order Management',
        icon: ShoppingCart,
        subtitle: 'Kanban Workflow',
        description: 'Streamline fulfillment with drag-and-drop order management. Automate status updates and keep your team synchronized.',
        features: ['Visual pipeline', 'Automated status updates', 'Team collaboration'],
        component: OrderKanbanDemo,
    },
    {
        id: 'inventory',
        label: 'Smart Inventory',
        icon: Package,
        subtitle: 'Stock Control',
        description: 'Never run out of stock again. Track batches, manage variants, and set automated low-stock alerts.',
        features: ['Batch tracking', 'Low-stock alerts', 'Multi-warehouse support'],
        component: InventoryGridDemo,
    },
    {
        id: 'pos',
        label: 'Point of Sale',
        icon: CreditCard,
        subtitle: 'Retail & Delivery',
        description: 'Process transactions anywhere. Optimized for speed and compliance, whether in-store or on the go.',
        features: ['Fast checkout', 'Offline mode', 'Integrated payments'],
        component: POSDemo,
    },
    {
        id: 'menus',
        label: 'Digital Menus',
        icon: QrCode,
        subtitle: 'QR & Links',
        description: 'Create beautiful, disposable digital menus. Securely share live inventory with customers via QR codes.',
        features: ['Live inventory sync', 'Custom branding', 'Access analytics'],
        component: QRMenuDemo,
    },
    {
        id: 'analytics',
        label: 'Business Intelligence',
        icon: BarChart3,
        subtitle: 'Data & Reports',
        description: 'Deep dive into your performance. Visualize trends, track KPIs, and export detailed reports.',
        features: ['Revenue forecasting', 'Driver performance', 'Custom reporting'],
        component: AnalyticsDashDemo,
    },
    {
        id: 'delivery',
        label: 'Logistics',
        icon: Truck,
        subtitle: 'Fleet Management',
        description: 'Optimize routes and track drivers in real-time. Give customers accurate ETAs and improve delivery efficiency.',
        features: ['Route optimization', 'Live GPS tracking', 'Customer notifications'],
        component: LiveMapDemo,
    },
    {
        id: 'storefront',
        label: 'E-Commerce',
        icon: ShoppingCart,
        subtitle: 'Brand Storefront',
        description: 'A premium, white-label shopping experience for your customers. SEO-optimized and fully integrated.',
        features: ['Mobile-first design', 'SEO ready', 'Instant sync'],
        component: StorefrontDemo,
    },
];

export default function InteractiveDemoPage() {
    const [activeTab, setActiveTab] = useState('dashboard');
    const activeDemo = DEMO_TABS.find(t => t.id === activeTab)!;

    // Scroll to top on mount
    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    return (
        <ForceLightMode>
            <div className="min-h-dvh bg-neutral-50 font-sans text-neutral-900 selection:bg-emerald-100 selection:text-emerald-900">
                <SEOHead
                    title="Interactive Product Tour - FloraIQ"
                    description="Explore the FloraIQ platform. Interactive demos of Dashboard, Logistics, Inventory, and POS features."
                />

                <MarketingNav />

                {/* Hero Section */}
                <section className="pt-32 pb-12 px-4 md:pt-40 md:pb-20 relative overflow-hidden">
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-50/50 via-white to-white pointer-events-none" />

                    <div className="max-w-4xl mx-auto text-center relative z-10">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100/50 border border-emerald-200 text-emerald-800 text-sm font-medium mb-8"
                        >
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                            </span>
                            Live Product Tour
                        </motion.div>

                        <motion.h1
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                            className="text-5xl md:text-7xl font-bold tracking-tight text-neutral-900 mb-6"
                        >
                            See how FloraIQ works.
                        </motion.h1>

                        <motion.p
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            className="text-xl md:text-2xl text-neutral-600 max-w-2xl mx-auto leading-relaxed"
                        >
                            Experience the operating system for modern cannabis distribution. Click through the features below to explore content.
                        </motion.p>
                    </div>
                </section>

                {/* Main Interactive Section */}
                <section className="px-4 pb-24 relative z-10">
                    <div className="max-w-7xl mx-auto">
                        <div className="flex flex-col lg:flex-row gap-8 lg:gap-12">

                            {/* Navigation Sidebar (Desktop) / Horizontal Scroll (Mobile) */}
                            <div className="lg:w-1/3 flex-shrink-0">
                                <div className="lg:sticky lg:top-24 space-y-2">
                                    <div className="flex lg:flex-col gap-3 overflow-x-auto pb-4 lg:pb-0 scrollbar-hide snap-x">
                                        {DEMO_TABS.map((tab) => {
                                            const isActive = activeTab === tab.id;
                                            return (
                                                <button
                                                    key={tab.id}
                                                    onClick={() => setActiveTab(tab.id)}
                                                    className={cn(
                                                        "flex-shrink-0 snap-start w-[280px] lg:w-full text-left p-4 rounded-xl transition-all duration-200 border group",
                                                        isActive
                                                            ? "bg-white border-emerald-500/30 shadow-lg shadow-emerald-500/5 ring-1 ring-emerald-500/20"
                                                            : "bg-white/50 border-transparent hover:bg-white hover:border-neutral-200"
                                                    )}
                                                >
                                                    <div className="flex items-start gap-4">
                                                        <div className={cn(
                                                            "w-10 h-10 rounded-lg flex items-center justify-center transition-colors",
                                                            isActive ? "bg-emerald-500 text-white" : "bg-neutral-100 text-neutral-500 group-hover:bg-neutral-200"
                                                        )}>
                                                            <tab.icon className="w-5 h-5" />
                                                        </div>
                                                        <div>
                                                            <div className={cn("font-semibold text-neutral-900", isActive && "text-emerald-700")}>
                                                                {tab.label}
                                                            </div>
                                                            <div className="text-sm text-neutral-500 mt-1">
                                                                {tab.subtitle}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>

                                    {/* Desktop-only Context Box */}
                                    <div className="hidden lg:block mt-8 p-6 bg-emerald-50 rounded-2xl border border-emerald-100">
                                        <h3 className="font-semibold text-emerald-900 mb-2 flex items-center gap-2">
                                            <Terminal className="w-4 h-4" />
                                            {activeDemo.label}
                                        </h3>
                                        <p className="text-emerald-800/80 text-sm mb-4 leading-relaxed">
                                            {activeDemo.description}
                                        </p>
                                        <ul className="space-y-2 mb-6">
                                            {activeDemo.features.map(f => (
                                                <li key={f} className="flex items-center gap-2 text-sm text-emerald-800">
                                                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                                    {f}
                                                </li>
                                            ))}
                                        </ul>
                                        <Link to="/signup">
                                            <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-900/10">
                                                Try it Yourself
                                                <ArrowRight className="w-4 h-4 ml-2" />
                                            </Button>
                                        </Link>
                                    </div>
                                </div>
                            </div>

                            {/* Demo Viewer */}
                            <div className="lg:w-2/3 min-h-[500px] lg:min-h-[700px]">
                                <motion.div
                                    layoutId="demo-container"
                                    className="bg-white rounded-2xl md:rounded-3xl shadow-2xl shadow-neutral-200/50 border border-neutral-200 overflow-hidden h-[500px] md:h-[700px] flex flex-col relative"
                                >
                                    {/* App Window Header */}
                                    <div className="h-10 border-b bg-neutral-50/80 backdrop-blur flex items-center px-4 gap-2 flex-shrink-0 z-20">
                                        <div className="w-3 h-3 rounded-full bg-red-400/80" />
                                        <div className="w-3 h-3 rounded-full bg-amber-400/80" />
                                        <div className="w-3 h-3 rounded-full bg-green-400/80" />
                                        <div className="ml-4 px-3 py-1 rounded bg-neutral-200/50 text-[10px] font-mono text-neutral-500 flex items-center gap-2">
                                            <span className="w-2 h-2 rounded-full bg-emerald-500" />
                                            floraiq.app / {activeTab}
                                        </div>
                                    </div>

                                    {/* Demo Content */}
                                    <div className="flex-1 relative bg-neutral-50/30 overflow-hidden">
                                        <AnimatePresence mode="popLayout">
                                            <motion.div
                                                key={activeTab}
                                                initial={{ opacity: 0, y: 10, scale: 0.99 }}
                                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                                exit={{ opacity: 0, scale: 0.99 }}
                                                transition={{ duration: 0.3 }}
                                                className="absolute inset-0 p-4 md:p-8 overflow-y-auto"
                                            >
                                                <activeDemo.component />
                                            </motion.div>
                                        </AnimatePresence>
                                    </div>

                                    {/* Mobile-only Description Overlay (at bottom) */}
                                    <div className="lg:hidden p-4 bg-white/95 backdrop-blur border-t absolute bottom-0 left-0 right-0 z-30">
                                        <h3 className="font-bold text-sm mb-1">{activeDemo.label}</h3>
                                        <p className="text-xs text-neutral-500 line-clamp-2">{activeDemo.description}</p>
                                    </div>
                                </motion.div>
                            </div>

                        </div>
                    </div>
                </section>

                <CTASection
                    title="Ready to modernise your operations?"
                    description="Join the platform built for the future of cannabis distribution."
                    primaryCta={{ text: "Get Started", link: "/register" }}
                />

                <MarketingFooter />
            </div>
        </ForceLightMode>
    );
}
