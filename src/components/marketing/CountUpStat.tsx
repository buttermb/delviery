import { motion, useInView, useMotionValue, useTransform, animate } from "framer-motion";
import { useEffect, useRef } from "react";
import type { LucideIcon } from "lucide-react";

interface CountUpStatProps {
  icon: LucideIcon;
  value: string;
  label: string;
  delay?: number;
}

export function CountUpStat({ icon: Icon, value, label, delay = 0 }: CountUpStatProps) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });
  const count = useMotionValue(0);
  
  // Extract numeric value from string (e.g., "400+" -> 400, "$1.4M" -> 1.4)
  const numericValue = parseFloat(value.replace(/[^0-9.]/g, "")) || 0;
  const suffix = value.match(/[+MKk%]/)?.[0] || "";
  const prefix = value.match(/^\$/)?.[0] || "";
  
  const displayValue = useTransform(count, (latest) => {
    if (suffix === "M") {
      return `${prefix}${latest.toFixed(1)}${suffix}`;
    } else if (suffix === "K" || suffix === "k") {
      return `${prefix}${Math.round(latest)}${suffix}`;
    } else {
      return `${prefix}${Math.round(latest)}${suffix}`;
    }
  });

  useEffect(() => {
    if (isInView) {
      const controls = animate(count, numericValue, {
        duration: 2,
        delay,
        ease: "easeOut",
      });
      return controls.stop;
    }
  }, [isInView, numericValue, delay, count]);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay }}
      className="text-center group"
    >
      {/* Icon with bounce */}
      <motion.div
        initial={{ scale: 0, rotate: -180 }}
        animate={isInView ? { scale: 1, rotate: 0 } : {}}
        transition={{ 
          duration: 0.6, 
          delay: delay + 0.2,
          type: "spring",
          stiffness: 200
        }}
        className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[hsl(var(--marketing-primary))]/10 mb-4 group-hover:bg-[hsl(var(--marketing-primary))]/20 transition-colors"
      >
        <Icon className="w-8 h-8 text-[hsl(var(--marketing-primary))]" />
      </motion.div>

      {/* Animated Number */}
      <motion.div 
        className="text-5xl md:text-6xl font-bold mb-2"
        initial={{ scale: 0.5 }}
        animate={isInView ? { scale: 1 } : {}}
        transition={{ duration: 0.5, delay: delay + 0.3 }}
      >
        <motion.span
          className="bg-gradient-to-r from-[hsl(var(--marketing-primary))] to-[hsl(var(--marketing-accent))] bg-clip-text text-transparent"
        >
          {displayValue}
        </motion.span>
      </motion.div>

      {/* Label */}
      <motion.p 
        className="text-lg text-muted-foreground"
        initial={{ opacity: 0 }}
        animate={isInView ? { opacity: 1 } : {}}
        transition={{ delay: delay + 0.5 }}
      >
        {label}
      </motion.p>

      {/* Glow effect on completion */}
      <motion.div
        className="absolute inset-0 rounded-2xl pointer-events-none"
        initial={{ opacity: 0 }}
        animate={isInView ? { 
          opacity: [0, 0.3, 0],
          scale: [0.8, 1.2, 0.8]
        } : {}}
        transition={{ 
          duration: 1, 
          delay: delay + 2,
          ease: "easeOut"
        }}
        style={{
          background: "radial-gradient(circle, hsl(var(--marketing-primary)) 0%, transparent 70%)",
          filter: "blur(20px)"
        }}
      />
    </motion.div>
  );
}
