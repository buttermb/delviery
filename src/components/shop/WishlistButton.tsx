/**
 * WishlistButton - Heart icon toggle for product cards
 * Animated wishlist add/remove with visual feedback
 */

import { motion, AnimatePresence } from 'framer-motion';
import { Heart } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WishlistButtonProps {
  isInWishlist: boolean;
  onToggle: () => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'overlay' | 'solid';
}

const sizeClasses = {
  sm: 'w-8 h-8',
  md: 'w-10 h-10',
  lg: 'w-12 h-12',
};

const iconSizes = {
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-6 h-6',
};

export function WishlistButton({
  isInWishlist,
  onToggle,
  className,
  size = 'md',
  variant = 'overlay',
}: WishlistButtonProps) {
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onToggle();
  };

  return (
    <motion.button
      onClick={handleClick}
      className={cn(
        'relative rounded-full flex items-center justify-center transition-all duration-300',
        sizeClasses[size],
        variant === 'overlay'
          ? 'bg-black/40 backdrop-blur-xl border border-white/10 hover:bg-white/20'
          : 'bg-white/10 hover:bg-white/20',
        className
      )}
      whileTap={{ scale: 0.9 }}
      aria-label={isInWishlist ? 'Remove from wishlist' : 'Add to wishlist'}
    >
      <AnimatePresence mode="wait">
        {isInWishlist ? (
          <motion.div
            key="filled"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            transition={{ type: 'spring', stiffness: 500, damping: 15 }}
          >
            <Heart
              className={cn(iconSizes[size], 'fill-destructive text-destructive')}
            />
          </motion.div>
        ) : (
          <motion.div
            key="outline"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            transition={{ type: 'spring', stiffness: 500, damping: 15 }}
          >
            <Heart className={cn(iconSizes[size], 'text-white')} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Burst animation on add */}
      <AnimatePresence>
        {isInWishlist && (
          <motion.div
            initial={{ scale: 0, opacity: 1 }}
            animate={{ scale: 2.5, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="absolute inset-0 rounded-full bg-destructive/30 pointer-events-none"
          />
        )}
      </AnimatePresence>
    </motion.button>
  );
}
