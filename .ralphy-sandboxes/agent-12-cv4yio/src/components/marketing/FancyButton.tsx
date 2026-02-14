import React, { useState, useRef, MouseEvent } from 'react';
import { motion, useMotionValue, useSpring } from 'framer-motion';
import { ArrowRight, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FancyButtonProps {
  variant?: 'primary' | 'secondary' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  magnetic?: boolean;
  glow?: boolean;
  loading?: boolean;
  children: React.ReactNode;
  showArrow?: boolean;
  className?: string;
  disabled?: boolean;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  type?: 'button' | 'submit' | 'reset';
}

export function FancyButton({
  variant = 'primary',
  size = 'md',
  magnetic = true,
  glow = false,
  loading = false,
  children,
  showArrow = true,
  className,
  disabled,
  onClick,
  type = 'button',
}: FancyButtonProps) {
  const [ripples, setRipples] = useState<Array<{ id: number; x: number; y: number }>>([]);
  const [isHovered, setIsHovered] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Magnetic effect
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springConfig = { damping: 25, stiffness: 300 };
  const xSpring = useSpring(x, springConfig);
  const ySpring = useSpring(y, springConfig);

  const handleMouseMove = (e: MouseEvent<HTMLButtonElement>) => {
    if (!magnetic || !buttonRef.current || disabled || loading) return;

    const rect = buttonRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const distanceX = e.clientX - centerX;
    const distanceY = e.clientY - centerY;

    const maxDistance = 30;
    const moveX = Math.max(-maxDistance, Math.min(maxDistance, distanceX * 0.15));
    const moveY = Math.max(-maxDistance, Math.min(maxDistance, distanceY * 0.15));

    x.set(moveX);
    y.set(moveY);
  };

  const handleMouseLeave = () => {
    if (magnetic) {
      x.set(0);
      y.set(0);
    }
    setIsHovered(false);
  };

  const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
    if (disabled || loading) return;

    // Ripple effect
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) {
      const rippleX = e.clientX - rect.left;
      const rippleY = e.clientY - rect.top;
      const newRipple = { id: Date.now(), x: rippleX, y: rippleY };
      setRipples((prev) => [...prev, newRipple]);
      setTimeout(() => {
        setRipples((prev) => prev.filter((r) => r.id !== newRipple.id));
      }, 600);
    }

    onClick?.(e);
  };

  const baseStyles = 'relative inline-flex items-center justify-center gap-2 font-semibold transition-all duration-300 overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50';

  const variantStyles = {
    primary: 'bg-gradient-to-r from-[hsl(var(--marketing-primary))] via-[hsl(var(--marketing-primary))]/90 to-[hsl(var(--marketing-accent))] text-white hover:from-[hsl(var(--marketing-primary))]/90 hover:via-[hsl(var(--marketing-primary))] hover:to-[hsl(var(--marketing-accent))] shadow-lg hover:shadow-xl',
    secondary: 'bg-[hsl(var(--marketing-bg))] text-[hsl(var(--marketing-primary))] border-2 border-[hsl(var(--marketing-primary))] hover:bg-[hsl(var(--marketing-primary))] hover:text-white shadow-md hover:shadow-lg',
    ghost: 'bg-transparent text-[hsl(var(--marketing-primary))] hover:bg-[hsl(var(--marketing-primary))]/10',
    outline: 'border-2 border-[hsl(var(--marketing-border))] bg-transparent text-[hsl(var(--marketing-text))] hover:border-[hsl(var(--marketing-primary))] hover:bg-[hsl(var(--marketing-primary))]/10 hover:text-[hsl(var(--marketing-primary))]',
  };

  const sizeStyles = {
    sm: 'h-10 px-4 text-sm rounded-lg',
    md: 'h-12 px-6 text-base rounded-lg',
    lg: 'h-14 px-8 text-lg rounded-xl',
  };

  const glowStyles = glow && isHovered
    ? 'shadow-[0_0_20px_rgba(37,99,235,0.5),0_0_40px_rgba(37,99,235,0.3)]'
    : '';

  return (
    <motion.button
      ref={buttonRef}
      className={cn(
        baseStyles,
        variantStyles[variant],
        sizeStyles[size],
        glowStyles,
        className
      )}
      style={{
        x: magnetic ? xSpring : 0,
        y: magnetic ? ySpring : 0,
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onMouseEnter={() => setIsHovered(true)}
      onClick={handleClick}
      disabled={disabled || loading}
      type={type}
      whileHover={!disabled && !loading ? { scale: 1.02 } : {}}
      whileTap={!disabled && !loading ? { scale: 0.98 } : {}}
    >
      {/* Gradient overlay on hover */}
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-white/20 via-transparent to-white/20"
        initial={{ x: '-100%' }}
        animate={isHovered ? { x: '100%' } : { x: '-100%' }}
        transition={{ duration: 0.6, ease: 'easeInOut' }}
      />

      {/* Ripple effects */}
      {ripples.map((ripple) => (
        <motion.span
          key={ripple.id}
          className="absolute rounded-full bg-white/30 pointer-events-none"
          style={{
            left: ripple.x,
            top: ripple.y,
            width: 0,
            height: 0,
          }}
          animate={{
            width: 200,
            height: 200,
            x: -100,
            y: -100,
            opacity: [0.5, 0],
          }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      ))}

      {/* Content */}
      <span className="relative z-10 flex items-center gap-2">
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          children
        )}
        {showArrow && !loading && (
          <motion.span
            animate={isHovered ? { x: 4 } : { x: 0 }}
            transition={{ duration: 0.2 }}
          >
            <ArrowRight className="h-4 w-4" />
          </motion.span>
        )}
      </span>

      {/* Glow pulse effect */}
      {glow && isHovered && (
        <motion.div
          className="absolute inset-0 rounded-lg"
          style={{
            boxShadow: '0 0 20px rgba(37, 99, 235, 0.5), 0 0 40px rgba(37, 99, 235, 0.3)',
          }}
          animate={{
            opacity: [0.5, 1, 0.5],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      )}
    </motion.button>
  );
}

