/**
 * ComplianceDemo Component
 * 
 * Demonstrates the automated compliance and Metrc sync features.
 * Desktop: Live logs with animated updates
 * Mobile: Simplified status cards with key metrics
 */

import { motion } from 'framer-motion';
import { FileText, CheckCircle2, RefreshCw, ShieldCheck, Lock, Zap, Clock, Database } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useMobileOptimized } from '@/hooks/useMobileOptimized';

// Mobile-optimized static fallback
function ComplianceDemoMobile() {
    return (
        <div className="w-full min-h-[280px] bg-slate-50 dark:bg-zinc-900 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm relative p-5">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-600 to-teal-600 flex items-center justify-center">
                        <ShieldCheck className="w-4 h-4 text-white" />
                    </div>
                    <div>
                        <div className="font-bold text-slate-900 text-sm">Compliance Engine</div>
                        <div className="text-xs text-slate-500">Metrc Integration</div>
                    </div>
                </div>
                <div className="flex items-center gap-1.5 text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-xs font-medium">Active</span>
                </div>
            </div>

            {/* Status Cards */}
            <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-white rounded-xl p-3 border border-slate-100 shadow-sm">
                    <div className="flex items-center gap-2 mb-1">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span className="text-xs text-slate-500">License</span>
                    </div>
                    <div className="text-sm font-bold text-slate-900">Active</div>
                    <div className="text-xs text-slate-500">C11-0000123</div>
                </div>
                <div className="bg-white rounded-xl p-3 border border-slate-100 shadow-sm">
                    <div className="flex items-center gap-2 mb-1">
                        <RefreshCw className="w-4 h-4 text-blue-600" />
                        <span className="text-xs text-slate-500">Last Sync</span>
                    </div>
                    <div className="text-sm font-bold text-slate-900">Just now</div>
                    <div className="text-xs text-emerald-600 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" aria-hidden="true" /> Success</div>
                </div>
            </div>

            {/* Metrics */}
            <div className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-medium text-slate-700">Manifests Generated</span>
                    <span className="text-lg font-bold text-slate-900">1,248</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden mb-1">
                    <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full" style={{ width: '99%' }} />
                </div>
                <div className="text-xs text-slate-500 text-right">99.9% Success Rate</div>
            </div>

            {/* Recent Activity */}
            <div className="mt-3 space-y-2">
                {[
                    { action: 'SYNC', detail: 'Metrc sync completed', status: 'success' },
                    { action: 'VALIDATE', detail: 'Package tags verified', status: 'success' },
                ].map((log, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs bg-white/80 px-3 py-2 rounded-lg border border-slate-100">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${log.status === 'success' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'}`}>
                            {log.action}
                        </span>
                        <span className="text-slate-600">{log.detail}</span>
                    </div>
                ))}
            </div>

            {/* Interactive Hint */}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-600 text-white text-xs font-medium rounded-full shadow-lg">
                    <Zap className="w-3 h-3" />
                    Automated Compliance Demo
                </div>
            </div>
        </div>
    );
}

