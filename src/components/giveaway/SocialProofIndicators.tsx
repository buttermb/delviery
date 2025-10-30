import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, Zap, Clock, Flame } from 'lucide-react';

interface SocialProofIndicatorsProps {
  totalEntries: number;
}

export function SocialProofIndicators({ totalEntries }: SocialProofIndicatorsProps) {
  const [currentViewers, setCurrentViewers] = useState(0);
  const [recentEntries, setRecentEntries] = useState(0);
  const [entriesPerMinute, setEntriesPerMinute] = useState(0);

  useEffect(() => {
    // Generate realistic viewer count (3-8% of total entries, min 18, max 200)
    const baseViewers = Math.floor(totalEntries * 0.05);
    const viewers = Math.max(18, Math.min(200, baseViewers + Math.floor(Math.random() * 20)));
    setCurrentViewers(viewers);

    // Generate recent entries (1-3% of total, min 8)
    const recent = Math.max(8, Math.floor(totalEntries * 0.02) + Math.floor(Math.random() * 10));
    setRecentEntries(recent);

    // Calculate entries per minute (realistic rate: 2-8 per minute for active giveaway)
    const perMinute = Math.max(2, Math.min(8, Math.floor(totalEntries / 1000) + Math.floor(Math.random() * 4) + 2));
    setEntriesPerMinute(perMinute);

    // Update viewers every 8-15 seconds
    const interval = setInterval(() => {
      const variation = Math.floor(Math.random() * 7) - 3; // -3 to +3
      setCurrentViewers(prev => Math.max(18, Math.min(200, prev + variation)));
      
      // Occasionally update entries per minute
      if (Math.random() > 0.7) {
        const rateVariation = Math.floor(Math.random() * 3) - 1;
        setEntriesPerMinute(prev => Math.max(2, Math.min(8, prev + rateVariation)));
      }
    }, 8000 + Math.random() * 7000);

    return () => clearInterval(interval);
  }, [totalEntries]);

  return (
    <div className="flex flex-wrap items-center justify-center gap-3 mb-8">
      {/* Viewing Now - Primary Indicator */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentViewers}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.8, opacity: 0 }}
          className="flex items-center gap-2.5 px-5 py-2.5 bg-gradient-to-r from-emerald-500/10 to-emerald-600/10 backdrop-blur-xl border border-emerald-500/20 rounded-full shadow-lg shadow-emerald-500/5"
        >
          <div className="relative">
            <Eye className="w-4 h-4 text-emerald-400" />
            <motion.div
              animate={{ scale: [1, 1.3, 1], opacity: [1, 0.5, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-400 rounded-full shadow-lg shadow-emerald-400/50"
            />
          </div>
          <span className="text-sm font-semibold text-white/95">
            <span className="text-emerald-400 font-bold">{currentViewers}</span> viewing now
          </span>
        </motion.div>
      </AnimatePresence>

      {/* Entry Rate - Shows Activity */}
      <AnimatePresence mode="wait">
        <motion.div
          key={entriesPerMinute}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.8, opacity: 0 }}
          transition={{ delay: 0.05 }}
          className="flex items-center gap-2.5 px-5 py-2.5 bg-gradient-to-r from-orange-500/10 to-red-500/10 backdrop-blur-xl border border-orange-500/20 rounded-full shadow-lg shadow-orange-500/5"
        >
          <Flame className="w-4 h-4 text-orange-400" />
          <span className="text-sm font-semibold text-white/95">
            <span className="text-orange-400 font-bold">{entriesPerMinute}</span> entries/min
          </span>
        </motion.div>
      </AnimatePresence>

      {/* Recent Activity */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="flex items-center gap-2.5 px-5 py-2.5 bg-gradient-to-r from-blue-500/10 to-purple-500/10 backdrop-blur-xl border border-blue-500/20 rounded-full shadow-lg shadow-blue-500/5"
      >
        <Clock className="w-4 h-4 text-blue-400" />
        <span className="text-sm font-semibold text-white/95">
          <span className="text-blue-400 font-bold">{recentEntries}</span> entries in last hour
        </span>
      </motion.div>

      {/* Urgency Indicator */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.15 }}
        className="flex items-center gap-2.5 px-5 py-2.5 bg-gradient-to-r from-yellow-500/10 to-amber-500/10 backdrop-blur-xl border border-yellow-500/20 rounded-full shadow-lg shadow-yellow-500/5"
      >
        <Zap className="w-4 h-4 text-yellow-400" />
        <span className="text-sm font-semibold text-white/95">
          <span className="text-yellow-400 font-bold">Hot</span> giveaway
        </span>
      </motion.div>
    </div>
  );
}
