/**
 * LiveMapDemo Component - With Visible Map
 * 
 * Fleet tracking with a clear, visible map background.
 * Desktop: Animated driver positions and live stats
 * Mobile: Simplified static preview with driver list
 */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Truck, MapPin, Navigation, CheckCircle2,
  Zap, Users
} from 'lucide-react';
import { useMobileOptimized } from '@/hooks/useMobileOptimized';

interface Driver {
  id: string;
  name: string;
  avatar: string;
  status: 'delivering' | 'picking_up' | 'completed';
  orders: number;
  eta: number;
  position: { x: number; y: number };
}

const INITIAL_DRIVERS: Driver[] = [
  { id: '1', name: 'Mike T.', avatar: 'MT', status: 'delivering', orders: 3, eta: 12, position: { x: 30, y: 35 } },
  { id: '2', name: 'Sarah K.', avatar: 'SK', status: 'picking_up', orders: 2, eta: 5, position: { x: 55, y: 60 } },
  { id: '3', name: 'John D.', avatar: 'JD', status: 'completed', orders: 5, eta: 0, position: { x: 75, y: 40 } },
];

// Mobile-optimized static fallback
function LiveMapDemoMobile() {
  return (
    <div className="w-full min-h-[320px] bg-slate-50 dark:bg-zinc-900 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm relative p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-cyan-600 flex items-center justify-center">
            <Navigation className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="font-bold text-slate-900 text-sm">Fleet Tracking</div>
            <div className="text-xs text-slate-500">Live driver locations</div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-amber-600 bg-amber-50 px-2 py-1 rounded-full">
          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
          <span className="text-xs font-medium">Live</span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="bg-white rounded-xl p-3 border border-slate-100 shadow-sm text-center">
          <Truck className="w-5 h-5 text-blue-600 mx-auto mb-1" />
          <div className="text-xl font-bold text-slate-900">2</div>
          <div className="text-xs text-slate-500">Active</div>
        </div>
        <div className="bg-white rounded-xl p-3 border border-slate-100 shadow-sm text-center">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 mx-auto mb-1" />
          <div className="text-xl font-bold text-emerald-600">12</div>
          <div className="text-xs text-slate-500">Delivered</div>
        </div>
        <div className="bg-white rounded-xl p-3 border border-slate-100 shadow-sm text-center">
          <Zap className="w-5 h-5 text-amber-600 mx-auto mb-1" />
          <div className="text-xl font-bold text-amber-600">98%</div>
          <div className="text-xs text-slate-500">On-Time</div>
        </div>
      </div>

      {/* Driver List */}
      <div className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-slate-500" />
            <span className="text-sm font-medium text-slate-700">Active Drivers</span>
          </div>
          <span className="text-xs text-blue-600 font-medium">View Map →</span>
        </div>
        <div className="space-y-2">
          {INITIAL_DRIVERS.map((driver) => (
            <div key={driver.id} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-lg ${driver.status === 'delivering' ? 'bg-amber-100' :
                  driver.status === 'picking_up' ? 'bg-blue-100' :
                    'bg-slate-100'
                  }`}>
                  <span className="text-xs font-bold">{driver.avatar}</span>
                </div>
                <div>
                  <div className="text-sm font-medium text-slate-900">{driver.name}</div>
                  <div className="text-xs text-slate-500">{driver.orders} orders</div>
                </div>
              </div>
              <div className="text-right">
                <div className={`text-xs px-2 py-0.5 rounded-full ${driver.status === 'delivering' ? 'bg-amber-100 text-amber-700' :
                  driver.status === 'picking_up' ? 'bg-blue-100 text-blue-700' :
                    'bg-emerald-100 text-emerald-700'
                  }`}>
                  {driver.status === 'delivering' ? 'Delivering' :
                    driver.status === 'picking_up' ? 'Pickup' : 'Done'}
                </div>
                {driver.eta > 0 && (
                  <div className="text-xs text-slate-500 mt-0.5">ETA: {driver.eta} min</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Interactive Hint */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-full shadow-lg">
          <Zap className="w-3 h-3" />
          Fleet Tracking Demo
        </div>
      </div>
    </div>
  );
}

export function LiveMapDemo() {
  const { shouldUseStaticFallback } = useMobileOptimized();
  const [drivers, setDrivers] = useState(INITIAL_DRIVERS);
  const [stats, setStats] = useState({ active: 2, delivered: 12, onTime: 98 });

  // Animate driver positions (only on desktop)
  useEffect(() => {
    if (shouldUseStaticFallback) return;

    const timer = setInterval(() => {
      setDrivers(prev => prev.map(d => {
        if (d.status === 'completed') return d;
        return {
          ...d,
          position: {
            x: Math.min(85, Math.max(15, d.position.x + (Math.random() - 0.5) * 5)),
            y: Math.min(75, Math.max(20, d.position.y + (Math.random() - 0.5) * 5)),
          },
          eta: Math.max(0, d.eta - (Math.random() > 0.7 ? 1 : 0)),
        };
      }));

      if (Math.random() > 0.6) {
        setStats(prev => ({ ...prev, delivered: prev.delivered + 1 }));
      }
    }, 2000);
    return () => clearInterval(timer);
  }, [shouldUseStaticFallback]);

  // Mobile fallback
  if (shouldUseStaticFallback) {
    return <LiveMapDemoMobile />;
  }

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'delivering': return { color: 'text-[hsl(var(--marketing-accent))]', bg: 'bg-[hsl(var(--marketing-accent))]', label: 'Delivering' };
      case 'picking_up': return { color: 'text-[hsl(var(--marketing-primary))]', bg: 'bg-[hsl(var(--marketing-primary))]', label: 'Picking Up' };
      case 'completed': return { color: 'text-[hsl(var(--marketing-text))]', bg: 'bg-[hsl(var(--marketing-text))]', label: 'Completed' };
      default: return { color: 'text-[hsl(var(--marketing-text-light))]', bg: 'bg-[hsl(var(--marketing-text-light))]', label: 'Idle' };
    }
  };

  return (
    <div className="w-full h-full bg-[hsl(var(--marketing-bg))] rounded-xl border border-[hsl(var(--marketing-border))] overflow-hidden p-4 flex flex-col shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-cyan-600 flex items-center justify-center">
            <Navigation className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-[hsl(var(--marketing-text))]">Fleet Tracking</h3>
            <p className="text-xs text-[hsl(var(--marketing-text-light))]">Live driver locations</p>
          </div>
        </div>
        <div className="flex items-center gap-2 px-2 py-1 rounded-full bg-[hsl(var(--marketing-accent))]/10 border border-[hsl(var(--marketing-accent))]/20">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[hsl(var(--marketing-accent))] opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[hsl(var(--marketing-accent))]"></span>
          </span>
          <span className="text-xs text-[hsl(var(--marketing-accent))] font-medium">Live</span>
        </div>
      </div>

      {/* MAP AREA - Main focus */}
      <div className="flex-1 rounded-xl overflow-hidden relative" style={{ minHeight: '200px' }}>
        {/* Map Background - Stylized city blocks */}
        <div className="absolute inset-0 bg-gray-200">
          {/* Water/park area */}
          <div className="absolute top-0 right-0 w-1/3 h-1/3 bg-[hsl(var(--marketing-primary))]/10 rounded-bl-3xl" />

          {/* Major roads - Horizontal */}
          <div className="absolute top-[30%] left-0 right-0 h-3 bg-white" />
          <div className="absolute top-[60%] left-0 right-0 h-2 bg-white" />

          {/* Major roads - Vertical */}
          <div className="absolute left-[25%] top-0 bottom-0 w-2 bg-white" />
          <div className="absolute left-[50%] top-0 bottom-0 w-3 bg-white" />
          <div className="absolute left-[75%] top-0 bottom-0 w-2 bg-white" />

          {/* City blocks */}
          <div className="absolute top-[8%] left-[8%] w-[14%] h-[18%] bg-white rounded-md border border-zinc-200" />
          <div className="absolute top-[8%] left-[30%] w-[16%] h-[18%] bg-white rounded-md border border-zinc-200" />
          <div className="absolute top-[8%] left-[55%] w-[12%] h-[18%] bg-white rounded-md border border-zinc-200" />

          <div className="absolute top-[38%] left-[8%] w-[14%] h-[18%] bg-white rounded-md border border-zinc-200" />
          <div className="absolute top-[38%] left-[30%] w-[16%] h-[18%] bg-white rounded-md border border-zinc-200" />
          <div className="absolute top-[38%] left-[55%] w-[16%] h-[18%] bg-white rounded-md border border-zinc-200" />
          <div className="absolute top-[38%] left-[78%] w-[14%] h-[18%] bg-white rounded-md border border-zinc-200" />

          <div className="absolute top-[68%] left-[8%] w-[14%] h-[24%] bg-white rounded-md border border-zinc-200" />
          <div className="absolute top-[68%] left-[30%] w-[16%] h-[24%] bg-white rounded-md border border-zinc-200" />
          <div className="absolute top-[68%] left-[55%] w-[16%] h-[24%] bg-white rounded-md border border-zinc-200" />
          <div className="absolute top-[68%] left-[78%] w-[14%] h-[24%] bg-white rounded-md border border-zinc-200" />

          {/* Road markings */}
          <div className="absolute top-[31%] left-0 right-0 border-t border-dashed border-[hsl(var(--marketing-accent))]/20" />
          <div className="absolute left-[51%] top-0 bottom-0 border-l border-dashed border-[hsl(var(--marketing-accent))]/20" />
        </div>

        {/* Destination pins */}
        <motion.div
          className="absolute"
          style={{ left: '80%', top: '25%' }}
          animate={{ y: [0, -4, 0] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          <MapPin className="w-6 h-6 text-red-500 drop-shadow-lg -translate-x-1/2" />
        </motion.div>
        <motion.div
          className="absolute"
          style={{ left: '20%', top: '75%' }}
          animate={{ y: [0, -4, 0] }}
          transition={{ duration: 1.5, repeat: Infinity, delay: 0.5 }}
        >
          <MapPin className="w-5 h-5 text-red-400 drop-shadow-lg -translate-x-1/2" />
        </motion.div>

        {/* Drivers on map */}
        {drivers.map(driver => {
          const style = getStatusStyle(driver.status);
          return (
            <motion.div
              key={driver.id}
              className="absolute"
              animate={{
                left: `${driver.position.x}%`,
                top: `${driver.position.y}%`,
              }}
              transition={{ type: 'spring', stiffness: 80, damping: 20 }}
            >
              <div className="relative -translate-x-1/2 -translate-y-1/2">
                {/* Driver marker */}
                <motion.div
                  className={`w-10 h-10 rounded-full ${style.bg} flex items-center justify-center shadow-xl border-2 border-white/30`}
                  animate={driver.status === 'delivering' ? { scale: [1, 1.08, 1] } : {}}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  <span className="text-xs font-bold text-white">{driver.avatar}</span>
                </motion.div>

                {/* Pulse for active */}
                {driver.status === 'delivering' && (
                  <span className="absolute inset-0 rounded-full animate-ping bg-blue-400/40" />
                )}

                {/* Name tag */}
                <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-[hsl(var(--marketing-text))] rounded text-xs text-white font-medium whitespace-nowrap border border-[hsl(var(--marketing-border))]">
                  {driver.name}
                </div>
              </div>
            </motion.div>
          );
        })}

        {/* Legend */}
        <div className="absolute bottom-2 left-2 flex gap-2">
          <div className="flex items-center gap-1 px-2 py-1 bg-white/90 rounded text-xs text-[hsl(var(--marketing-text))] border border-[hsl(var(--marketing-border))] shadow-sm">
            <div className="w-2 h-2 rounded-full bg-[hsl(var(--marketing-accent))]" />
            Delivering
          </div>
          <div className="flex items-center gap-1 px-2 py-1 bg-white/90 rounded text-xs text-[hsl(var(--marketing-text))] border border-[hsl(var(--marketing-border))] shadow-sm">
            <div className="w-2 h-2 rounded-full bg-[hsl(var(--marketing-primary))]" />
            Pickup
          </div>
          <div className="flex items-center gap-1 px-2 py-1 bg-white/90 rounded text-xs text-[hsl(var(--marketing-text))] border border-[hsl(var(--marketing-border))] shadow-sm">
            <div className="w-2 h-2 rounded-full bg-[hsl(var(--marketing-text))]" />
            Done
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-2 mt-3">
        <div className="bg-[hsl(var(--marketing-primary))]/5 rounded-xl p-2.5 text-center border border-[hsl(var(--marketing-primary))]/10">
          <Truck className="w-4 h-4 text-[hsl(var(--marketing-primary))] mx-auto mb-1" />
          <div className="text-lg font-bold text-[hsl(var(--marketing-text))]">{stats.active}</div>
          <div className="text-xs text-[hsl(var(--marketing-text-light))]">Active</div>
        </div>
        <div className="bg-[hsl(var(--marketing-primary))]/5 rounded-xl p-2.5 text-center border border-[hsl(var(--marketing-primary))]/10">
          <CheckCircle2 className="w-4 h-4 text-[hsl(var(--marketing-accent))] mx-auto mb-1" />
          <motion.div
            key={stats.delivered}
            initial={{ scale: 1.2 }}
            animate={{ scale: 1 }}
            className="text-lg font-bold text-[hsl(var(--marketing-accent))]"
          >
            {stats.delivered}
          </motion.div>
          <div className="text-xs text-[hsl(var(--marketing-text-light))]">Delivered</div>
        </div>
        <div className="bg-[hsl(var(--marketing-primary))]/5 rounded-xl p-2.5 text-center border border-[hsl(var(--marketing-primary))]/10">
          <Zap className="w-4 h-4 text-[hsl(var(--marketing-accent))] mx-auto mb-1" />
          <div className="text-lg font-bold text-[hsl(var(--marketing-accent))]">{stats.onTime}%</div>
          <div className="text-xs text-[hsl(var(--marketing-text-light))]">On-Time</div>
        </div>
      </div>
    </div>
  );
}
