/**
 * TVActivityTicker Component
 * 
 * Scrolling activity feed at the bottom of the TV display:
 * - CSS marquee animation
 * - Shows recent events (orders, status changes, alerts)
 */

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import ShoppingBag from "lucide-react/dist/esm/icons/shopping-bag";
import CheckCircle2 from "lucide-react/dist/esm/icons/check-circle-2";
import AlertTriangle from "lucide-react/dist/esm/icons/alert-triangle";
import Clock from "lucide-react/dist/esm/icons/clock";
import User from "lucide-react/dist/esm/icons/user";

export interface ActivityEvent {
    id: string;
    type: 'order_new' | 'order_complete' | 'order_status' | 'inventory_alert' | 'shift';
    message: string;
    timestamp: Date;
}

interface TVActivityTickerProps {
    events: ActivityEvent[];
}

function getEventIcon(type: ActivityEvent['type']) {
    switch (type) {
        case 'order_new':
            return <ShoppingBag className="w-4 h-4 text-blue-400" />;
        case 'order_complete':
            return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
        case 'order_status':
            return <Clock className="w-4 h-4 text-amber-400" />;
        case 'inventory_alert':
            return <AlertTriangle className="w-4 h-4 text-red-400" />;
        case 'shift':
            return <User className="w-4 h-4 text-purple-400" />;
        default:
            return null;
    }
}

function formatTime(date: Date): string {
    return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
    });
}

export function TVActivityTicker({ events }: TVActivityTickerProps) {
    const tickerRef = useRef<HTMLDivElement>(null);
    const [isPaused, setIsPaused] = useState(false);

    // Auto-scroll animation
    useEffect(() => {
        const ticker = tickerRef.current;
        if (!ticker || events.length === 0) return;

        // Clone content for seamless loop
        const content = ticker.querySelector('.ticker-content');
        if (content && !ticker.querySelector('.ticker-clone')) {
            const clone = content.cloneNode(true) as HTMLElement;
            clone.classList.add('ticker-clone');
            ticker.appendChild(clone);
        }
    }, [events]);

    if (events.length === 0) {
        return (
            <div className="bg-zinc-900/80 border-t border-zinc-800 px-6 py-3">
                <div className="text-zinc-500 text-center">No recent activity</div>
            </div>
        );
    }

    return (
        <div
            className="bg-zinc-900/80 border-t border-zinc-800 overflow-hidden"
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
        >
            <div
                ref={tickerRef}
                className={cn(
                    "flex whitespace-nowrap",
                    !isPaused && "animate-marquee"
                )}
                style={{
                    animation: isPaused ? 'none' : 'marquee 60s linear infinite',
                }}
            >
                <div className="ticker-content flex items-center gap-8 px-6 py-3">
                    {events.map((event) => (
                        <div
                            key={event.id}
                            className="flex items-center gap-3 text-sm"
                        >
                            {getEventIcon(event.type)}
                            <span className="text-zinc-300">{event.message}</span>
                            <span className="text-zinc-600">•</span>
                            <span className="text-zinc-500">{formatTime(event.timestamp)}</span>
                        </div>
                    ))}
                </div>
            </div>

            <style>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          animation: marquee 60s linear infinite;
        }
      `}</style>
        </div>
    );
}
