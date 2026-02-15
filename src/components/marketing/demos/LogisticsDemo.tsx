/**
 * LogisticsDemo Component
 * 
 * Demonstrates the delivery logistics and route optimization features.
 * Desktop: Full animated 3D map with iPhone mockup
 * Mobile: Simplified static preview with key stats
 */

import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Phone, ChevronRight, Package, CheckCircle2, Truck, Route, Clock, Zap } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useMobileOptimized } from '@/hooks/useMobileOptimized';

// Mobile-optimized static fallback
function LogisticsDemoMobile() {
    return (
        <div className="w-full min-h-[320px] bg-slate-50 dark:bg-zinc-900 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm relative p-5">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center">
                        <Truck className="w-4 h-4 text-white" />
                    </div>
                    <div>
                        <div className="font-bold text-slate-900 text-sm">Fleet Command</div>
                        <div className="text-xs text-slate-500">Live Dispatch</div>
                    </div>
                </div>
                <div className="flex items-center gap-1.5 text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-xs font-medium">Live</span>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-white rounded-xl p-3 border border-slate-100 shadow-sm">
                    <div className="text-xs text-slate-500 mb-1">Active Drivers</div>
                    <div className="text-2xl font-bold text-slate-900">24</div>
                    <div className="text-xs text-emerald-600">All on route</div>
                </div>
                <div className="bg-white rounded-xl p-3 border border-slate-100 shadow-sm">
                    <div className="text-xs text-slate-500 mb-1">On-Time Rate</div>
                    <div className="text-2xl font-bold text-emerald-600">99.4%</div>
                    <div className="text-xs text-slate-500">Today</div>
                </div>
            </div>

            {/* Route Preview Card */}
            <div className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm">
                <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
                        <MapPin className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div className="flex-1">
                        <div className="font-semibold text-slate-900">Green Relief Co.</div>
                        <div className="text-xs text-slate-500">124 Main St, Denver</div>
                    </div>
                    <div className="text-right">
                        <div className="text-sm font-bold text-slate-900">Stop 4/8</div>
                        <div className="text-xs text-emerald-600">ETA: 12 min</div>
                    </div>
                </div>

                {/* Progress Bar */}
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden mb-2">
                    <motion.div
                        className="h-full bg-gradient-to-r from-indigo-600 to-purple-600 rounded-full"
                        initial={{ width: '0%' }}
                        animate={{ width: '50%' }}
                        transition={{ duration: 2, repeat: Infinity, repeatType: 'reverse' }}
                    />
                </div>
                <div className="flex justify-between text-xs text-slate-500">
                    <span>Warehouse</span>
                    <span>4 stops completed</span>
                </div>
            </div>

            {/* Features Row */}
            <div className="flex gap-2 mt-4 justify-center flex-wrap">
                {[
                    { icon: Route, label: 'Route Optimization' },
                    { icon: Clock, label: 'Real-time ETA' },
                    { icon: CheckCircle2, label: 'Proof of Delivery' },
                ].map((feature, i) => (
                    <div key={i} className="flex items-center gap-1.5 bg-white/80 px-2 py-1 rounded-full text-xs text-slate-600 border border-slate-100">
                        <feature.icon className="w-3 h-3" />
                        {feature.label}
                    </div>
                ))}
            </div>

            {/* Interactive Hint */}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-full shadow-lg">
                    <Zap className="w-3 h-3" />
                    Smart Logistics Demo
                </div>
            </div>
        </div>
    );
}

