import { useRef, MouseEvent } from 'react';
import { motion, AnimatePresence, useMotionValue, useSpring, MotionValue } from 'framer-motion';

interface Capability {
  id: number;
  title: string;
  description: string;
  icon: string;
  metrics: string;
}

interface Rotatable3DCardProps {
  activeCapability: number;
  capability: Capability;
  opacity: MotionValue<number>;
  scale: MotionValue<number>;
}

export function Rotatable3DCard({ activeCapability, capability, opacity, scale }: Rotatable3DCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  
  const rotateX = useMotionValue(0);
  const rotateY = useMotionValue(0);
  
  const rotateXSpring = useSpring(rotateX, { stiffness: 200, damping: 20 });
  const rotateYSpring = useSpring(rotateY, { stiffness: 200, damping: 20 });

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;

    const rect = cardRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    const mouseX = e.clientX - centerX;
    const mouseY = e.clientY - centerY;
    
    const rotateXValue = (mouseY / (rect.height / 2)) * -10;
    const rotateYValue = (mouseX / (rect.width / 2)) * 10;
    
    rotateX.set(rotateXValue);
    rotateY.set(rotateYValue);
  };

  const handleMouseLeave = () => {
    rotateX.set(0);
    rotateY.set(0);
  };

  return (
    <motion.div
      className="lg:sticky lg:top-24 perspective-1000"
      style={{ opacity, scale }}
    >
      <motion.div
        ref={cardRef}
        className="glass-card p-8 rounded-xl border border-border cursor-pointer"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{
          rotateX: rotateXSpring,
          rotateY: rotateYSpring,
          transformStyle: 'preserve-3d',
        }}
        whileHover={{ scale: 1.02 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={activeCapability}
            initial={{ opacity: 0, rotateY: 90 }}
            animate={{ opacity: 1, rotateY: 0 }}
            exit={{ opacity: 0, rotateY: -90 }}
            transition={{ duration: 0.4, type: 'spring', stiffness: 200 }}
          >
            <div className="text-center mb-6">
              <motion.div 
                className="text-6xl mb-4"
                animate={{ 
                  scale: [1, 1.1, 1],
                  rotate: [0, 5, -5, 0]
                }}
                transition={{ 
                  duration: 3,
                  repeat: Infinity,
                  repeatType: 'reverse'
                }}
              >
                {capability.icon}
              </motion.div>
              <h3 className="text-2xl font-bold text-foreground mb-2">
                {capability.title}
              </h3>
              <p className="text-muted-foreground mb-4">
                {capability.description}
              </p>
              <motion.div 
                className="inline-block px-4 py-2 rounded-full bg-gradient-to-r from-[hsl(var(--marketing-primary))] to-[hsl(var(--marketing-accent))] text-white font-semibold"
                whileHover={{ scale: 1.05 }}
              >
                {capability.metrics}
              </motion.div>
            </div>

            {/* 3D Interactive Preview */}
            <motion.div 
              className="aspect-video rounded-lg bg-gradient-to-br from-[hsl(var(--marketing-primary))]/20 to-[hsl(var(--marketing-accent))]/20 flex items-center justify-center border border-border relative overflow-hidden"
              style={{
                transform: 'translateZ(20px)',
              }}
            >
              {/* Animated background grid */}
              <div className="absolute inset-0 opacity-10">
                <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
                  <defs>
                    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                      <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="1"/>
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#grid)" />
                </svg>
              </div>
              
              {/* Content */}
              <div className="text-center z-10">
                <motion.div 
                  className="text-5xl mb-3"
                  animate={{ 
                    y: [0, -10, 0],
                  }}
                  transition={{ 
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                >
                  {capability.icon}
                </motion.div>
                <p className="text-muted-foreground font-medium">3D Interactive Preview</p>
                <p className="text-xs text-muted-foreground/70 mt-1">Hover to interact</p>
              </div>

              {/* Floating particles */}
              {[...Array(5)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute w-2 h-2 rounded-full bg-[hsl(var(--marketing-accent))]/30"
                  initial={{
                    x: Math.random() * 100 + '%',
                    y: Math.random() * 100 + '%',
                  }}
                  animate={{
                    x: [
                      Math.random() * 100 + '%',
                      Math.random() * 100 + '%',
                      Math.random() * 100 + '%',
                    ],
                    y: [
                      Math.random() * 100 + '%',
                      Math.random() * 100 + '%',
                      Math.random() * 100 + '%',
                    ],
                  }}
                  transition={{
                    duration: 10 + i * 2,
                    repeat: Infinity,
                    ease: "linear",
                  }}
                />
              ))}
            </motion.div>
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}
