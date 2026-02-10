import { useEffect, useState } from "react";
import { motion, useMotionValue, useTransform } from "framer-motion";

interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  duration: number;
  delay: number;
}

export function ParticleBackground() {
  const [particles, setParticles] = useState<Particle[]>([]);
  const [isMobile, setIsMobile] = useState(false);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  // Check for mobile and reduced motion preference
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    
    checkMobile();
    window.addEventListener('resize', checkMobile);

    // Don't render particles on mobile or if user prefers reduced motion
    if (prefersReducedMotion || window.innerWidth < 768) {
      return;
    }

    // Generate particles
    const particleCount = 20;
    const newParticles: Particle[] = [];
    
    for (let i = 0; i < particleCount; i++) {
      newParticles.push({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: Math.random() * 4 + 2,
        duration: Math.random() * 7 + 8,
        delay: Math.random() * 5,
      });
    }
    
    setParticles(newParticles);

    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Track mouse movement for parallax effect
  useEffect(() => {
    if (isMobile) return;

    const handleMouseMove = (e: MouseEvent) => {
      mouseX.set(e.clientX);
      mouseY.set(e.clientY);
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [isMobile, mouseX, mouseY]);

  // Create transforms ONCE outside of map to avoid hook violations
  const parallaxX = useTransform(
    mouseX, 
    [0, typeof window !== 'undefined' ? window.innerWidth : 1920], 
    [-10, 10]
  );
  const parallaxY = useTransform(
    mouseY, 
    [0, typeof window !== 'undefined' ? window.innerHeight : 1080], 
    [-10, 10]
  );

  if (isMobile || particles.length === 0) {
    return null;
  }

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ willChange: 'auto' }}>
      {particles.map((particle) => (
        <motion.div
          key={particle.id}
          className="absolute rounded-full"
          style={{
            left: `${particle.x}%`,
            top: `${particle.y}%`,
            width: particle.size,
            height: particle.size,
            background: 'rgba(255, 255, 255, 0.3)',
            x: parallaxX,
            y: parallaxY,
            willChange: 'transform, opacity',
            backfaceVisibility: 'hidden',
            transform: 'translate3d(0, 0, 0)',
          }}
          animate={{
            y: [0, -20, -10, -30, 0],
            x: [0, 10, -10, 5, 0],
            opacity: [0.3, 0.5, 0.4, 0.6, 0.3],
          }}
          transition={{
            duration: particle.duration,
            delay: particle.delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}
