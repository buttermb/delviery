/**
 * Subtle Activity Indicator
 * Displays minimal, elegant live activity updates
 */

import { motion } from 'framer-motion';

export function SubtleActivityIndicator() {
  return (
    <div className="bg-gradient-to-r from-neutral-900 via-black to-neutral-900 py-2 border-y border-white/5">
      <div className="container mx-auto px-6">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
          className="flex items-center justify-center gap-6 md:gap-8 text-xs text-white/50 font-light tracking-wide flex-wrap"
        >
          <div className="flex items-center gap-2">
            <motion.div
              className="w-1.5 h-1.5 bg-emerald-400 rounded-full"
              animate={{ scale: [1, 1.5, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
            <span className="uppercase tracking-wider">Live • NYC</span>
          </div>
          
          <div className="hidden md:block w-px h-4 bg-white/10" />
          
          <div className="flex items-center gap-2">
            <motion.div
              className="w-1.5 h-1.5 bg-emerald-400 rounded-full"
              animate={{ scale: [1, 1.5, 1] }}
              transition={{ duration: 2, delay: 0.7, repeat: Infinity }}
            />
            <span className="uppercase tracking-wider">Same-Day Delivery</span>
          </div>
          
          <div className="hidden md:block w-px h-4 bg-white/10" />
          
          <div className="flex items-center gap-2">
            <motion.div
              className="w-1.5 h-1.5 bg-emerald-400 rounded-full"
              animate={{ scale: [1, 1.5, 1] }}
              transition={{ duration: 2, delay: 1.4, repeat: Infinity }}
            />
            <span className="uppercase tracking-wider">Lab Verified</span>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

