import { useEffect, useState } from "react";

interface StatCardProps {
  value: string | number;
  label: string;
  animate?: boolean;
}

export function StatCard({ value, label, animate = true }: StatCardProps) {
  const [displayValue, setDisplayValue] = useState(animate ? 0 : value);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isVisible) {
          setIsVisible(true);
        }
      },
      { threshold: 0.1 }
    );

    const element = document.getElementById(`stat-${label}`);
    if (element) {
      observer.observe(element);
    }

    return () => {
      if (element) observer.unobserve(element);
    };
  }, [label, isVisible]);

  useEffect(() => {
    if (!animate || !isVisible) return;

    const numericValue = typeof value === "number" ? value : parseInt(value.toString().replace(/[^0-9]/g, ""));
    if (isNaN(numericValue)) {
      setDisplayValue(value);
      return;
    }

    const duration = 2000;
    const steps = 60;
    const increment = numericValue / steps;
    const stepDuration = duration / steps;

    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= numericValue) {
        setDisplayValue(numericValue);
        clearInterval(timer);
      } else {
        setDisplayValue(Math.floor(current));
      }
    }, stepDuration);

    return () => clearInterval(timer);
  }, [value, animate, isVisible]);

  const formatValue = (val: string | number) => {
    if (typeof val === "number") {
      if (val >= 1000000) return `$${(val / 1000000).toFixed(1)}M`;
      if (val >= 1000) return `${(val / 1000).toFixed(0)}k`;
      return val.toString();
    }
    return val;
  };

  return (
    <div id={`stat-${label}`} className="text-center">
      <div className="text-5xl md:text-6xl font-bold text-[hsl(var(--marketing-primary))] mb-2">
        {formatValue(displayValue)}{typeof value === "string" && value.includes("+") ? "+" : ""}
        {typeof value === "string" && value.includes("%") ? "%" : ""}
        {typeof value === "string" && value.includes("/") ? "/" : ""}
      </div>
      <div className="text-lg text-[hsl(var(--marketing-text-light))]">{label}</div>
    </div>
  );
}

