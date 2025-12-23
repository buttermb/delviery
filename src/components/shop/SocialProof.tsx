/**
 * Social Proof Components
 * Live viewer count, recent purchases, and trust signals
 */

import { useState, useEffect, useMemo } from 'react';
import { Eye, ShoppingBag, Clock, Shield, Truck, Star, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface LiveViewerCountProps {
  productId: string;
  className?: string;
}

// Simulated live viewer count with realistic fluctuation
export function LiveViewerCount({ productId, className }: LiveViewerCountProps) {
  const [viewerCount, setViewerCount] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Generate a base count from product ID hash
    const hash = productId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const baseCount = (hash % 15) + 3; // 3-17 viewers

    setViewerCount(baseCount);
    setIsVisible(true);

    // Fluctuate count randomly every 5-15 seconds
    const interval = setInterval(() => {
      setViewerCount(prev => {
        const change = Math.random() > 0.5 ? 1 : -1;
        const newCount = Math.max(2, Math.min(25, prev + change));
        return newCount;
      });
    }, Math.random() * 10000 + 5000);

    return () => clearInterval(interval);
  }, [productId]);

  if (!isVisible || viewerCount < 3) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'flex items-center gap-2 text-sm text-muted-foreground',
        className
      )}
    >
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
      </span>
      <Eye className="w-4 h-4" />
      <span>
        <strong className="text-foreground">{viewerCount}</strong> people viewing now
      </span>
    </motion.div>
  );
}

interface RecentPurchasePopupProps {
  storeId: string;
  products: Array<{ name: string; imageUrl?: string | null }>;
  enabled?: boolean;
}

// Recent purchase notification popup
export function RecentPurchasePopup({ storeId, products, enabled = true }: RecentPurchasePopupProps) {
  const [currentPurchase, setCurrentPurchase] = useState<{
    name: string;
    location: string;
    timeAgo: string;
  } | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  const locations = useMemo(() => [
    'Brooklyn, NY',
    'Manhattan, NY',
    'Queens, NY',
    'Bronx, NY',
    'Staten Island, NY',
    'Jersey City, NJ',
    'Hoboken, NJ',
  ], []);

  const timeAgos = useMemo(() => [
    '2 minutes ago',
    '5 minutes ago',
    '8 minutes ago',
    '12 minutes ago',
    '15 minutes ago',
  ], []);

  useEffect(() => {
    if (!enabled || products.length === 0) return;

    // Show first popup after 10-20 seconds
    const initialDelay = Math.random() * 10000 + 10000;

    const showPopup = () => {
      const product = products[Math.floor(Math.random() * products.length)];
      const location = locations[Math.floor(Math.random() * locations.length)];
      const timeAgo = timeAgos[Math.floor(Math.random() * timeAgos.length)];

      setCurrentPurchase({
        name: product.name,
        location,
        timeAgo,
      });
      setIsVisible(true);

      // Hide after 5 seconds
      setTimeout(() => {
        setIsVisible(false);
      }, 5000);
    };

    const initialTimeout = setTimeout(showPopup, initialDelay);

    // Show popup every 30-60 seconds
    const interval = setInterval(() => {
      showPopup();
    }, Math.random() * 30000 + 30000);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, [enabled, products, locations, timeAgos]);

  return (
    <AnimatePresence>
      {isVisible && currentPurchase && (
        <motion.div
          initial={{ x: -100, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: -100, opacity: 0 }}
          className="fixed bottom-4 left-4 z-50 bg-background border rounded-lg shadow-lg p-3 max-w-xs"
        >
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <ShoppingBag className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium line-clamp-1">
                Someone in {currentPurchase.location}
              </p>
              <p className="text-xs text-muted-foreground line-clamp-1">
                purchased <span className="font-medium">{currentPurchase.name}</span>
              </p>
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                <Clock className="w-3 h-3" />
                {currentPurchase.timeAgo}
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

interface TrustBadgesProps {
  className?: string;
  variant?: 'horizontal' | 'vertical';
}

// Trust badges section
export function TrustBadges({ className, variant = 'horizontal' }: TrustBadgesProps) {
  const badges = [
    { icon: Shield, label: '100% Secure', sublabel: 'SSL Encrypted' },
    { icon: Truck, label: 'Fast Delivery', sublabel: '30-60 min' },
    { icon: Star, label: 'Top Rated', sublabel: '4.9/5 stars' },
    { icon: Users, label: '10K+ Customers', sublabel: 'Trust us' },
  ];

  return (
    <div
      className={cn(
        'flex gap-4',
        variant === 'vertical' ? 'flex-col' : 'flex-wrap justify-center',
        className
      )}
    >
      {badges.map((badge, index) => (
        <div
          key={index}
          className={cn(
            'flex items-center gap-2',
            variant === 'horizontal' && 'flex-col text-center'
          )}
        >
          <div className="p-2 rounded-full bg-primary/10">
            <badge.icon className="w-4 h-4 text-primary" />
          </div>
          <div className={variant === 'vertical' ? '' : 'text-center'}>
            <p className="text-xs font-medium">{badge.label}</p>
            <p className="text-xs text-muted-foreground">{badge.sublabel}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

interface LowStockAlertProps {
  stockQuantity: number;
  threshold?: number;
  className?: string;
}

// Low stock urgency alert
export function LowStockAlert({ stockQuantity, threshold = 10, className }: LowStockAlertProps) {
  if (stockQuantity > threshold || stockQuantity <= 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn('flex items-center gap-2', className)}
    >
      <Badge variant="destructive" className="animate-pulse">
        🔥 Only {stockQuantity} left!
      </Badge>
      <span className="text-xs text-muted-foreground">Order soon</span>
    </motion.div>
  );
}

interface SoldCountBadgeProps {
  productId: string;
  className?: string;
}

// Sold count badge (simulated)
export function SoldCountBadge({ productId, className }: SoldCountBadgeProps) {
  const soldCount = useMemo(() => {
    // Generate consistent count from product ID
    const hash = productId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return ((hash % 50) + 10) * 5; // 50-300 sold
  }, [productId]);

  return (
    <Badge variant="secondary" className={cn('gap-1', className)}>
      <ShoppingBag className="w-3 h-3" />
      {soldCount}+ sold
    </Badge>
  );
}

export default {
  LiveViewerCount,
  RecentPurchasePopup,
  TrustBadges,
  LowStockAlert,
  SoldCountBadge,
};
