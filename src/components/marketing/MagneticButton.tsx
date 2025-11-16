import { useRef, MouseEvent, ReactNode } from 'react';
import { motion, useMotionValue, useSpring } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface MagneticButtonProps {
  children: ReactNode;
  className?: string;
  variant?: 'default' | 'outline' | 'ghost' | 'destructive' | 'secondary';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  onClick?: () => void;
  disabled?: boolean;
  strength?: number;
}

export function MagneticButton({
  children,
  className,
  variant = 'default',
  size = 'default',
  onClick,
  disabled = false,
  strength = 0.15,
}: MagneticButtonProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Magnetic effect
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springConfig = { damping: 20, stiffness: 300, mass: 0.5 };
  const xSpring = useSpring(x, springConfig);
  const ySpring = useSpring(y, springConfig);

  const handleMouseMove = (e: MouseEvent<HTMLButtonElement>) => {
    if (!buttonRef.current || disabled) return;

    const rect = buttonRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const distanceX = e.clientX - centerX;
    const distanceY = e.clientY - centerY;

    const maxDistance = 25;
    const moveX = Math.max(-maxDistance, Math.min(maxDistance, distanceX * strength));
    const moveY = Math.max(-maxDistance, Math.min(maxDistance, distanceY * strength));

    x.set(moveX);
    y.set(moveY);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div
      style={{
        x: xSpring,
        y: ySpring,
      }}
    >
      <Button
        ref={buttonRef}
        variant={variant}
        size={size}
        className={cn('transition-transform duration-200', className)}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={onClick}
        disabled={disabled}
      >
        {children}
      </Button>
    </motion.div>
  );
}
