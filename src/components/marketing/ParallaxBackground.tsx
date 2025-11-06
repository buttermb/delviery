import { motion, useScroll, useTransform } from 'framer-motion';
import { useRef } from 'react';

export function ParallaxBackground() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end start'],
  });

  const y1 = useTransform(scrollYProgress, [0, 1], ['0%', '100%']);
  const y2 = useTransform(scrollYProgress, [0, 1], ['0%', '50%']);
  const y3 = useTransform(scrollYProgress, [0, 1], ['0%', '25%']);
  const opacity = useTransform(scrollYProgress, [0, 0.5, 1], [0.6, 0.3, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], [1, 1.5]);

  return (
    <div ref={ref} className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Gradient orbs */}
      <motion.div
        className="absolute top-[10%] left-[10%] w-[500px] h-[500px] rounded-full bg-gradient-to-br from-[hsl(var(--marketing-primary))]/20 to-[hsl(var(--marketing-accent))]/10 blur-3xl"
        style={{ y: y1, opacity, scale }}
      />
      
      <motion.div
        className="absolute top-[40%] right-[15%] w-[400px] h-[400px] rounded-full bg-gradient-to-br from-[hsl(var(--marketing-accent))]/20 to-[hsl(var(--marketing-secondary))]/10 blur-3xl"
        style={{ y: y2, opacity }}
      />

      <motion.div
        className="absolute bottom-[20%] left-[20%] w-[600px] h-[600px] rounded-full bg-gradient-to-br from-[hsl(var(--marketing-secondary))]/15 to-[hsl(var(--marketing-primary))]/10 blur-3xl"
        style={{ y: y3, opacity }}
      />

      {/* Floating shapes */}
      {[...Array(20)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-2 h-2 rounded-full bg-[hsl(var(--marketing-accent))]/20"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
          }}
          animate={{
            y: [0, -30, 0],
            x: [0, Math.random() * 20 - 10, 0],
            opacity: [0.2, 0.5, 0.2],
          }}
          transition={{
            duration: 3 + Math.random() * 2,
            repeat: Infinity,
            delay: Math.random() * 2,
            ease: 'easeInOut',
          }}
        />
      ))}

      {/* Grid pattern */}
      <motion.div
        className="absolute inset-0 opacity-5"
        style={{ y: y3 }}
      >
        <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="parallax-grid" width="50" height="50" patternUnits="userSpaceOnUse">
              <circle cx="25" cy="25" r="1" fill="currentColor" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#parallax-grid)" />
        </svg>
      </motion.div>

      {/* Animated lines */}
      <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="line-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="hsl(var(--marketing-primary))" stopOpacity="0.1" />
            <stop offset="100%" stopColor="hsl(var(--marketing-accent))" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[...Array(5)].map((_, i) => (
          <motion.path
            key={i}
            d={`M 0,${100 + i * 150} Q ${250 + i * 50},${50 + i * 100} ${500 + i * 100},${100 + i * 150}`}
            stroke="url(#line-gradient)"
            strokeWidth="2"
            fill="none"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 0.3 }}
            transition={{
              duration: 2,
              delay: i * 0.2,
              repeat: Infinity,
              repeatType: 'reverse',
            }}
          />
        ))}
      </svg>
    </div>
  );
}