export function ComplianceDemo() {
    const { shouldUseStaticFallback } = useMobileOptimized();
    const [logs, setLogs] = useState([
        { id: 1, action: 'SYNC_START', details: 'Initiating hourly Metrc sync...', time: '10:00:00', status: 'info' },
        { id: 2, action: 'FETCH_SALES', details: 'Found 42 new transactions', time: '10:00:02', status: 'success' },
        { id: 3, action: 'VALIDATE', details: 'Validating package tags...', time: '10:00:03', status: 'success' },
        { id: 4, action: 'UPLOAD', details: 'Pushing sales payload to Metrc', time: '10:00:05', status: 'process' },
        { id: 5, action: 'VERIFY', details: 'Metrc confirmation received', time: '10:00:06', status: 'success' },
    ]);

    useEffect(() => {
        // Static mode only - no fake logs
    }, [shouldUseStaticFallback]);

    // Mobile fallback
    if (shouldUseStaticFallback) {
        return <ComplianceDemoMobile />;
    }

    return (
        <div className="w-full h-[400px] bg-white rounded-xl overflow-hidden border border-slate-200 font-mono text-sm shadow-xl flex flex-col relative group">

            {/* SCANNER BEAM ANIMATION */}
            <motion.div
                className="absolute inset-x-0 h-[2px] bg-emerald-500/50 z-20 shadow-[0_0_15px_rgba(16,185,129,0.5)] pointer-events-none"
                animate={{ top: ['0%', '100%', '0%'] }}
                transition={{ duration: 8, ease: "linear", repeat: Infinity }}
            />

            {/* Header */}
            <div className="h-10 bg-slate-50 border-b border-slate-200 flex items-center justify-between px-4 z-10 relative">
                <div className="flex items-center gap-2">
                    <div className="relative">
                        <ShieldCheck className="w-4 h-4 text-[hsl(var(--marketing-primary))]" />
                        {/* Shield Glow */}
                        <div className="absolute inset-0 bg-[hsl(var(--marketing-primary))] blur-md opacity-20 animate-pulse" />
                    </div>
                    <span className="text-slate-700 font-semibold tracking-tight">FloraIQ Compliance Engine</span>
                </div>
                <div className="flex items-center gap-2 bg-emerald-50 px-2 py-1 rounded text-emerald-700 border border-emerald-100">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[10px] uppercase tracking-wider font-bold">System Active</span>
                </div>
            </div>

            <div className="flex-1 flex min-h-0 bg-white relative z-0">
                {/* Sidebar Status */}
                <div className="w-1/3 border-r border-slate-100 bg-slate-50/30 p-4 space-y-6 hidden sm:block relative overflow-hidden">
                    {/* Background Grid Pattern */}
                    <svg className="absolute inset-0 opacity-[0.03] z-0" width="100%" height="100%">
                        <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="currentColor" strokeWidth="0.5" />
                        </pattern>
                        <rect width="100%" height="100%" fill="url(#grid)" />
                    </svg>

                    <div className="relative z-10">
                        <div className="text-slate-400 text-[10px] uppercase tracking-widest mb-1 font-bold">License Status</div>
                        <div className="bg-white border border-slate-200 rounded-lg p-2 shadow-sm flex items-center gap-2 text-slate-800 font-medium">
                            <div className="bg-emerald-100 p-1 rounded">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            </div>
                            <span className="font-mono text-xs">Active (C11-000...)</span>
                        </div>
                    </div>

                    <div className="relative z-10">
                        <div className="text-slate-400 text-[10px] uppercase tracking-widest mb-1 font-bold">Manifests</div>
                        <div className="flex items-center justify-between text-slate-800 mb-1">
                            <span className="text-xs">Generated</span>
                            <span className="font-mono font-bold text-sm">1,248</span>
                        </div>
                        <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                            <motion.div
                                className="bg-[hsl(var(--marketing-primary))] h-full w-[98%]"
                                animate={{ opacity: [0.8, 1, 0.8] }}
                                transition={{ duration: 2, repeat: Infinity }}
                            />
                        </div>
                        <div className="text-right text-[10px] text-emerald-600 font-bold mt-1">99.9% Success Rate</div>
                    </div>

                    <div className="relative z-10">
                        <div className="text-slate-400 text-[10px] uppercase tracking-widest mb-1 font-bold">Sync Pulse</div>
                        <div className="flex items-center gap-2 text-slate-800 bg-blue-50 border border-blue-100 rounded-lg p-2">
                            <RefreshCw className="w-3.5 h-3.5 text-blue-500 animate-spin-slow" />
                            <span className="text-xs font-mono">Live Sync: 45ms</span>
                        </div>
                    </div>
                </div>

                {/* Live Logs - TERMINAL STYLE */}
                <div className="flex-1 p-0 overflow-hidden relative bg-[#0f172a]">
                    <div className="absolute top-0 right-0 p-4 pointer-events-none bg-gradient-to-b from-[#0f172a] via-transparent to-transparent h-10 w-full z-10" />
                    <div className="absolute bottom-0 right-0 p-4 pointer-events-none bg-gradient-to-t from-[#0f172a] via-transparent to-transparent h-10 w-full z-10" />

                    <div className="p-4 font-mono text-xs space-y-2 h-full flex flex-col justify-end">
                        {logs.map((log) => (
                            <motion.div
                                key={log.id}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ duration: 0.3 }}
                                className="flex items-start gap-3 text-slate-300 border-l-2 border-slate-700 pl-3 py-0.5 hover:bg-white/5 transition-colors rounded-r"
                            >
                                <span className="text-slate-500 text-[10px] min-w-[50px]">{log.time.split(' ')[0]}</span>
                                <span className={`text-[10px] font-bold px-1.5 rounded min-w-[60px] text-center ${log.action === 'SYNC' ? 'text-blue-400 bg-blue-900/30' :
                                    log.action === 'UPLOAD' ? 'text-amber-400 bg-amber-900/30' :
                                        'text-emerald-400 bg-emerald-900/30'
                                    }`}>
                                    {log.action}
                                </span>
                                <span className="text-slate-300 truncate font-medium">{log.details}</span>
                            </motion.div>
                        ))}
                        <div className="flex items-center gap-2 text-emerald-500 pt-2 animate-pulse">
                            <span className="w-1.5 h-3 bg-emerald-500 block" />
                            <span className="text-[10px] uppercase">Awaiting input...</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
