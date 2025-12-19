import { motion } from 'framer-motion';
import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface AnimatedTextProps {
  children: ReactNode;
  className?: string;
  variant?: 'gradient' | 'wave' | 'highlight' | 'fade';
  delay?: number;
}

export function AnimatedText({ 
  children, 
  className = '', 
  variant = 'gradient',
  delay = 0 
}: AnimatedTextProps) {
  const text = typeof children === 'string' ? children : String(children);
  const chars = text.split('');

  if (variant === 'gradient') {
    return (
      <motion.span
        className={cn('gradient-text-primary', className)}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay }}
      >
        {children}
      </motion.span>
    );
  }

  if (variant === 'wave') {
    return (
      <span className={className}>
        {chars.map((char, index) => (
          <motion.span
            key={index}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.5,
              delay: delay + index * 0.05,
              ease: 'easeOut',
            }}
            style={{ display: 'inline-block' }}
          >
            {char === ' ' ? '\u00A0' : char}
          </motion.span>
        ))}
      </span>
    );
  }

  if (variant === 'highlight') {
    return (
      <motion.span
        className={cn('relative inline-block', className)}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay }}
        whileHover={{
          scale: 1.05,
        }}
      >
        <motion.span
          className="absolute inset-0 bg-[hsl(var(--marketing-primary))]/20 rounded"
          initial={{ scaleX: 0 }}
          whileInView={{ scaleX: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay }}
        />
        <span className="relative z-10">{children}</span>
      </motion.span>
    );
  }

  if (variant === 'fade') {
    return (
      <motion.span
        className={className}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay }}
      >
        {children}
      </motion.span>
    );
  }

  return <span className={className}>{children}</span>;
}

