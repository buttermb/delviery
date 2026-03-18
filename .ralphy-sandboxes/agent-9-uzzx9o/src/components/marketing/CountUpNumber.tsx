import { useEffect, useRef } from "react";
import { useInView, useMotionValue, animate } from "framer-motion";

interface CountUpNumberProps {
  end: number;
  duration?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
}

export function CountUpNumber({
  end,
  duration = 2000,
  decimals = 0,
  prefix = "",
  suffix = "",
}: CountUpNumberProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });
  const motionVal = useMotionValue(0);

  useEffect(() => {
    if (!isInView) return;

    const controls = animate(motionVal, end, {
      duration: duration / 1000,
      ease: "easeOut",
    });

    const unsubscribe = motionVal.on("change", (latest) => {
      if (ref.current) {
        ref.current.textContent = `${prefix}${latest.toFixed(decimals)}${suffix}`;
      }
    });

    return () => {
      controls.stop();
      unsubscribe();
    };
  }, [isInView, end, duration, decimals, prefix, suffix, motionVal]);

  return (
    <span ref={ref}>
      {prefix}0{suffix}
    </span>
  );
}
