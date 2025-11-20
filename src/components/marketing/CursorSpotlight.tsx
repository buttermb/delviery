import { useEffect, useState, RefObject } from 'react';
import { motion, useSpring, useMotionValue } from 'framer-motion';

interface CursorSpotlightProps {
    containerRef: RefObject<HTMLElement>;
}

export function CursorSpotlight({ containerRef }: CursorSpotlightProps) {
    const [isHovered, setIsHovered] = useState(false);
    const [opacity, setOpacity] = useState(0);

    const mouseX = useMotionValue(0);
    const mouseY = useMotionValue(0);

    const springConfig = { damping: 25, stiffness: 150, mass: 0.5 };
    const x = useSpring(mouseX, springConfig);
    const y = useSpring(mouseY, springConfig);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const handleMouseMove = (e: MouseEvent) => {
            const rect = container.getBoundingClientRect();
            const relativeX = e.clientX - rect.left;
            const relativeY = e.clientY - rect.top;

            mouseX.set(relativeX);
            mouseY.set(relativeY);
        };

        const handleMouseEnter = () => {
            setIsHovered(true);
            setOpacity(1);
        };

        const handleMouseLeave = () => {
            setIsHovered(false);
            setOpacity(0);
        };

        container.addEventListener('mousemove', handleMouseMove);
        container.addEventListener('mouseenter', handleMouseEnter);
        container.addEventListener('mouseleave', handleMouseLeave);

        return () => {
            container.removeEventListener('mousemove', handleMouseMove);
            container.removeEventListener('mouseenter', handleMouseEnter);
            container.removeEventListener('mouseleave', handleMouseLeave);
        };
    }, [containerRef, mouseX, mouseY]);

    return (
        <motion.div
            className="absolute top-0 left-0 w-[500px] h-[500px] rounded-full pointer-events-none z-0 mix-blend-screen"
            style={{
                x,
                y,
                translateX: '-50%',
                translateY: '-50%',
                background: 'radial-gradient(circle, rgba(16,185,129,0.15) 0%, rgba(52,211,153,0.05) 40%, transparent 70%)',
                opacity: opacity,
                transition: 'opacity 0.3s ease'
            }}
        />
    );
}
