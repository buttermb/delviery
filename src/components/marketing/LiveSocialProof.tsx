/**
 * LiveSocialProof - Real-time social proof notifications
 * Shows recent signups and activity to create urgency
 */

import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import { Users, TrendingUp, ShieldCheck, Zap } from "lucide-react";

interface Activity {
  id: number;
  type: "signup" | "order" | "menu" | "delivery";
  message: string;
  location: string;
  time: string;
}

const activities: Activity[] = [
  { id: 1, type: "signup", message: "New business joined", location: "Los Angeles, CA", time: "2 min ago" },
  { id: 2, type: "order", message: "Order processed", location: "Denver, CO", time: "5 min ago" },
  { id: 3, type: "menu", message: "Menu created", location: "Portland, OR", time: "8 min ago" },
  { id: 4, type: "delivery", message: "Delivery completed", location: "Seattle, WA", time: "12 min ago" },
  { id: 5, type: "signup", message: "New business joined", location: "Phoenix, AZ", time: "15 min ago" },
  { id: 6, type: "order", message: "Wholesale order", location: "San Diego, CA", time: "18 min ago" },
  { id: 7, type: "menu", message: "Catalog shared", location: "Las Vegas, NV", time: "22 min ago" },
  { id: 8, type: "signup", message: "New business joined", location: "Oakland, CA", time: "25 min ago" },
];

const getIcon = (type: Activity["type"]) => {
  switch (type) {
    case "signup": return Users;
    case "order": return TrendingUp;
    case "menu": return ShieldCheck;
    case "delivery": return Zap;
  }
};

const getColor = (type: Activity["type"]) => {
  switch (type) {
    case "signup": return "text-emerald-500 bg-emerald-500/10";
    case "order": return "text-blue-500 bg-blue-500/10";
    case "menu": return "text-purple-500 bg-purple-500/10";
    case "delivery": return "text-orange-500 bg-orange-500/10";
  }
};

export function LiveSocialProof() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const showInterval = setInterval(() => {
      setIsVisible(true);
      
      // Hide after 4 seconds
      setTimeout(() => {
        setIsVisible(false);
        
        // Change to next activity after fade out
        setTimeout(() => {
          setCurrentIndex((prev) => (prev + 1) % activities.length);
        }, 300);
      }, 4000);
    }, 6000);

    return () => clearInterval(showInterval);
  }, []);

  const activity = activities[currentIndex];
  const Icon = getIcon(activity.type);
  const colorClass = getColor(activity.type);

  return (
    <div className="fixed bottom-24 left-4 z-40 md:bottom-8">
      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{ opacity: 0, x: -100, scale: 0.8 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -100, scale: 0.8 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="bg-[hsl(var(--marketing-bg))]/95 backdrop-blur-xl rounded-xl border border-[hsl(var(--marketing-border))] shadow-2xl p-4 max-w-xs"
          >
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-lg ${colorClass}`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[hsl(var(--marketing-text))] truncate">
                  {activity.message}
                </p>
                <p className="text-xs text-[hsl(var(--marketing-text-light))]">
                  {activity.location} • {activity.time}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] text-emerald-500 font-medium">LIVE</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function LiveUserCount() {
  const [count, setCount] = useState(127);

  useEffect(() => {
    // Simulate fluctuating user count
    const interval = setInterval(() => {
      setCount((prev) => {
        const change = Math.floor(Math.random() * 5) - 2; // -2 to +2
        return Math.max(100, Math.min(200, prev + change));
      });
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20"
    >
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
      </span>
      <span className="text-sm font-medium text-emerald-500">
        {count} people viewing now
      </span>
    </motion.div>
  );
}

