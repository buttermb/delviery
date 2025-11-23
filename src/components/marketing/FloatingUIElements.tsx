import { motion } from 'framer-motion';
import { usePerformanceMonitor } from '@/hooks/usePerformanceMonitor';

export function FloatingUIElements() {
  usePerformanceMonitor('FloatingUIElements');
  
  // Simple floating dots - minimal animation
  const dots = [
    { id: 1, x: 20, y: 20 },
    { id: 2, x: 80, y: 40 },
    { id: 3, x: 60, y: 70 },
  ];

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-10">
      {dots.map((dot) => (
        <motion.div
          key={dot.id}
          className="absolute w-2 h-2 rounded-full bg-[hsl(var(--marketing-primary))]"
          style={{
            left: `${dot.x}%`,
            top: `${dot.y}%`,
          }}
          animate={{
            y: [0, -15, 0],
            opacity: [0.3, 0.6, 0.3],
          }}
          transition={{
            duration: 4 + dot.id,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  );
}

