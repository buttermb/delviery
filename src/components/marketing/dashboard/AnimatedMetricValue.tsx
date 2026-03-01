import { useEffect, useState, useRef } from 'react';
import { useInView } from 'framer-motion';

interface AnimatedMetricValueProps {
  value: string;
  duration?: number;
  delay?: number;
}

export function AnimatedMetricValue({ value, duration = 2, delay = 0 }: AnimatedMetricValueProps) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });
  const [displayValue, setDisplayValue] = useState('0');

  useEffect(() => {
    if (!isInView) return;

    // Extract numeric value and prefix/suffix
    const numericMatch = value.match(/[\d,]+\.?\d*/);
    if (!numericMatch) {
      setDisplayValue(value);
      return;
    }

    const prefix = value.substring(0, numericMatch.index);
    const suffix = value.substring((numericMatch.index || 0) + numericMatch[0].length);
    const targetValue = parseFloat(numericMatch[0].replace(/,/g, ''));

    const startTime = Date.now() + (delay * 1000);
    const endTime = startTime + (duration * 1000);

    const animate = () => {
      const now = Date.now();
      
      if (now < startTime) {
        requestAnimationFrame(animate);
        return;
      }

      if (now >= endTime) {
        setDisplayValue(value);
        return;
      }

      const progress = (now - startTime) / (duration * 1000);
      const easedProgress = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      const currentValue = targetValue * easedProgress;

      // Format with commas and decimals if needed
      let formatted = currentValue.toFixed(value.includes('.') ? 1 : 0);
      formatted = formatted.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      
      setDisplayValue(prefix + formatted + suffix);
      requestAnimationFrame(animate);
    };

    requestAnimationFrame(animate);
  }, [isInView, value, duration, delay]);

  return (
    <span ref={ref} className="tabular-nums">
      {displayValue}
    </span>
  );
}
