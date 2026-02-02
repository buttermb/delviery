import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import TrendingUp from "lucide-react/dist/esm/icons/trending-up";

interface Stat {
  id: number;
  value: string;
  label: string;
}

export function LiveStatsTicker() {
  const [stats] = useState<Stat[]>([
    { id: 1, value: '1.4M+', label: 'Orders Processed' },
    { id: 2, value: '400+', label: 'Active Distributors' },
    { id: 3, value: '99.99%', label: 'Uptime SLA' },
    { id: 4, value: '15hrs', label: 'Time Saved/Week' },
  ]);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % stats.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [stats.length]);

  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <TrendingUp className="h-4 w-4 text-emerald-500" />
      <AnimatePresence mode="wait">
        <motion.div
          key={stats[currentIndex].id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3 }}
          className="flex items-center gap-2"
        >
          <span className="font-semibold text-foreground">{stats[currentIndex].value}</span>
          <span>{stats[currentIndex].label}</span>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

