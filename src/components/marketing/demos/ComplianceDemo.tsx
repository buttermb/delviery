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
        // Skip animations on mobile
        if (shouldUseStaticFallback) return;

        const interval = setInterval(() => {
            setLogs(prev => {
                const newLog = {
                    id: Date.now(),
                    action: ['SYNC', 'CHECK', 'UPLOAD'][Math.floor(Math.random() * 3)],
                    details: ['Verifying manifest ID...', 'Syncing package #1A4F...', 'Updating license status...'][Math.floor(Math.random() * 3)],
                    time: new Date().toLocaleTimeString(),
                    status: 'success'
                };
                return [...prev.slice(1), newLog];
            });
        }, 2500);
        return () => clearInterval(interval);
    }, [shouldUseStaticFallback]);

    // Mobile fallback
    if (shouldUseStaticFallback) {
        return <ComplianceDemoMobile />;
    }

    return (
        <div className="w-full h-[400px] bg-white rounded-xl overflow-hidden border border-slate-200 font-mono text-sm shadow-xl flex flex-col">
            {/* Header */}
            <div className="h-10 bg-slate-50 border-b border-slate-200 flex items-center justify-between px-4">
                <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-[hsl(var(--marketing-primary))]" />
                    <span className="text-slate-700 font-semibold">FloraIQ Compliance Engine</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-emerald-600 text-xs uppercase tracking-wider font-medium">System Active</span>
                </div>
            </div>

            <div className="flex-1 flex min-h-0 bg-white">
                {/* Sidebar Status */}
                <div className="w-1/3 border-r border-slate-100 bg-slate-50/50 p-4 space-y-6 hidden sm:block">
                    <div>
                        <div className="text-slate-500 text-xs uppercase tracking-widest mb-2 font-medium">License Status</div>
                        <div className="flex items-center gap-2 text-slate-800 font-medium">
                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                            <span>Active (C11-0000123)</span>
                        </div>
                    </div>

                    <div>
                        <div className="text-slate-500 text-xs uppercase tracking-widest mb-2 font-medium">Manifests</div>
                        <div className="flex items-center justify-between text-slate-800 mb-1">
                            <span>Generated</span>
                            <span className="font-bold">1,248</span>
                        </div>
                        <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                            <div className="bg-[hsl(var(--marketing-primary))] h-full w-[98%]"></div>
                        </div>
                        <div className="text-right text-[10px] text-slate-500 mt-1">99.9% Success Rate</div>
                    </div>

                    <div>
                        <div className="text-slate-500 text-xs uppercase tracking-widest mb-2 font-medium">Last Sync</div>
                        <div className="flex items-center gap-2 text-slate-800">
                            <RefreshCw className="w-4 h-4 text-blue-500 animate-spin-slow" />
                            <span>Just now</span>
                        </div>
                    </div>
                </div>

                {/* Live Logs */}
                <div className="flex-1 p-4 overflow-hidden relative bg-white">
                    <div className="absolute top-0 right-0 p-4 pointer-events-none bg-gradient-to-b from-white via-transparent to-transparent h-20 w-full z-10" />
                    <div className="absolute bottom-0 right-0 p-4 pointer-events-none bg-gradient-to-t from-white via-transparent to-transparent h-20 w-full z-10" />

                    <div className="space-y-3">
                        {logs.map((log) => (
                            <motion.div
                                key={log.id}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="flex items-center gap-3 text-slate-600 border-l-2 border-slate-100 pl-3 py-1"
                            >
                                <span className="text-slate-400 text-xs font-medium">{log.time}</span>
                                <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${log.status === 'success' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-blue-50 text-blue-600 border border-blue-100'}`}>
                                    {log.action}
                                </span>
                                <span className="text-slate-700 truncate font-medium">{log.details}</span>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
