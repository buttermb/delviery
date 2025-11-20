import { motion } from 'framer-motion';
import { usePerformanceMonitor } from '@/hooks/usePerformanceMonitor';

interface BackgroundMeshProps {
  className?: string;
}

export function BackgroundMesh({ className = '' }: BackgroundMeshProps) {
  usePerformanceMonitor('BackgroundMesh');
  return (
    <div className={`absolute inset-0 w-full h-full overflow-hidden ${className}`}>
      {/* Multiple gradient layers - desktop only for performance */}
      <motion.div
        className="absolute inset-0 opacity-30 hidden md:block"
        style={{
          background: 'radial-gradient(circle at 20% 50%, hsl(var(--marketing-primary)) 0%, transparent 50%), radial-gradient(circle at 80% 80%, hsl(var(--marketing-secondary)) 0%, transparent 50%), radial-gradient(circle at 40% 20%, hsl(var(--marketing-accent)) 0%, transparent 50%)',
          willChange: 'opacity',
          backfaceVisibility: 'hidden',
        }}
        animate={{
          opacity: [0.2, 0.35, 0.2],
        }}
        transition={{
          duration: 30,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
      <motion.div
        className="absolute inset-0 opacity-20 hidden md:block"
        style={{
          background: 'radial-gradient(circle at 60% 30%, hsl(var(--marketing-secondary)) 0%, transparent 40%), radial-gradient(circle at 30% 70%, hsl(var(--marketing-primary)) 0%, transparent 40%)',
          willChange: 'opacity',
          backfaceVisibility: 'hidden',
        }}
        animate={{
          opacity: [0.15, 0.3, 0.15],
        }}
        transition={{
          duration: 35,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
      <motion.div
        className="absolute inset-0 opacity-20"
        style={{
          background: 'radial-gradient(circle at 50% 50%, hsl(var(--marketing-accent)) 0%, transparent 60%)',
          willChange: 'transform, opacity',
          backfaceVisibility: 'hidden',
          transform: 'translate3d(0, 0, 0)',
        }}
        animate={{
          scale: [1, 1.03, 1],
          opacity: [0.15, 0.2, 0.15],
        }}
        transition={{
          duration: 25,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
      {/* Mesh pattern overlay */}
      <div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px',
        }}
      />
    </div>
  );
}

