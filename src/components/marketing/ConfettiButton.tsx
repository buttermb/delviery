import { ReactNode, MouseEvent } from 'react';
import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import { Button } from '@/components/ui/button';

interface ConfettiButtonProps {
  children: ReactNode;
  variant?: 'default' | 'outline' | 'ghost' | 'destructive' | 'secondary';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
  onClick?: () => void;
  confettiConfig?: {
    particleCount?: number;
    spread?: number;
    colors?: string[];
  };
}

export function ConfettiButton({
  children,
  variant = 'default',
  size = 'default',
  className = '',
  onClick,
  confettiConfig = {},
}: ConfettiButtonProps) {
  const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (rect.left + rect.width / 2) / window.innerWidth;
    const y = (rect.top + rect.height / 2) / window.innerHeight;

    const {
      particleCount = 100,
      spread = 70,
      colors = [
        'hsl(var(--marketing-primary))',
        'hsl(var(--marketing-secondary))',
        'hsl(var(--marketing-accent))',
        'hsl(var(--primary))'
      ],
    } = confettiConfig;

    confetti({
      particleCount,
      spread,
      origin: { x, y },
      colors,
      ticks: 200,
      gravity: 1,
      decay: 0.94,
      startVelocity: 30,
      shapes: ['circle', 'square'],
      scalar: 1.2,
    });

    onClick?.();
  };

  return (
    <motion.div
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 400, damping: 20 }}
    >
      <Button
        variant={variant}
        size={size}
        className={className}
        onClick={handleClick}
      >
        {children}
      </Button>
    </motion.div>
  );
}