export function LogisticsDemo() {
    const { shouldUseStaticFallback } = useMobileOptimized();
    const [step, setStep] = useState<'approaching' | 'arrived' | 'signing' | 'complete'>('approaching');

    useEffect(() => {
        // Skip animations on mobile
        if (shouldUseStaticFallback) return;

        let cancelled = false;
        const cycle = async () => {
            if (cancelled) return;
            setStep('approaching');
            await new Promise(r => setTimeout(r, 4000));
            if (cancelled) return;
            setStep('arrived');
            await new Promise(r => setTimeout(r, 2000));
            if (cancelled) return;
            setStep('signing');
            await new Promise(r => setTimeout(r, 2000));
            if (cancelled) return;
            setStep('complete');
            await new Promise(r => setTimeout(r, 4000));
            if (!cancelled) cycle();
        };
        cycle();
        return () => { cancelled = true; };
    }, [shouldUseStaticFallback]);

    // Mobile fallback
    if (shouldUseStaticFallback) {
        return <LogisticsDemoMobile />;
    }

    return (
        <div className="w-full h-[500px] relative bg-slate-50 rounded-xl overflow-hidden border border-[hsl(var(--marketing-border))] shadow-2xl group font-sans flex items-center justify-center">

            {/* 1. LIGHT MODE 3D MAP BACKGROUND */}
            <div className="absolute inset-0 perspective-[1000px] overflow-hidden bg-slate-50">
                {/* Tilted Map Plane */}
                <div className="w-[140%] h-[140%] absolute top-[-20%] left-[-20%] bg-slate-100 transform rotate-x-60 scale-100"
                    style={{ transform: 'rotateX(35deg) rotateZ(-10deg) translateY(-50px)' }}>

                    {/* Environment: Parks & Zones */}
                    <div className="absolute top-[10%] left-[20%] w-[20%] h-[15%] bg-emerald-100/60 rounded-3xl border border-emerald-200/50" />
                    <div className="absolute top-[60%] left-[60%] w-[15%] h-[20%] bg-blue-100/60 rounded-3xl border border-blue-200/50" />

                    {/* City Blocks */}
                    {Array.from({ length: 12 }).map((_, i) => (
                        <div key={i} className="absolute bg-white shadow-xl rounded-lg border border-slate-200"
                            style={{
                                width: 80 + (i * 10),
                                height: 60 + (i * 5),
                                left: `${(i * 30) % 80 + 10}%`,
                                top: `${(i * 20) % 80 + 10}%`,
                                transform: 'translateZ(10px)',
                                boxShadow: '10px 10px 30px rgba(0,0,0,0.05)'
                            }}
                        />
                    ))}

                    {/* ROUTE SYSTEM */}
                    <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ transform: 'translateZ(2px)' }}>
                        <defs>
                            <filter id="routeShadow" x="-20%" y="-20%" width="140%" height="140%">
                                <feDropShadow dx="2" dy="4" stdDeviation="3" floodColor="#000000" floodOpacity="0.1" />
                            </filter>
                        </defs>

                        {/* Path Line (Shadow) */}
                        <path
                            d="M200,600 C400,600 500,400 650,350"
                            fill="none"
                            stroke="rgba(0,0,0,0.05)"
                            strokeWidth="12"
                            strokeLinecap="round"
                        />

                        {/* Path Line (Active) */}
                        <path
                            d="M200,600 C400,600 500,400 650,350"
                            fill="none"
                            stroke="hsl(var(--marketing-primary))"
                            strokeWidth="8"
                            strokeLinecap="round"
                            className="opacity-90"
                        />

                        {/* Moving Vehicle */}
                        <motion.g
                            animate={{
                                offsetDistance: step === 'approaching' ? "100%" : "100%"
                            }}
                            transition={{ duration: 4, ease: "easeInOut" }}
                            style={{ offsetPath: 'path("M200,600 C400,600 500,400 650,350")' }}
                        >
                            <circle r="12" fill="white" stroke="hsl(var(--marketing-primary))" strokeWidth="4" />
                            <Truck size={12} className="text-[hsl(var(--marketing-primary))]" x="-6" y="-6" transform="rotate(-15)" />
                        </motion.g>

                        {/* Destination Marker */}
                        <g transform="translate(650, 350)">
                            <circle r="4" fill="hsl(var(--marketing-primary))" />
                            <circle r="30" stroke="hsl(var(--marketing-primary))" strokeWidth="1" fill="none" className="animate-ping opacity-30" />
                        </g>
                    </svg>
                </div>

                {/* Foreground HUD Elements */}
                <div className="absolute top-6 left-6 flex flex-col gap-2 z-10">
                    <div className="flex items-center gap-2 text-[hsl(var(--marketing-primary))] font-mono text-xs font-bold tracking-widest uppercase bg-white/50 backdrop-blur px-2 py-1 rounded-md border border-[hsl(var(--marketing-primary))]/20">
                        <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                        Live Dispatch
                    </div>
                    <h3 className="text-slate-900 text-3xl font-bold tracking-tight">Fleet Command</h3>
                    <div className="flex gap-4 mt-2">
                        <div className="bg-white/80 backdrop-blur border border-slate-200 p-3 rounded-lg min-w-[120px] shadow-sm">
                            <div className="text-slate-500 text-[10px] uppercase font-bold">Active Drivers</div>
                            <div className="text-slate-900 text-xl font-mono">24</div>
                        </div>
                        <div className="bg-white/80 backdrop-blur border border-slate-200 p-3 rounded-lg min-w-[120px] shadow-sm">
                            <div className="text-slate-500 text-[10px] uppercase font-bold">On-Time Rate</div>
                            <div className="text-emerald-600 text-xl font-mono">99.4%</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 2. PREMIUM IPHONE INTERFACE */}
            <div className="absolute bottom-8 right-8 z-30 perspective-[1000px] w-[280px]">
                <motion.div
                    className="w-full min-h-[440px] bg-white rounded-[3rem] p-3 shadow-[0_20px_60px_-10px_rgba(0,0,0,0.15)] relative border-4 border-slate-200 ring-1 ring-slate-100"
                    initial={{ y: 20, rotateY: -12, rotateX: 5 }}
                    animate={{ y: 0, rotateY: -8, rotateX: 3 }}
                    transition={{ repeat: Infinity, repeatType: "mirror", duration: 5 }}
                >
                    {/* Screen */}
                    <div className="w-full h-full bg-slate-50 rounded-[3rem] overflow-hidden relative flex flex-col border border-slate-100">

                        {/* Dynamic Island Area */}
                        <div className="h-10 bg-white flex justify-center pt-2 relative z-10">
                            <motion.div
                                animate={{
                                    width: step === 'complete' ? 170 : 90,
                                    height: step === 'complete' ? 30 : 25
                                }}
                                className="bg-black rounded-full flex items-center justify-center overflow-hidden transition-all duration-500 shadow-sm"
                            >
                                {step === 'complete' ? (
                                    <div className="flex items-center gap-2 text-emerald-500 text-[9px] font-bold">
                                        <CheckCircle2 size={10} /> Metrc Synced
                                    </div>
                                ) : (
                                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                                )}
                            </motion.div>
                        </div>

                        {/* App Content */}
                        <div className="flex-1 relative pt-4 px-5">

                            {/* Top Nav */}
                            <div className="flex justify-between items-center mb-6">
                                <div className="w-8 h-8 rounded-full bg-white border border-slate-100 flex items-center justify-center shadow-sm">
                                    <ChevronRight className="w-4 h-4 text-slate-400 rotate-180" />
                                </div>
                                <div className="text-slate-400 font-bold text-xs uppercase tracking-wider">Stop 4 / 8</div>
                                <div className="w-8 h-8 rounded-full bg-[hsl(var(--marketing-primary))] flex items-center justify-center shadow-lg shadow-indigo-200">
                                    <Phone className="w-3 h-3 text-white" />
                                </div>
                            </div>

                            {/* Stop Header */}
                            <div className="text-center mb-6 relative">
                                <div className="w-16 h-16 bg-white rounded-full mx-auto mb-3 flex items-center justify-center relative shadow-sm border border-slate-100">
                                    <MapPin className="w-7 h-7 text-[hsl(var(--marketing-primary))]" />
                                    <div className="absolute inset-0 border-2 border-[hsl(var(--marketing-primary))]/20 rounded-full animate-ping" />
                                </div>
                                <h2 className="text-xl font-bold text-slate-900 mb-0.5">Green Relief Co.</h2>
                                <p className="text-slate-500 text-xs font-medium">124 Main St, Denver</p>
                            </div>

                            {/* Order Info */}
                            <div className="bg-white rounded-xl p-3 border border-slate-100 shadow-sm mb-4">
                                <div className="flex justify-between mb-2 pb-2 border-b border-slate-50">
                                    <span className="text-slate-400 text-[10px] font-bold uppercase">Order #1234</span>
                                    <span className="text-emerald-600 text-[10px] font-bold bg-emerald-50 px-1.5 py-0.5 rounded">COD: $1,250</span>
                                </div>
                                <div className="space-y-1.5">
                                    {[1, 2, 3].map(i => (
                                        <div key={i} className="flex gap-2 items-center">
                                            <div className="w-6 h-6 bg-slate-50 rounded flex items-center justify-center text-slate-300">
                                                <Package size={12} />
                                            </div>
                                            <div className="flex-1">
                                                <div className="h-1.5 bg-slate-200 rounded w-16 mb-1" />
                                                <div className="h-1 bg-slate-100 rounded w-10" />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* SIGNATURE AREA */}
                            <AnimatePresence>
                                {step === 'signing' && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0 }}
                                        className="absolute inset-x-5 bottom-24 bg-white/95 backdrop-blur shadow-xl rounded-xl border border-slate-100 p-4 z-10"
                                    >
                                        <div className="text-[10px] text-slate-400 font-bold uppercase mb-2 text-center">Customer Signature</div>
                                        <div className="h-20 bg-slate-50 rounded-lg border border-dashed border-slate-300 relative overflow-hidden">
                                            <svg className="absolute inset-0 w-full h-full">
                                                <motion.path
                                                    d="M20,50 C40,40 60,70 100,40"
                                                    stroke="hsl(var(--marketing-primary))"
                                                    strokeWidth="2"
                                                    fill="none"
                                                    initial={{ pathLength: 0 }}
                                                    animate={{ pathLength: 1 }}
                                                    transition={{ duration: 1.2, ease: "easeInOut" }}
                                                />
                                            </svg>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                        </div>

                        {/* SLIDER ACTION */}
                        <div className="p-4 pt-0 z-20 mt-auto mb-8">
                            <div className={`h-12 rounded-full relative flex items-center px-1 overflow-hidden transition-colors duration-300 ${step === 'complete' ? 'bg-emerald-50' : 'bg-slate-100'}`}>

                                {step === 'complete' ? (
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        className="absolute inset-0 flex items-center justify-center text-emerald-600 font-bold tracking-wide uppercase text-[10px] gap-1"
                                    >
                                        <CheckCircle2 size={14} /> Completed
                                    </motion.div>
                                ) : (
                                    <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-[10px] font-bold tracking-widest uppercase">
                                        Slide to Confirm
                                    </div>
                                )}

                                <motion.div
                                    className={`w-10 h-10 rounded-full flex items-center justify-center shadow-md relative z-10 ${step === 'complete' ? 'bg-emerald-500' : 'bg-white'}`}
                                    animate={{ x: step === 'complete' || step === 'signing' ? 200 : 0 }}
                                    transition={{ type: "spring", stiffness: 180, damping: 20 }}
                                >
                                    <ChevronRight className={`w-5 h-5 ${step === 'complete' ? 'text-white' : 'text-slate-400'}`} />
                                </motion.div>
                            </div>
                        </div>

                    </div>
                </motion.div>
            </div>

        </div>
    );
}
