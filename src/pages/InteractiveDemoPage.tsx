/**
 * InteractiveDemoPage
 * 
 * Main demo page with tabbed feature sections showing live animated demos.
 * No login required - showcases all platform features.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { SEOHead } from '@/components/SEOHead';
import { MarketingNav } from '@/components/marketing/MarketingNav';
import { MarketingFooter } from '@/components/marketing/MarketingFooter';
import {
    LayoutDashboard,
    ShoppingCart,
    Package,
    CreditCard,
    QrCode,
    BarChart3,
    Users,
    Truck,
    ArrowRight,
    CheckCircle2,
    Sparkles
} from 'lucide-react';

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
        label: 'Dashboard',
        icon: LayoutDashboard,
        description: 'Command center view with real-time metrics and activity',
        features: ['Live metrics', 'Order activity feed', 'Real-time updates', 'Multi-location support'],
        component: DashboardDemo,
    },
    {
        id: 'orders',
        label: 'Orders',
        icon: ShoppingCart,
        description: 'Kanban-style order management with status tracking',
        features: ['Drag-and-drop workflow', 'Status automation', 'Order history', 'Undo support'],
        component: OrderKanbanDemo,
    },
    {
        id: 'inventory',
        label: 'Inventory',
        icon: Package,
        description: 'Real-time stock tracking with low stock alerts',
        features: ['Live stock levels', 'Auto reorder alerts', 'Batch tracking', 'Multi-location'],
        component: InventoryGridDemo,
    },
    {
        id: 'pos',
        label: 'POS',
        icon: CreditCard,
        description: 'Full-featured point of sale with payment processing',
        features: ['Quick checkout', 'Multiple payments', 'Receipt printing', 'Shift management'],
        component: POSDemo,
    },
    {
        id: 'menus',
        label: 'Menus',
        icon: QrCode,
        description: 'Encrypted disposable menus with QR code access',
        features: ['Burn after viewing', 'Custom pricing', 'Access tracking', 'Mobile optimized'],
        component: QRMenuDemo,
    },
    {
        id: 'analytics',
        label: 'Analytics',
        icon: BarChart3,
        description: 'Real-time business intelligence and reporting',
        features: ['Revenue tracking', 'Trend analysis', 'Custom reports', 'Export to Excel'],
        component: AnalyticsDashDemo,
    },
    {
        id: 'delivery',
        label: 'Delivery',
        icon: Truck,
        description: 'Fleet tracking with route optimization',
        features: ['Live GPS tracking', 'Route optimization', 'Driver management', 'ETA updates'],
        component: LiveMapDemo,
    },
    {
        id: 'storefront',
        label: 'Storefront',
        icon: ShoppingCart,
        description: 'Premium e-commerce experience for your customers',
        features: ['Luxury design system', 'Mobile optimized', 'Real-time inventory', 'SEO ready'],
        component: StorefrontDemo,
    },
];

export default function InteractiveDemoPage() {
    const [activeTab, setActiveTab] = useState('dashboard');
    const activeDemo = DEMO_TABS.find(t => t.id === activeTab)!;

    return (
        <div className="min-h-screen bg-[hsl(var(--marketing-bg))] text-[hsl(var(--marketing-text))]">
            <SEOHead
                title="Interactive Demo - FloraIQ | See the Platform in Action"
                description="Explore FloraIQ's features with our interactive demo. See live dashboards, order management, inventory tracking, POS, and more - no signup required."
            />

            <MarketingNav />

            {/* Hero Section */}
            <section className="pt-24 pb-8 px-4">
                <div className="max-w-6xl mx-auto text-center">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm mb-6"
                    >
                        <Sparkles className="w-4 h-4" />
                        Live Interactive Demo
                    </motion.div>
                    <motion.h1
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="text-4xl md:text-5xl font-bold text-[hsl(var(--marketing-text))] mb-4"
                    >
                        Experience FloraIQ in Action
                    </motion.h1>
                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="text-xl text-[hsl(var(--marketing-text-light))] max-w-2xl mx-auto"
                    >
                        Click through our live demos to see how FloraIQ transforms your operations. No signup required.
                    </motion.p>
                </div>
            </section>

            {/* Tab Navigation */}
            <section className="px-4 pb-4">
                <div className="max-w-6xl mx-auto">
                    <div className="flex flex-wrap justify-center gap-2">
                        {DEMO_TABS.map((tab, i) => (
                            <motion.button
                                key={tab.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.1 * i }}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === tab.id
                                    ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25'
                                    : 'bg-[hsl(var(--marketing-bg-subtle))] text-[hsl(var(--marketing-text-light))] hover:bg-white hover:text-[hsl(var(--marketing-text))] border border-[hsl(var(--marketing-border))]'
                                    }`}
                            >
                                <tab.icon className="w-4 h-4" />
                                {tab.label}
                            </motion.button>
                        ))}
                    </div>
                </div>
            </section>

            {/* Demo Preview */}
            <section className="px-4 py-8">
                <div className="max-w-6xl mx-auto">
                    <div className="grid lg:grid-cols-5 gap-6">
                        {/* Demo Component */}
                        <div className="lg:col-span-3">
                            <AnimatePresence mode="wait">
                                <motion.div
                                    key={activeTab}
                                    initial={{ opacity: 0, scale: 0.98 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.98 }}
                                    transition={{ type: 'spring', stiffness: 200, damping: 25 }}
                                    className="h-[400px] md:h-[450px]"
                                >
                                    <activeDemo.component />
                                </motion.div>
                            </AnimatePresence>
                        </div>

                        {/* Feature Description */}
                        <div className="lg:col-span-2">
                            <AnimatePresence mode="wait">
                                <motion.div
                                    key={activeTab}
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 20 }}
                                    className="bg-[hsl(var(--marketing-bg-subtle))] rounded-xl border border-[hsl(var(--marketing-border))] p-6 h-full"
                                >
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                                            <activeDemo.icon className="w-5 h-5 text-primary" />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-bold text-[hsl(var(--marketing-text))]">{activeDemo.label}</h3>
                                            <p className="text-sm text-[hsl(var(--marketing-text-light))]">Feature Demo</p>
                                        </div>
                                    </div>

                                    <p className="text-[hsl(var(--marketing-text-light))] mb-6">
                                        {activeDemo.description}
                                    </p>

                                    <div className="space-y-3 mb-6">
                                        {activeDemo.features.map((feature, i) => (
                                            <motion.div
                                                key={feature}
                                                initial={{ opacity: 0, x: -10 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: 0.1 * i }}
                                                className="flex items-center gap-2"
                                            >
                                                <CheckCircle2 className="w-4 h-4 text-[hsl(var(--marketing-accent))] flex-shrink-0" />
                                                <span className="text-sm text-[hsl(var(--marketing-text-light))]">{feature}</span>
                                            </motion.div>
                                        ))}
                                    </div>

                                    <Link to="/signup">
                                        <Button className="w-full" size="lg">
                                            Start Free Trial
                                            <ArrowRight className="w-4 h-4 ml-2" />
                                        </Button>
                                    </Link>
                                </motion.div>
                            </AnimatePresence>
                        </div>
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="px-4 py-16">
                <div className="max-w-4xl mx-auto text-center">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="bg-gradient-to-br from-primary/20 to-primary/5 rounded-2xl border border-primary/20 p-8 md:p-12"
                    >
                        <h2 className="text-2xl md:text-3xl font-bold text-[hsl(var(--marketing-text))] mb-4">
                            Ready to Transform Your Operations?
                        </h2>
                        <p className="text-[hsl(var(--marketing-text-light))] mb-8 max-w-xl mx-auto">
                            Start your 14-day free trial and experience all these features with your own data.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-4 justify-center">
                            <Link to="/signup">
                                <Button size="lg" className="px-8">
                                    Start Free Trial
                                    <ArrowRight className="w-4 h-4 ml-2" />
                                </Button>
                            </Link>
                            <Link to="/demo/request">
                                <Button size="lg" variant="outline" className="px-8">
                                    Schedule a Demo Call
                                </Button>
                            </Link>
                        </div>
                    </motion.div>
                </div>
            </section>

            <MarketingFooter />
        </div>
    );
}
