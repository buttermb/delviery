/**
 * LiveMapDemo Component - With Visible Map
 * 
 * Fleet tracking with a clear, visible map background.
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Truck, MapPin, Clock, Navigation, CheckCircle2,
  Package, Zap
} from 'lucide-react';

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
  { id: '1', name: 'Mike T.', avatar: '👨', status: 'delivering', orders: 3, eta: 12, position: { x: 30, y: 35 } },
  { id: '2', name: 'Sarah K.', avatar: '👩', status: 'picking_up', orders: 2, eta: 5, position: { x: 55, y: 60 } },
  { id: '3', name: 'John D.', avatar: '🧔', status: 'completed', orders: 5, eta: 0, position: { x: 75, y: 40 } },
];

export function LiveMapDemo() {
  const [drivers, setDrivers] = useState(INITIAL_DRIVERS);
  const [stats, setStats] = useState({ active: 2, delivered: 12, onTime: 98 });

  // Animate driver positions
  useEffect(() => {
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
  }, []);

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'delivering': return { color: 'text-blue-400', bg: 'bg-blue-500', label: 'Delivering' };
      case 'picking_up': return { color: 'text-amber-400', bg: 'bg-amber-500', label: 'Picking Up' };
      case 'completed': return { color: 'text-emerald-400', bg: 'bg-emerald-500', label: 'Completed' };
      default: return { color: 'text-zinc-400', bg: 'bg-zinc-500', label: 'Idle' };
    }
  };

  return (
    <div className="w-full h-full bg-zinc-950 rounded-xl border border-zinc-800 overflow-hidden p-4 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-cyan-600 flex items-center justify-center">
            <Navigation className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-white">Fleet Tracking</h3>
            <p className="text-xs text-zinc-500">Live driver locations</p>
          </div>
        </div>
        <div className="flex items-center gap-2 px-2 py-1 rounded-full bg-emerald-500/10">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="text-xs text-emerald-400 font-medium">Live</span>
        </div>
      </div>

      {/* MAP AREA - Main focus */}
      <div className="flex-1 rounded-xl overflow-hidden relative" style={{ minHeight: '200px' }}>
        {/* Map Background - Stylized city blocks */}
        <div className="absolute inset-0 bg-zinc-900">
          {/* Water/park area */}
          <div className="absolute top-0 right-0 w-1/3 h-1/3 bg-blue-900/20 rounded-bl-3xl" />

          {/* Major roads - Horizontal */}
          <div className="absolute top-[30%] left-0 right-0 h-3 bg-zinc-700" />
          <div className="absolute top-[60%] left-0 right-0 h-2 bg-zinc-700" />

          {/* Major roads - Vertical */}
          <div className="absolute left-[25%] top-0 bottom-0 w-2 bg-zinc-700" />
          <div className="absolute left-[50%] top-0 bottom-0 w-3 bg-zinc-700" />
          <div className="absolute left-[75%] top-0 bottom-0 w-2 bg-zinc-700" />

          {/* City blocks */}
          <div className="absolute top-[8%] left-[8%] w-[14%] h-[18%] bg-zinc-800 rounded-md" />
          <div className="absolute top-[8%] left-[30%] w-[16%] h-[18%] bg-zinc-800 rounded-md" />
          <div className="absolute top-[8%] left-[55%] w-[12%] h-[18%] bg-zinc-800 rounded-md" />

          <div className="absolute top-[38%] left-[8%] w-[14%] h-[18%] bg-zinc-800 rounded-md" />
          <div className="absolute top-[38%] left-[30%] w-[16%] h-[18%] bg-zinc-800 rounded-md" />
          <div className="absolute top-[38%] left-[55%] w-[16%] h-[18%] bg-zinc-800 rounded-md" />
          <div className="absolute top-[38%] left-[78%] w-[14%] h-[18%] bg-zinc-800 rounded-md" />

          <div className="absolute top-[68%] left-[8%] w-[14%] h-[24%] bg-zinc-800 rounded-md" />
          <div className="absolute top-[68%] left-[30%] w-[16%] h-[24%] bg-zinc-800 rounded-md" />
          <div className="absolute top-[68%] left-[55%] w-[16%] h-[24%] bg-zinc-800 rounded-md" />
          <div className="absolute top-[68%] left-[78%] w-[14%] h-[24%] bg-zinc-800 rounded-md" />

          {/* Road markings - dashed center lines */}
          <div className="absolute top-[31%] left-0 right-0 border-t border-dashed border-yellow-600/50" />
          <div className="absolute left-[51%] top-0 bottom-0 border-l border-dashed border-yellow-600/50" />
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
                  <span className="text-lg">{driver.avatar}</span>
                </motion.div>

                {/* Pulse for active */}
                {driver.status === 'delivering' && (
                  <span className="absolute inset-0 rounded-full animate-ping bg-blue-400/40" />
                )}

                {/* Name tag */}
                <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-zinc-900/90 rounded text-xs text-white font-medium whitespace-nowrap border border-zinc-700">
                  {driver.name}
                </div>
              </div>
            </motion.div>
          );
        })}

        {/* Legend */}
        <div className="absolute bottom-2 left-2 flex gap-2">
          <div className="flex items-center gap-1 px-2 py-1 bg-zinc-900/80 rounded text-xs text-zinc-400 border border-zinc-700">
            <div className="w-2 h-2 rounded-full bg-blue-500" />
            Delivering
          </div>
          <div className="flex items-center gap-1 px-2 py-1 bg-zinc-900/80 rounded text-xs text-zinc-400 border border-zinc-700">
            <div className="w-2 h-2 rounded-full bg-amber-500" />
            Pickup
          </div>
          <div className="flex items-center gap-1 px-2 py-1 bg-zinc-900/80 rounded text-xs text-zinc-400 border border-zinc-700">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            Done
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-2 mt-3">
        <div className="bg-zinc-900 rounded-xl p-2.5 text-center border border-zinc-800">
          <Truck className="w-4 h-4 text-blue-400 mx-auto mb-1" />
          <div className="text-lg font-bold text-white">{stats.active}</div>
          <div className="text-xs text-zinc-500">Active</div>
        </div>
        <div className="bg-zinc-900 rounded-xl p-2.5 text-center border border-zinc-800">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 mx-auto mb-1" />
          <motion.div
            key={stats.delivered}
            initial={{ scale: 1.2 }}
            animate={{ scale: 1 }}
            className="text-lg font-bold text-emerald-400"
          >
            {stats.delivered}
          </motion.div>
          <div className="text-xs text-zinc-500">Delivered</div>
        </div>
        <div className="bg-zinc-900 rounded-xl p-2.5 text-center border border-zinc-800">
          <Zap className="w-4 h-4 text-amber-400 mx-auto mb-1" />
          <div className="text-lg font-bold text-amber-400">{stats.onTime}%</div>
          <div className="text-xs text-zinc-500">On-Time</div>
        </div>
      </div>
    </div>
  );
}
