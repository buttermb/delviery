import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ArrowRight, CheckCircle2, ShieldCheck, Truck, ShoppingCart } from 'lucide-react';
import { ComplianceDemo } from './demos/ComplianceDemo';
import { LiveMapDemo } from './demos/LiveMapDemo';
import { LogisticsDemo } from './demos/LogisticsDemo';
import { StorefrontDemo } from './demos/StorefrontDemo';
import { Link } from 'react-router-dom';

export function DetailedFeatureSection() {
    const features = [
        {
            id: 'compliance',
            title: 'Metrc Webhooks & Sync',
            description: 'We poll Metrc every 300ms. If a manifest fails, you get a PagerDuty alert instantly. No manual CSV uploads required.',
            bullets: ['Websocket_RT_Updates', 'Auto_Manifest_Gen', 'Drift_Detection_Algo'],
            link: '/features/compliance',
            linkText: 'View Integration Docs',
            icon: ShieldCheck,
            demo: <ComplianceDemo />,
            align: 'left'
        },
        {
            id: 'logistics',
            title: 'Route Optimization Engine',
            description: 'Our O(n) routing algorithm handles complex time windows and vehicle capacity constraints to maximize stops per hour.',
            bullets: ['Multi_Stop_Heuristics', 'Driver_App_v2.1', 'Proof_Of_Dlvry_Sig'],
            link: '/features/logistics',
            linkText: 'Explore Routing API',
            icon: Truck,
            demo: (
                <div className="w-full h-[500px] overflow-hidden rounded border border-[hsl(var(--marketing-border))] shadow-2xl relative bg-[#0f172a]">
                    <div className="absolute top-0 inset-x-0 h-6 bg-slate-800 border-b border-slate-700 flex items-center px-2 z-20">
                        <div className="text-[10px] text-slate-400 font-mono">dispatcher_view.exe</div>
                    </div>
                    <LogisticsDemo />
                </div>
            ),
            align: 'right'
        },
        {
            id: 'ecommerce',
            title: 'Headless Inventory',
            description: 'Your physical inventory is the single source of truth. Connect via GraphQL or use our pre-built B2B storefront components.',
            bullets: ['Realtime_Inv_Feed', 'Price_Tier_Logic', '1_Click_Reorder_Hook'],
            link: '/features/ecommerce',
            linkText: 'Read GraphQL Schema',
            icon: ShoppingCart,
            demo: (
                <div className="w-full h-[600px] overflow-hidden rounded border border-[hsl(var(--marketing-border))] shadow-2xl">
                    <StorefrontDemo />
                </div>
            ),
            align: 'left'
        }
    ];

    return (
        <section className="py-24 bg-[hsl(var(--marketing-bg))] overflow-x-hidden">
            <div className="container mx-auto px-4">

                <div className="text-center max-w-3xl mx-auto mb-20">
                    <h2 className="text-3xl md:text-5xl font-mono font-bold text-[hsl(var(--marketing-text))] mb-6 leading-tight tracking-tight">
                        Built for <span className="text-[hsl(var(--marketing-primary))]">Scale</span>. <br />
                        Designed for <span className="text-[hsl(var(--marketing-primary))]">Compliance</span>.
                    </h2>
                    <p className="text-xl text-[hsl(var(--marketing-text-light))] font-mono">
                         // Full-stack distribution infrastructure
                    </p>
                </div>

                <div className="space-y-32">
                    {features.map((feature, index) => (
                        <motion.div
                            key={feature.id}
                            initial={{ opacity: 0, y: 40 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true, margin: "-100px" }}
                            transition={{ duration: 0.7 }}
                            className={`flex flex-col lg:flex-row gap-12 lg:gap-24 items-center ${feature.align === 'right' ? 'lg:flex-row-reverse' : ''}`}
                        >
                            {/* Text Content */}
                            <div className="flex-1 space-y-8">
                                <div className="inline-flex items-center gap-2 px-3 py-1 rounded bg-[hsl(var(--marketing-primary))]/10 text-[hsl(var(--marketing-primary))] text-xs font-mono font-bold uppercase tracking-widest border border-[hsl(var(--marketing-primary))]/20">
                                    <feature.icon className="w-3.5 h-3.5" />
                                    {feature.title}
                                </div>

                                <h3 className="text-3xl md:text-4xl font-bold font-mono text-[hsl(var(--marketing-text))] leading-tight tracking-tighter">
                                    {feature.title}
                                </h3>

                                <p className="text-lg text-[hsl(var(--marketing-text-light))] leading-relaxed font-sans">
                                    {feature.description}
                                </p>

                                <ul className="space-y-4">
                                    {feature.bullets.map((bullet, i) => (
                                        <li key={i} className="flex items-center gap-3">
                                            <div className="w-5 h-5 rounded bg-[hsl(var(--marketing-primary))]/10 flex items-center justify-center flex-shrink-0">
                                                <CheckCircle2 className="w-3 h-3 text-[hsl(var(--marketing-primary))]" />
                                            </div>
                                            <span className="text-sm font-mono text-[hsl(var(--marketing-text))] opacity-80">{bullet}</span>
                                        </li>
                                    ))}
                                </ul>

                                <div className="pt-4">
                                    <Link to={feature.link}>
                                        <Button variant="link" className="p-0 h-auto text-[hsl(var(--marketing-primary))] hover:text-[hsl(var(--marketing-secondary))] font-mono text-sm uppercase tracking-widest group">
                                            {feature.linkText}
                                            <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                                        </Button>
                                    </Link>
                                </div>
                            </div>

                            {/* Demo Visual */}
                            <div className="flex-1 w-full relative perspective-[1000px] group">
                                <div className="relative transform transition-transform duration-700 hover:rotate-y-1 hover:rotate-x-1">
                                    {feature.demo}
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
}
