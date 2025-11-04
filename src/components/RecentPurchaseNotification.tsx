import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShoppingBag, MapPin, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";

interface RecentPurchase {
  id: string;
  customer_name: string;
  location: string;
  created_at: string;
  products?: {
    name: string;
    image_url?: string | null;
  } | null;
}

const RecentPurchaseNotification = () => {
  const [visiblePurchase, setVisiblePurchase] = useState<RecentPurchase | null>(null);
  const [showNotification, setShowNotification] = useState(false);

  // Fetch recent purchases
  const { data: recentPurchases = [] } = useQuery({
    queryKey: ["recent-purchases"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recent_purchases")
        .select(`
          *,
          products (name, image_url)
        `)
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;
      return data || [];
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Subscribe to real-time updates
  useEffect(() => {
    const channel = supabase
      .channel("recent_purchases_channel")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "recent_purchases",
        },
        (payload) => {
          // Show notification for new purchase
          setVisiblePurchase(payload.new);
          setShowNotification(true);
          
          setTimeout(() => {
            setShowNotification(false);
          }, 5000); // Hide after 5 seconds
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Randomly show a purchase from recent history every 10-20 seconds
  useEffect(() => {
    if (recentPurchases.length === 0) return;

    const showRandomPurchase = () => {
      const randomIndex = Math.floor(Math.random() * Math.min(recentPurchases.length, 5));
      const purchase = recentPurchases[randomIndex];
      
      if (purchase) {
        setVisiblePurchase(purchase);
        setShowNotification(true);
        
        setTimeout(() => {
          setShowNotification(false);
        }, 4000);
      }
    };

    // Show first notification after 5 seconds
    const initialTimeout = setTimeout(showRandomPurchase, 5000);
    
    // Then show randomly every 15-25 seconds
    const interval = setInterval(() => {
      const randomDelay = 15000 + Math.random() * 10000;
      setTimeout(showRandomPurchase, randomDelay);
    }, 25000);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, [recentPurchases]);

  if (!visiblePurchase) return null;

  return (
    <AnimatePresence>
      {showNotification && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.9 }}
          transition={{ type: "spring", stiffness: 200, damping: 20 }}
          className="fixed bottom-6 left-6 z-50 max-w-sm"
        >
          <div className="relative bg-white/[0.02] backdrop-blur-2xl border border-white/[0.05] rounded-2xl p-6 shadow-2xl">
            {/* Glow effect */}
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent rounded-2xl" />
            
            {/* Close Button */}
            <Button
              variant="ghost"
              size="icon"
              className="absolute -top-2 -right-2 h-8 w-8 rounded-full bg-black/50 backdrop-blur-sm border border-white/20 text-white/60 hover:text-white hover:bg-white/10 z-10"
              onClick={() => setShowNotification(false)}
              aria-label="Dismiss notification"
            >
              <X className="h-4 w-4" />
            </Button>

            <div className="flex items-start gap-4 relative z-10">
              {/* Product Image - Premium */}
              <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-neutral-900 to-black border border-white/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
                {visiblePurchase.products?.image_url ? (
                  <img
                    src={visiblePurchase.products.image_url}
                    alt={visiblePurchase.products.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      // Silently replace with icon if image fails
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      const parent = target.parentElement;
                      if (parent && !parent.querySelector('svg')) {
                        const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                        icon.className.baseVal = 'w-8 h-8 text-emerald-400';
                        icon.setAttribute('viewBox', '0 0 24 24');
                        icon.setAttribute('fill', 'none');
                        icon.setAttribute('stroke', 'currentColor');
                        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                        path.setAttribute('stroke-linecap', 'round');
                        path.setAttribute('stroke-linejoin', 'round');
                        path.setAttribute('stroke-width', '2');
                        path.setAttribute('d', 'M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z');
                        icon.appendChild(path);
                        parent.appendChild(icon);
                      }
                    }}
                  />
                ) : (
                  <ShoppingBag className="w-8 h-8 text-emerald-400" />
                )}
              </div>

              {/* Content - Premium */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <motion.div
                    className="w-2 h-2 bg-emerald-500 rounded-full"
                    animate={{ scale: [1, 1.3, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                  <p className="text-sm text-white font-light tracking-wide uppercase">
                    {visiblePurchase.customer_name}
                  </p>
                </div>
                <p className="text-xs text-white/50 font-light leading-relaxed mb-2">
                  Just purchased{" "}
                  <span className="font-medium text-white">
                    {visiblePurchase.products?.name || "a product"}
                  </span>
                </p>
                <div className="flex items-center gap-1 text-xs text-white/30 font-light">
                  <MapPin className="w-3 h-3 text-emerald-400" />
                  <span className="capitalize tracking-wider">{visiblePurchase.location}</span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default RecentPurchaseNotification;
