import { ReactNode, useEffect, useRef, useState } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { useInView } from 'react-intersection-observer';

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
  const { ref, inView } = useInView({
    threshold: 0.1,
    triggerOnce: true,
  });

  const getAnimationProps = () => {
    switch (variant) {
      case 'fade':
        return {
          initial: { opacity: 0, y: 30 },
          animate: inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 },
          transition: { duration: 0.6, delay },
        };
      case 'slide':
        return {
          initial: { opacity: 0, x: -50 },
          animate: inView ? { opacity: 1, x: 0 } : { opacity: 0, x: -50 },
          transition: { duration: 0.6, delay },
        };
      case 'scale':
        return {
          initial: { opacity: 0, scale: 0.95 },
          animate: inView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.95 },
          transition: { duration: 0.5, delay },
        };
      case 'stagger':
        return {
          initial: { opacity: 0 },
          animate: inView ? { opacity: 1 } : { opacity: 0 },
          transition: { duration: 0.4, delay },
        };
      default:
        return {
          initial: { opacity: 0 },
          animate: inView ? { opacity: 1 } : { opacity: 0 },
          transition: { duration: 0.6, delay },
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

