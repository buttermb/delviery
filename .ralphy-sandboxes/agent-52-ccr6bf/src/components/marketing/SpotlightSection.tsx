import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

interface SpotlightSectionProps {
  children: React.ReactNode;
  className?: string;
}

export function SpotlightSection({ children, className = "" }: SpotlightSectionProps) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile('ontouchstart' in window || navigator.maxTouchPoints > 0);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);

    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (isMobile || !sectionRef.current) return;

    const section = sectionRef.current;
    let animationFrameId: number;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = section.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // Throttle updates using requestAnimationFrame
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }

      animationFrameId = requestAnimationFrame(() => {
        setMousePosition({ x, y });
      });
    };

    section.addEventListener('mousemove', handleMouseMove);

    return () => {
      section.removeEventListener('mousemove', handleMouseMove);
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [isMobile]);

  return (
    <motion.section
      ref={sectionRef}
      className={`relative overflow-hidden ${className}`}
      style={{
        background: isMobile
          ? 'linear-gradient(135deg, hsl(var(--marketing-primary)), hsl(var(--marketing-secondary)))'
          : undefined,
      }}
    >
      {!isMobile && (
        <div
          className="absolute inset-0 pointer-events-none transition-opacity duration-300"
          style={{
            background: `radial-gradient(600px circle at ${mousePosition.x}px ${mousePosition.y}px, 
              hsl(var(--marketing-primary) / 0.15), 
              hsl(var(--marketing-secondary) / 0.1) 40%, 
              hsl(var(--marketing-primary) / 0.05) 80%, 
              transparent)`,
          }}
        />
      )}

      {/* Dark base gradient */}
      {/* Gradient removed for cleaner aesthetic */}

      {/* Content */}
      <div className="relative z-10">
        {children}
      </div>
    </motion.section>
  );
}
