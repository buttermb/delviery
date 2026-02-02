/**
 * LiveSocialProof - Optimized real-time social proof notifications
 * Uses CSS transitions instead of Framer Motion for better performance
 */

import { useState, useEffect, useCallback } from "react";
import Users from "lucide-react/dist/esm/icons/users";
import TrendingUp from "lucide-react/dist/esm/icons/trending-up";
import ShieldCheck from "lucide-react/dist/esm/icons/shield-check";
import Zap from "lucide-react/dist/esm/icons/zap";

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
  const [isVisible, setIsVisible] = useState(false);

  const cycleNotification = useCallback(() => {
    setIsVisible(true);

    const hideTimer = setTimeout(() => {
      setIsVisible(false);

      const nextTimer = setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % activities.length);
      }, 300);

      return () => clearTimeout(nextTimer);
    }, 4000);

    return () => clearTimeout(hideTimer);
  }, []);

  useEffect(() => {
    // Initial delay before showing first notification
    const initialDelay = setTimeout(() => {
      cycleNotification();
    }, 5000); // Increased initial delay

    // Reduced frequency: show notification every 20 seconds instead of 7
    const interval = setInterval(cycleNotification, 20000);

    return () => {
      clearTimeout(initialDelay);
      clearInterval(interval);
    };
  }, [cycleNotification]);

  const activity = activities[currentIndex];
  const Icon = getIcon(activity.type);
  const colorClass = getColor(activity.type);

  return (
    <div
      className={`fixed bottom-24 left-4 z-40 md:bottom-8 transition-all duration-300 ease-out ${isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-full'
        }`}
    >
      <div className="bg-[hsl(var(--marketing-bg))]/95 backdrop-blur-sm rounded-xl border border-[hsl(var(--marketing-border))] shadow-xl p-4 max-w-xs">
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-lg ${colorClass} flex-shrink-0`}>
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
          <div className="flex items-center gap-1 flex-shrink-0">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] text-emerald-500 font-medium">LIVE</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function LiveUserCount() {
  // Static "Popular" indicator instead of fake fluctuating count
  return (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
      </span>
      <span className="text-sm font-medium text-emerald-500">
        Popular
      </span>
    </div>
  );
}
