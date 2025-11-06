import { motion, useScroll, useSpring } from 'framer-motion';

/**
 * Optimized scroll progress indicator using Framer Motion's useScroll
 * Avoids forced reflows by using native scroll tracking
 */
export function ScrollProgressIndicator() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001
  });

  return (
    <div className="fixed top-0 left-0 right-0 h-1 bg-muted/30 z-50">
      <motion.div
        className="h-full origin-left bg-gradient-to-r from-[hsl(var(--marketing-primary))] via-[hsl(var(--marketing-accent))] to-[hsl(var(--marketing-secondary))]"
        style={{
          scaleX,
        }}
      />
    </div>
  );
}

