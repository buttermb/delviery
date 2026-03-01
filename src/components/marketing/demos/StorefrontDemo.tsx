import { motion } from 'framer-motion';
import { ShoppingBag, Star, Plus, ArrowRight, Search, Menu, Filter, Moon, Smile, Zap, Sun, Target, Lightbulb, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMobileOptimized } from '@/hooks/useMobileOptimized';

export function StorefrontDemo() {
    const { shouldUseStaticFallback } = useMobileOptimized();

    const products = [
        {
            id: 1,
            name: "Blue Dream",
            type: "Sativa Dominant",
            thc: "24%",
            price: 45,
            image: "https://images.unsplash.com/photo-1603909223429-69bb7101f420?auto=format&fit=crop&q=80&w=800",
            tag: "Best Seller",
            effects: ["Happy", "Creative"]
        },
        {
            id: 2,
            name: "Purple Haze",
            type: "Indica",
            thc: "22%",
            price: 50,
            image: "https://images.unsplash.com/photo-1556928045-16f7f50be0f3?auto=format&fit=crop&q=80&w=800",
            tag: "Premium",
            effects: ["Relaxed", "Sleepy"]
        },
        {
            id: 3,
            name: "Sour Diesel",
            type: "Sativa",
            thc: "26%",
            price: 55,
            image: "https://images.unsplash.com/photo-1589578228447-e1a4e481c6c8?auto=format&fit=crop&q=80&w=800",
            tag: "Staff Pick",
            effects: ["Energetic", "Focused"]
        }
    ];

    const getEffectIcon = (effect: string) => {
        const iconName = effect.toLowerCase();
        if (iconName.includes('sleep') || iconName.includes('night')) return Moon;
        if (iconName.includes('happy') || iconName.includes('mood')) return Smile;
        if (iconName.includes('energy') || iconName.includes('uplift')) return Zap;
        if (iconName.includes('relax') || iconName.includes('calm')) return Sun;
        if (iconName.includes('focus')) return Target;
        if (iconName.includes('creat')) return Lightbulb;
        return Activity;
    };

    return (
        <div className="w-full h-full min-h-[600px] bg-white relative overflow-hidden flex flex-col font-sans border border-slate-200 rounded-xl shadow-2xl">
            {/* Background Texture */}
            <div className="absolute inset-0 bg-slate-50/50" />
            <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-indigo-50/50 blur-[100px] rounded-full" />

            {/* Navbar Mockup */}
            <div className="relative z-10 flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white/80 backdrop-blur-md sticky top-0">
                <div className="flex items-center gap-4">
                    <Menu className="w-5 h-5 text-slate-500 md:hidden" />
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-[hsl(var(--marketing-primary))] flex items-center justify-center shadow-sm">
                            <span className="text-white font-bold text-lg">F</span>
                        </div>
                        <span className="text-slate-900 font-bold tracking-tight text-lg hidden md:block">Flora<span className="text-[hsl(var(--marketing-primary))]">IQ</span></span>
                    </div>
                </div>

                <div className="hidden md:flex items-center bg-slate-100/50 rounded-full px-4 py-2 border border-slate-200/50 w-64 gap-2 text-slate-400">
                    <Search className="w-4 h-4" />
                    <span className="text-sm">Search catalog...</span>
                </div>

                <div className="flex items-center gap-4">
                    <div className="hidden md:flex gap-6 text-sm font-medium text-slate-600">
                        <span className="hover:text-[hsl(var(--marketing-primary))] cursor-pointer transition-colors">Shop</span>
                        <span className="hover:text-[hsl(var(--marketing-primary))] cursor-pointer transition-colors">Brands</span>
                        <span className="hover:text-[hsl(var(--marketing-primary))] cursor-pointer transition-colors">Deals</span>
                    </div>
                    <div className="relative">
                        <Button size="icon" variant="ghost" className="text-slate-700 hover:bg-slate-100 rounded-full" aria-label="Shopping cart">
                            <ShoppingBag className="w-5 h-5" aria-hidden="true" />
                        </Button>
                        <span className="absolute top-0 right-0 w-2 h-2 bg-[hsl(var(--marketing-primary))] rounded-full border border-white"></span>
                    </div>
                </div>
            </div>

            {/* Hero / Header */}
            <div className="relative z-10 p-8 md:p-12 pb-6">
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="flex flex-col md:flex-row justify-between items-end gap-6 mb-8"
                >
                    <div className="space-y-2">
                        <h2 className="text-4xl md:text-5xl font-bold text-slate-900 tracking-tight leading-tight">
                            Wholesale <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[hsl(var(--marketing-primary))] to-purple-600">Marketplace</span>
                        </h2>
                        <p className="text-slate-500 max-w-md">Access real-time inventory from top cultivators. Automated compliance and direct ordering.</p>
                    </div>
                    <div className="flex gap-3">
                        <Button variant="outline" className="rounded-full border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-white shadow-sm gap-2">
                            <Filter className="w-4 h-4" /> Filters
                        </Button>
                        <Button className="rounded-full bg-[hsl(var(--marketing-primary))] text-white hover:bg-[hsl(var(--marketing-primary))]/90 shadow-lg shadow-indigo-200 border border-transparent">
                            View All Products
                        </Button>
                    </div>
                </motion.div>
            </div>

            {/* Product Grid Mockup */}
            <div className="relative z-10 flex-1 px-6 md:px-12 overflow-y-auto pb-12 no-scrollbar">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {products.map((product, i) => (
                        <motion.div
                            key={product.id}
                            initial={shouldUseStaticFallback ? false : { opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={shouldUseStaticFallback ? { duration: 0 } : { delay: i * 0.1 + 0.3 }}
                            className="group relative bg-white border border-slate-200 rounded-2xl p-3 shadow-sm hover:shadow-xl hover:border-[hsl(var(--marketing-primary))]/20 hover:-translate-y-1 transition-all duration-300 cursor-pointer"
                        >
                            {/* Image Area */}
                            <div className="aspect-[4/3] rounded-xl bg-slate-100 mb-4 overflow-hidden relative">
                                <img src={product.image} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" loading="lazy" />
                                <div className="absolute top-3 left-3">
                                    <span className="px-2 py-1 bg-white/90 backdrop-blur text-[10px] font-bold uppercase tracking-wider text-slate-800 rounded-md shadow-sm border border-slate-100/50">
                                        {product.tag}
                                    </span>
                                </div>
                                <Button size="icon" className="absolute bottom-3 right-3 w-8 h-8 rounded-full bg-white text-slate-900 shadow-md opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-300 hover:bg-[hsl(var(--marketing-primary))] hover:text-white" aria-label={`Add ${product.name} to cart`}>
                                    <Plus className="w-4 h-4" aria-hidden="true" />
                                </Button>
                            </div>

                            <div className="px-1 pb-2">
                                <div className="flex justify-between items-start mb-1">
                                    <h4 className="text-slate-900 font-bold text-lg tracking-tight group-hover:text-[hsl(var(--marketing-primary))] transition-colors">{product.name}</h4>
                                    <span className="font-mono text-slate-900 font-bold bg-slate-50 px-2 py-1 rounded-md text-sm border border-slate-100">${product.price}</span>
                                </div>

                                <div className="flex justify-between items-center text-sm mb-3">
                                    <span className="text-slate-500 font-medium">{product.type}</span>
                                    <div className="flex items-center gap-1 text-amber-500 bg-amber-50 px-1.5 py-0.5 rounded-md border border-amber-100">
                                        <Star className="w-3 h-3 fill-current" />
                                        <span className="text-xs font-bold text-amber-700">4.{8 + i}</span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-2 text-xs text-slate-500 font-medium border-t border-slate-100 pt-3 mt-2">
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                                        THC: {product.thc}
                                    </div>
                                    <div className="flex items-center gap-1.5 justify-end">
                                        {product.effects?.map((effect: string, idx: number) => {
                                            const Icon = getEffectIcon(effect);
                                            return (
                                                <div key={idx} className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-slate-500" title={effect}>
                                                    <Icon className="w-3 h-3" />
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>

                {/* Visual indicator of more content */}
                <div className="mt-8 text-center">
                    <div className="inline-flex items-center gap-2 text-slate-400 text-sm font-medium animate-bounce">
                        Scroll for more <ArrowRight className="w-4 h-4 rotate-90" />
                    </div>
                </div>
            </div>
        </div>
    );
}
