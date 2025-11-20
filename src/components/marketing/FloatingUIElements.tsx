import { motion } from 'framer-motion';
import { usePerformanceMonitor } from '@/hooks/usePerformanceMonitor';

interface FloatingCard {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  delay: number;
  duration: number;
}

export function FloatingUIElements() {
  usePerformanceMonitor('FloatingUIElements');
  // Reduced to 1 card for optimal performance
  const cards: FloatingCard[] = [
    { id: 1, x: 50, y: 30, width: 100, height: 80, delay: 0, duration: 25 },
  ];

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20" style={{ willChange: 'auto' }}>
      {cards.map((card) => (
        <motion.div
          key={card.id}
          className="absolute rounded-lg glass-card border border-white/10"
          style={{
            left: `${card.x}%`,
            top: `${card.y}%`,
            width: `${card.width}px`,
            height: `${card.height}px`,
            willChange: 'transform, opacity',
            transform: 'translate3d(0, 0, 0)',
          }}
          animate={{
            y: [0, -20, 0],
            x: [0, 15, 0],
            rotate: [0, 3, -3, 0],
            opacity: [0.15, 0.25, 0.15],
          }}
          transition={{
            duration: card.duration,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: card.delay,
          }}
        >
          {/* Mini dashboard card content */}
          <div className="p-2 h-full flex flex-col">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-[hsl(var(--marketing-primary))]/50" />
              <div className="h-1 flex-1 bg-white/10 rounded" />
            </div>
            <div className="space-y-1 flex-1">
              <div className="h-1 bg-white/5 rounded w-3/4" />
              <div className="h-1 bg-white/5 rounded w-1/2" />
              <div className="h-4 bg-[hsl(var(--marketing-primary))]/20 rounded mt-2" />
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

