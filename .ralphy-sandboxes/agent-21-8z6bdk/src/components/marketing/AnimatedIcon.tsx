import { ReactNode, useState } from 'react';
import { motion, MotionProps } from 'framer-motion';

interface AnimatedIconProps {
  children: ReactNode;
  className?: string;
  animation?: 'spin' | 'bounce' | 'pulse' | 'morph' | 'glow';
  hover?: boolean;
  size?: number | string;
  color?: string;
}

export function AnimatedIcon({
  children,
  className = '',
  animation,
  hover = false,
  size = 24,
  color,
}: AnimatedIconProps) {
  const [isHovered, setIsHovered] = useState(false);

  const iconStyle: React.CSSProperties = {
    width: typeof size === 'number' ? `${size}px` : size,
    height: typeof size === 'number' ? `${size}px` : size,
    color: color,
  };

  const getAnimationProps = (): MotionProps => {
    switch (animation) {
      case 'spin':
        return {
          animate: isHovered || !hover ? { rotate: 360 } : {},
          transition: { duration: 1, repeat: Infinity, ease: 'linear' },
        };
      case 'bounce':
        return {
          animate: isHovered || !hover ? { y: [0, -8, 0] } : {},
          transition: { duration: 0.6, repeat: Infinity },
        };
      case 'pulse':
        return {
          animate: isHovered || !hover ? { scale: [1, 1.2, 1] } : {},
          transition: { duration: 1.5, repeat: Infinity },
        };
      case 'morph':
        return {
          animate: isHovered ? { scale: 1.1, rotate: 5 } : { scale: 1, rotate: 0 },
          transition: { duration: 0.3 },
        };
      case 'glow':
        return {
          animate: isHovered
            ? {
                filter: 'drop-shadow(0 0 8px currentColor)',
                scale: 1.1,
              }
            : {
                filter: 'drop-shadow(0 0 0px currentColor)',
                scale: 1,
              },
          transition: { duration: 0.3 },
        };
      default:
        return {
          animate: isHovered ? { scale: 1.1 } : { scale: 1 },
          transition: { duration: 0.2 },
        };
    }
  };

  return (
    <motion.div
      style={iconStyle}
      className={className}
      onMouseEnter={() => hover && setIsHovered(true)}
      onMouseLeave={() => hover && setIsHovered(false)}
      {...getAnimationProps()}
    >
      {children}
    </motion.div>
  );
}

