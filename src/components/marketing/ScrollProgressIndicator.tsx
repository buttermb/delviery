import { motion } from 'framer-motion';
import { useScrollProgress } from '@/hooks/useScrollProgress';

export function ScrollProgressIndicator() {
  const progress = useScrollProgress();

  return (
    <div className="fixed top-0 left-0 right-0 h-1 bg-muted/30 z-50">
      <motion.div
        className="h-full bg-gradient-to-r from-[hsl(var(--marketing-primary))] via-[hsl(var(--marketing-accent))] to-[hsl(var(--marketing-secondary))]"
        style={{
          width: `${progress}%`,
        }}
        transition={{ duration: 0.1, ease: 'linear' }}
      />
    </div>
  );
}

