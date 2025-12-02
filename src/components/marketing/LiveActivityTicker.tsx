/**
 * LiveActivityTicker - Optimized with CSS animations instead of Framer Motion
 * Uses CSS keyframes for smooth, GPU-accelerated scrolling
 */

import { ShoppingBag, Eye, Truck, CheckCircle } from "lucide-react";

const activities = [
  { type: "order", text: "New wholesale order ($4,200) from Miami, FL", time: "2m ago" },
  { type: "view", text: "Menu #X92 viewed by 12 retailers", time: "5m ago" },
  { type: "delivery", text: "Route optimized: 15 stops in 4.2 hrs", time: "8m ago" },
  { type: "signup", text: "GreenLeaf Distro started Free Trial", time: "12m ago" },
  { type: "order", text: "New wholesale order ($1,850) from Denver, CO", time: "15m ago" },
  { type: "delivery", text: "Driver #4 completed delivery", time: "18m ago" },
];

const icons = {
  order: ShoppingBag,
  view: Eye,
  delivery: Truck,
  signup: CheckCircle,
};

export function LiveActivityTicker() {
  return (
    <div className="w-full bg-[hsl(var(--marketing-bg))] border-y border-[hsl(var(--marketing-border))] overflow-hidden py-3 relative z-20">
      <div className="container mx-auto px-4 flex items-center">
        <div className="flex items-center gap-2 mr-8 text-[hsl(var(--marketing-accent))] font-bold text-sm whitespace-nowrap flex-shrink-0">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[hsl(var(--marketing-accent))] opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[hsl(var(--marketing-accent))]"></span>
          </span>
          LIVE
        </div>
        
        <div className="flex-1 overflow-hidden relative">
          {/* CSS-only infinite scroll animation */}
          <div 
            className="flex gap-12 whitespace-nowrap animate-marquee"
            style={{
              animation: 'marquee 40s linear infinite',
            }}
          >
            {[...activities, ...activities].map((activity, i) => {
              const Icon = icons[activity.type as keyof typeof icons];
              return (
                <div key={i} className="flex items-center gap-3 text-sm text-[hsl(var(--marketing-text-light))]">
                  <Icon className="w-4 h-4 text-[hsl(var(--marketing-primary))] flex-shrink-0" />
                  <span className="font-medium text-[hsl(var(--marketing-text))]">{activity.text}</span>
                  <span className="opacity-50 text-xs">{activity.time}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      
      {/* CSS keyframes for marquee */}
      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}
