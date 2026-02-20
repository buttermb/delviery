import { motion, useInView, useMotionValue, useTransform, animate } from "framer-motion";
import { useEffect, useRef } from "react";

interface CountUpNumberProps {
  end: number;
  duration?: number;
  decimals?: number;
}

export function CountUpNumber({ end, duration = 2000, decimals = 0 }: CountUpNumberProps) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });
  const count = useMotionValue(0);
  const display = useTransform(count, (v) => v.toFixed(decimals));

  useEffect(() => {
    if (isInView) {
      const controls = animate(count, end, {
        duration: duration / 1000,
        ease: "easeOut",
      });
      return controls.stop;
    }
  }, [isInView, end, duration, count]);

  return <motion.span ref={ref}>{display}</motion.span>;
}
