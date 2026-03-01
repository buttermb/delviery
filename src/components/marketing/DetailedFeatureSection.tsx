import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ArrowRight, CheckCircle2, ShieldCheck, Truck, ShoppingCart } from 'lucide-react';
import { ComplianceDemo } from './demos/ComplianceDemo';
import { LogisticsDemo } from './demos/LogisticsDemo';
import { StorefrontDemo } from './demos/StorefrontDemo';
import { Link } from 'react-router-dom';

export function DetailedFeatureSection() {
    const features = [
        {
            id: 'compliance',
            title: 'Automated Compliance',
            description: 'State reporting happens automatically in the background. We sync with Metrc every 5 minutes so your manifests are always audit-ready.',
            bullets: ['Real-time Metrc sync', 'Automated manifest generation', 'Discrepancy alerts'],
            link: '/features/compliance',
            linkText: 'Learn more about Automated Compliance',
            icon: ShieldCheck,
            demo: <ComplianceDemo />,
            align: 'left' // Text left, Demo right
        },
        {
            id: 'logistics',
            title: 'Smart Logistics',
            description: 'Maximize driver efficiency with algorithmic route planning. Reduce fuel costs and increase stops per hour with our intelligent dispatch engine.',
            bullets: ['Multi-stop optimization', 'Driver mobile app', 'Proof of delivery (e-signature)'],
            link: '/features/logistics',
            linkText: 'Learn more about Smart Logistics',
            icon: Truck,
            demo: (
                <div className="w-full h-[500px] overflow-hidden rounded-xl border border-[hsl(var(--marketing-border))] shadow-2xl relative">
                    <LogisticsDemo />
                </div>
            ),
            align: 'right' // Text right, Demo left
        },
        {
            id: 'ecommerce',
            title: 'B2B E-Commerce',
            description: 'Give your retailers a modern ordering experience. Your live menu is always up to date with warehouse inventory, preventing overselling.',
            bullets: ['Live inventory feed', 'Custom price tiers', 'One-click reordering'],
            link: '/features/ecommerce',
            linkText: 'Learn more about B2B E-Commerce',
            icon: ShoppingCart,
            demo: (
                <div className="w-full h-[600px] overflow-hidden rounded-xl border border-[hsl(var(--marketing-border))] shadow-2xl">
                    <StorefrontDemo />
                </div>
            ),
            align: 'left'
        }
    ];

    return (
        <div className="container mx-auto px-4">

            <div className="text-center max-w-3xl mx-auto mb-20">
                <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-6 leading-tight">
                    Built for scale, <br /> designed for compliance
                </h2>
                <p className="text-lg text-slate-600">
                    Everything you need to run a modern cannabis distribution business.
                </p>
            </div>

            <div className="space-y-32">
                {features.map((feature, _index) => (
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
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[hsl(var(--marketing-primary)/0.1)] text-[hsl(var(--marketing-primary))] text-sm font-medium border border-[hsl(var(--marketing-primary)/0.2)]">
                                <feature.icon className="w-4 h-4" />
                                {feature.title}
                            </div>

                            <h3 className="text-3xl md:text-4xl font-bold text-slate-900 leading-tight">
                                {feature.title}
                            </h3>

                            <p className="text-xl text-slate-600 leading-relaxed">
                                {feature.description}
                            </p>

                            <ul className="space-y-4">
                                {feature.bullets.map((bullet, i) => (
                                    <li key={i} className="flex items-center gap-3">
                                        <div className="w-6 h-6 rounded-full bg-[hsl(var(--marketing-primary)/0.1)] flex items-center justify-center flex-shrink-0">
                                            <CheckCircle2 className="w-4 h-4 text-[hsl(var(--marketing-primary))]" />
                                        </div>
                                        <span className="text-lg text-slate-800 font-medium">{bullet}</span>
                                    </li>
                                ))}
                            </ul>

                            <div className="pt-4">
                                <Link to={feature.link}>
                                    <Button variant="link" className="p-0 h-auto text-[hsl(var(--marketing-primary))] hover:opacity-80 font-semibold text-lg group uppercase tracking-wide">
                                        {feature.linkText}
                                        <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                                    </Button>
                                </Link>
                            </div>
                        </div>

                        {/* Demo Visual */}
                        <div className="flex-1 w-full relative perspective-[1000px] group">
                            <div className="relative transform transition-transform duration-700 hover:rotate-y-2 hover:rotate-x-2">
                                {feature.demo}
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>
        </div>
    );
}
