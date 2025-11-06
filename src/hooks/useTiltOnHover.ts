import { useRef, MouseEvent } from 'react';
import { useMotionValue, useSpring } from 'framer-motion';

export function useTiltOnHover(strength = 10) {
  const ref = useRef<HTMLDivElement>(null);
  
  const rotateX = useMotionValue(0);
  const rotateY = useMotionValue(0);
  
  const rotateXSpring = useSpring(rotateX, { stiffness: 200, damping: 20 });
  const rotateYSpring = useSpring(rotateY, { stiffness: 200, damping: 20 });

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return;

    const rect = ref.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    const mouseX = e.clientX - centerX;
    const mouseY = e.clientY - centerY;
    
    const rotateXValue = (mouseY / (rect.height / 2)) * strength;
    const rotateYValue = (mouseX / (rect.width / 2)) * -strength;
    
    rotateX.set(rotateXValue);
    rotateY.set(rotateYValue);
  };

  const handleMouseLeave = () => {
    rotateX.set(0);
    rotateY.set(0);
  };

  return {
    ref,
    rotateX: rotateXSpring,
    rotateY: rotateYSpring,
    handleMouseMove,
    handleMouseLeave,
  };
}
