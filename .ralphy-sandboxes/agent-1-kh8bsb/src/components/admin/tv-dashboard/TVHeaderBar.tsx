/**
 * TVHeaderBar Component
 * 
 * Fixed header for Smart TV Dashboard showing:
 * - Location/Tenant name
 * - Live clock (updates every second)
 * - Today's date
 * - Connection status indicator
 */

import { useState, useEffect } from 'react';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { cn } from '@/lib/utils';
import { Wifi, WifiOff } from 'lucide-react';
import { formatSmartDate } from '@/lib/formatters';

interface TVHeaderBarProps {
    isConnected?: boolean;
    lastUpdated?: Date;
}

export function TVHeaderBar({ isConnected = true, lastUpdated }: TVHeaderBarProps) {
    const { tenant } = useTenantAdminAuth();
    const [currentTime, setCurrentTime] = useState(new Date());

    // Update clock every second
    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    const formatTime = (date: Date) => {
        return formatSmartDate(date, { includeTime: true });
    };

    const formatDate = (date: Date) => {
        return formatSmartDate(date);
    };

    return (
        <header className="bg-zinc-900/95 backdrop-blur-sm border-b border-zinc-800 px-8 py-4">
            <div className="flex items-center justify-between">
                {/* Location Name */}
                <div className="flex items-center gap-4">
                    <h1 className="text-3xl font-bold text-white tracking-tight">
                        {tenant?.business_name || 'Operations Center'}
                    </h1>
                </div>

                {/* Center - Clock */}
                <div className="text-center">
                    <div className="text-5xl font-mono font-bold text-white tabular-nums">
                        {formatTime(currentTime)}
                    </div>
                    <div className="text-lg text-zinc-400 mt-1">
                        {formatDate(currentTime)}
                    </div>
                </div>

                {/* Right - Status */}
                <div className="flex items-center gap-6">
                    {/* Last Updated */}
                    {lastUpdated && (
                        <div className="text-right">
                            <div className="text-xs text-zinc-500 uppercase tracking-wide">Last Updated</div>
                            <div className="text-sm text-zinc-300">
                                {formatTime(lastUpdated)}
                            </div>
                        </div>
                    )}

                    {/* Connection Status */}
                    <div className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-full",
                        isConnected ? "bg-emerald-500/20" : "bg-red-500/20"
                    )}>
                        {isConnected ? (
                            <>
                                <Wifi className="w-5 h-5 text-emerald-400" />
                                <span className="text-sm font-medium text-emerald-400">Live</span>
                                <span className="relative flex h-3 w-3">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                                </span>
                            </>
                        ) : (
                            <>
                                <WifiOff className="w-5 h-5 text-red-400" />
                                <span className="text-sm font-medium text-red-400">Disconnected</span>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </header>
    );
}
