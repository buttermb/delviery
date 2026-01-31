import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { ShoppingBag, Star, Plus, ArrowRight, Sparkles, Search, Menu, Filter, Moon, Smile, Zap, Sun, Target, Lightbulb, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMobileOptimized } from '@/hooks/useMobileOptimized';
import { useState, useRef } from 'react';

function MagneticButton({ children, className, onClick, ...props }: any) {
    const ref = useRef<HTMLButtonElement>(null);
    const x = useMotionValue(0);
    const y = useMotionValue(0);

    const springConfig = { damping: 15, stiffness: 150, mass: 0.1 };
    const springX = useSpring(x, springConfig);
    const springY = useSpring(y, springConfig);

    const handleMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
        if (!ref.current) return;
        const { left, KA top, width, height } = ref.current.getBoundingClientRect();
        const centerX = left + width / 2;
        const centerY = top + height / 2;
        x.set((e.clientX - centerX) * 0.3); // Magnetic pull strength
        y.set((e.clientY - centerY) * 0.3);
    };

    const handleMouseLeave = () => {
        x.set(0);
        y.set(0);
    };

    return (
        <motion.button
            ref={ref}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            style={{ x: springX, y: springY }}
            onClick={onClick}
            className={className}
            {...props}
        >
            {children}
        </motion.button>
    );
}

export function StorefrontDemo() {
    const { shouldUseStaticFallback } = useMobileOptimized();
    const [cartCount, setCartCount] = useState(0);
    const [flyingItems, setFlyingItems] = useState<{ id: number, x: number, y: number }[]>([]);

    const addToCart = (e: React.MouseEvent, productId: number) => {
        // Fly to cart effect
        const rect = (e.target as HTMLElement).getBoundingClientRect();
        const newItem = { id: Date.now(), x: e.clientX, y: e.clientY };
        setFlyingItems(prev => [...prev, newItem]);

        setTimeout(() => {
            setCartCount(prev => prev + 1);
            setFlyingItems(prev => prev.filter(item => item.id !== newItem.id));
        }, 800);
    };

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
            {/* Background Texture & Breathing Blobs */}
            <div className="absolute inset-0 bg-slate-50/50" />
            <motion.div
                className="absolute top-[-20%] right-[-20%] w-[800px] h-[800px] bg-indigo-50/50 blur-[120px] rounded-full pointer-events-none"
                animate={{ scale: [1, 1.1, 1], rotate: [0, 10, 0] }}
                transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.div
                className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] bg-[hsl(var(--marketing-primary))]/5 blur-[100px] rounded-full pointer-events-none"
                animate={{ scale: [1, 1.2, 1], x: [0, 50, 0] }}
                transition={{ duration: 20, repeat: Infinity, ease: "easeInOut", delay: 2 }}
            />

            {/* Flying Items Layer */}
            <AnimatePresence>
                {flyingItems.map(item => (
                    <motion.div
                        key={item.id}
                        initial={{ x: item.x - 300, y: item.y - 100, scale: 1, opacity: 1 }} // Offset relative to demo container
                        animate={{ x: '90%', y: '5%', scale: 0.2, opacity: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.8, ease: "easeInOut" }}
                        className="fixed w-8 h-8 rounded-full bg-[hsl(var(--marketing-primary))] z-[100] pointer-events-none shadow-xl"
                    />
                ))}
            </AnimatePresence>

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

                <div className="hidden md:flex items-center bg-slate-100/50 rounded-full px-4 py-2 border border-slate-200/50 w-64 gap-2 text-slate-400 focus-within:ring-2 ring-[hsl(var(--marketing-primary))]/20 transition-all">
                    <Search className="w-4 h-4" />
                    <span className="text-sm">Search catalog...</span>
                </div>

                <div className="flex items-center gap-4">
                    <div className="hidden md:flex gap-6 text-sm font-medium text-slate-600">
                        <span className="hover:text-[hsl(var(--marketing-primary))] cursor-pointer transition-colors relative group">
                            Shop
                            <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-[hsl(var(--marketing-primary))] group-hover:w-full transition-all duration-300" />
                        </span>
                        <span className="hover:text-[hsl(var(--marketing-primary))] cursor-pointer transition-colors">Brands</span>
                        <span className="hover:text-[hsl(var(--marketing-primary))] cursor-pointer transition-colors">Deals</span>
                    </div>
                    <div className="relative group">
                        <Button size="icon" variant="ghost" className="text-slate-700 hover:bg-slate-100 rounded-full relative" aria-label="Shopping cart">
                            <ShoppingBag className="w-5 h-5 group-hover:scale-110 transition-transform" aria-hidden="true" />
                        </Button>
                        <AnimatePresence>
                            {cartCount > 0 && (
                                <motion.span
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    key={cartCount}
                                    className="absolute -top-1 -right-1 w-4 h-4 bg-[hsl(var(--marketing-primary))] rounded-full border border-white text-[10px] text-white flex items-center justify-center font-bold shadow-sm"
                                >
                                    {cartCount}
                                </motion.span>
                            )}
                        </AnimatePresence>
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
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[hsl(var(--marketing-primary))] to-purple-600 relative">
                                Marketplace
                                <svg className="absolute w-full h-3 -bottom-1 left-0 text-[hsl(var(--marketing-primary))]/20" viewBox="0 0 100 10" preserveAspectRatio="none">
                                    <path d="M0 5 Q 50 10 100 5" stroke="currentColor" strokeWidth="8" fill="none" />
                                </svg>
                            </span>
                        </h2>
                        <p className="text-slate-500 max-w-md">Access real-time inventory from top cultivators. Automated compliance and streamlined ordering.</p>
                    </div>
                    <div className="flex gap-3">
                        <Button variant="outline" className="rounded-full border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-white shadow-sm gap-2 transition-all hover:shadow-md">
                            <Filter className="w-4 h-4" /> Filters
                        </Button>
                        <MagneticButton className="rounded-full bg-[hsl(var(--marketing-primary))] text-white hover:bg-[hsl(var(--marketing-primary))]/90 shadow-lg shadow-indigo-200 border border-transparent px-6 py-2 text-sm font-medium transition-colors">
                            View All Products
                        </MagneticButton>
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
                                <MagneticButton
                                    className="absolute bottom-3 right-3 w-8 h-8 rounded-full bg-white text-slate-900 shadow-md flex items-center justify-center opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-300 hover:bg-[hsl(var(--marketing-primary))] hover:text-white z-20"
                                    onClick={(e: React.MouseEvent) => {
                                        e.stopPropagation();
                                        addToCart(e, product.id);
                                    }}
                                    aria-label={`Add ${product.name} to cart`}
                                >
                                    <Plus className="w-4 h-4" aria-hidden="true" />
                                </MagneticButton>
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
                                                <div key={idx} className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:scale-110 transition-transform" title={effect}>
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
                    <div className="inline-flex items-center gap-2 text-slate-400 text-sm font-medium animate-bounce opacity-50">
                        Scroll for more <ArrowRight className="w-4 h-4 rotate-90" />
                    </div>
                </div>
            </div>
        </div>
    );
}
