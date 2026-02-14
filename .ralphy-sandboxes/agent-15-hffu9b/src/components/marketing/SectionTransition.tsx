import { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { useReducedMotion } from '@/hooks/useReducedMotion';

interface SectionTransitionProps {
  children: ReactNode;
  className?: string;
  variant?: 'fade' | 'slide' | 'scale' | 'stagger';
  delay?: number;
}

export function SectionTransition({
  children,
  className = '',
  variant = 'fade',
  delay = 0,
}: SectionTransitionProps) {
  const prefersReducedMotion = useReducedMotion();
  const { ref, inView } = useInView({
    threshold: 0.05,
    triggerOnce: true,
  });

  // Skip animations if user prefers reduced motion
  if (prefersReducedMotion) {
    return <div ref={ref} className={className}>{children}</div>;
  }

  const getAnimationProps = () => {
    switch (variant) {
      case 'fade':
        return {
          initial: { opacity: 0, y: 20 },
          animate: inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 },
          transition: { 
            type: 'spring' as const,
            stiffness: 100,
            damping: 15,
            delay: delay * 0.5,
          },
        };
      case 'slide':
        return {
          initial: { opacity: 0, x: -30 },
          animate: inView ? { opacity: 1, x: 0 } : { opacity: 0, x: -30 },
          transition: { 
            type: 'spring' as const,
            stiffness: 120,
            damping: 18,
            delay: delay * 0.5,
          },
        };
      case 'scale':
        return {
          initial: { opacity: 0, scale: 0.95 },
          animate: inView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.95 },
          transition: { 
            type: 'spring' as const,
            stiffness: 150,
            damping: 20,
            delay: delay * 0.5,
          },
        };
      case 'stagger':
        return {
          initial: { opacity: 0 },
          animate: inView ? { opacity: 1 } : { opacity: 0 },
          transition: { 
            duration: 0.3, 
            delay: delay * 0.5,
          },
        };
      default:
        return {
          initial: { opacity: 0 },
          animate: inView ? { opacity: 1 } : { opacity: 0 },
          transition: { 
            type: 'spring' as const,
            stiffness: 100,
            damping: 15,
            delay: delay * 0.5,
          },
        };
    }
  };

  return (
    <motion.div
      ref={ref}
      className={className}
      {...getAnimationProps()}
    >
      {children}
    </motion.div>
  );
}

