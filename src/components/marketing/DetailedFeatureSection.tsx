import { motion } from 'framer-motion';
import CheckCircle2 from "lucide-react/dist/esm/icons/check-circle-2";
import Lock from "lucide-react/dist/esm/icons/lock";
import ShoppingCart from "lucide-react/dist/esm/icons/shopping-cart";
import RefreshCw from "lucide-react/dist/esm/icons/refresh-cw";

export function DetailedFeatureSection() {
    const features = [
        {
            id: 'menus',
            title: 'Share menus that disappear',
            description: 'Create a product catalog, share a one-time link, and it auto-burns after viewing. No screenshots. No forwarding. Your pricing stays private.',
            bullets: ['One-time encrypted URLs', 'Auto-burn on screenshot', 'Device fingerprinting'],
            icon: Lock,
            visual: (
                <div className="w-full h-[400px] rounded-xl border border-[hsl(var(--marketing-border))] bg-[hsl(var(--marketing-bg-subtle))] flex items-center justify-center p-8">
                    <div className="w-full max-w-sm space-y-4">
                        <div className="h-8 w-3/4 bg-emerald-100 rounded-lg" />
                        <div className="space-y-2">
                            <div className="h-12 w-full bg-white border border-slate-200 rounded-lg" />
                            <div className="h-12 w-full bg-white border border-slate-200 rounded-lg" />
                            <div className="h-12 w-full bg-white border border-slate-200 rounded-lg" />
                        </div>
                        <div className="flex items-center gap-2 pt-2">
                            <Lock className="w-4 h-4 text-emerald-500" />
                            <span className="text-xs text-slate-400">Encrypted • Expires after viewing</span>
                        </div>
                    </div>
                </div>
            ),
            align: 'left' as const,
        },
        {
            id: 'orders',
            title: 'Accept orders without the phone tag',
            description: 'Your buyers browse your live menu, place orders, and pay — all without a single phone call or text. You approve, fulfill, done.',
            bullets: ['Live menu ordering', 'Built-in payment processing', 'Order status tracking'],
            icon: ShoppingCart,
            visual: (
                <div className="w-full h-[400px] rounded-xl border border-[hsl(var(--marketing-border))] bg-[hsl(var(--marketing-bg-subtle))] flex items-center justify-center p-8">
                    <div className="w-full max-w-sm space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="h-6 w-24 bg-slate-200 rounded" />
                            <span className="text-xs px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full font-medium">3 new orders</span>
                        </div>
                        <div className="space-y-2">
                            <div className="h-16 w-full bg-white border border-slate-200 rounded-lg flex items-center px-4 gap-3">
                                <div className="w-8 h-8 rounded-full bg-emerald-100" />
                                <div className="flex-1">
                                    <div className="h-3 w-24 bg-slate-200 rounded" />
                                    <div className="h-2 w-16 bg-slate-100 rounded mt-1" />
                                </div>
                                <span className="text-xs text-emerald-600 font-medium">$2,400</span>
                            </div>
                            <div className="h-16 w-full bg-white border border-slate-200 rounded-lg flex items-center px-4 gap-3">
                                <div className="w-8 h-8 rounded-full bg-blue-100" />
                                <div className="flex-1">
                                    <div className="h-3 w-20 bg-slate-200 rounded" />
                                    <div className="h-2 w-12 bg-slate-100 rounded mt-1" />
                                </div>
                                <span className="text-xs text-emerald-600 font-medium">$1,850</span>
                            </div>
                        </div>
                    </div>
                </div>
            ),
            align: 'right' as const,
        },
        {
            id: 'inventory',
            title: 'Your menu always matches your warehouse',
            description: 'Real-time sync between your inventory and published menus. Sell out? The menu updates instantly. No overselling.',
            bullets: ['Real-time stock levels', 'Multi-location support', 'Automated low-stock alerts'],
            icon: RefreshCw,
            visual: (
                <div className="w-full h-[400px] rounded-xl border border-[hsl(var(--marketing-border))] bg-[hsl(var(--marketing-bg-subtle))] flex items-center justify-center p-8">
                    <div className="w-full max-w-sm space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="h-6 w-28 bg-slate-200 rounded" />
                            <div className="flex items-center gap-1">
                                <RefreshCw className="w-3 h-3 text-emerald-500" />
                                <span className="text-xs text-emerald-600">Live</span>
                            </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                            {[85, 12, 0, 43, 67, 28].map((stock, i) => (
                                <div key={i} className="bg-white border border-slate-200 rounded-lg p-3 text-center">
                                    <div className="h-8 w-8 mx-auto bg-slate-100 rounded mb-2" />
                                    <div className={`text-xs font-bold ${stock === 0 ? 'text-red-500' : stock < 20 ? 'text-amber-500' : 'text-emerald-600'}`}>
                                        {stock === 0 ? 'Sold out' : `${stock} units`}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            ),
            align: 'left' as const,
        }
    ];

    return (
        <section className="py-24 bg-[hsl(var(--marketing-bg))] overflow-x-hidden">
            <div className="container mx-auto px-4">

                <div className="text-center max-w-3xl mx-auto mb-20">
                    <h2 className="text-4xl md:text-5xl font-bold text-[hsl(var(--marketing-text))] mb-6 leading-tight">
                        How FloraIQ works
                    </h2>
                    <p className="text-xl text-[hsl(var(--marketing-text-light))]">
                        Three workflows. One dashboard. Zero phone tag.
                    </p>
                </div>

                <div className="space-y-32">
                    {features.map((feature) => (
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
                                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[hsl(var(--marketing-primary))]/10 text-[hsl(var(--marketing-primary))] text-sm font-medium">
                                    <feature.icon className="w-4 h-4" />
                                    {feature.title}
                                </div>

                                <h3 className="text-3xl md:text-4xl lg:text-5xl font-bold text-[hsl(var(--marketing-text))] leading-tight">
                                    {feature.title}
                                </h3>

                                <p className="text-xl text-[hsl(var(--marketing-text-light))] leading-relaxed">
                                    {feature.description}
                                </p>

                                <ul className="space-y-4">
                                    {feature.bullets.map((bullet, i) => (
                                        <li key={i} className="flex items-center gap-3">
                                            <div className="w-6 h-6 rounded-full bg-[hsl(var(--marketing-primary))]/20 flex items-center justify-center flex-shrink-0">
                                                <CheckCircle2 className="w-4 h-4 text-[hsl(var(--marketing-primary))]" />
                                            </div>
                                            <span className="text-lg text-[hsl(var(--marketing-text))] font-medium">{bullet}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            {/* Visual */}
                            <div className="flex-1 w-full">
                                {feature.visual}
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
}
