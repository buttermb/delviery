import { motion } from 'framer-motion';
import { FileText, CheckCircle2, RefreshCw, Database, ShieldCheck, Lock } from 'lucide-react';
import { useState, useEffect } from 'react';

export function ComplianceDemo() {
    const [logs, setLogs] = useState([
        { id: 1, action: 'SYNC_START', details: 'Initiating hourly Metrc sync...', time: '10:00:00', status: 'info' },
        { id: 2, action: 'FETCH_SALES', details: 'Found 42 new transactions', time: '10:00:02', status: 'success' },
        { id: 3, action: 'VALIDATE', details: 'Validating package tags...', time: '10:00:03', status: 'success' },
        { id: 4, action: 'UPLOAD', details: 'Pushing sales payload to Metrc', time: '10:00:05', status: 'process' },
        { id: 5, action: 'VERIFY', details: 'Metrc confirmation received', time: '10:00:06', status: 'success' },
    ]);

    useEffect(() => {
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
    }, []);

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
