/**
 * Scroll Progress Bar
 * Premium scroll progress indicator for product pages
 */

import { useState, useEffect } from 'react';
import { motion, useScroll, useSpring } from 'framer-motion';

interface ScrollProgressProps {
    color?: string;
    height?: number;
}

export function ScrollProgress({ color = '#10b981', height = 3 }: ScrollProgressProps) {
    const { scrollYProgress } = useScroll();
    const scaleX = useSpring(scrollYProgress, {
        stiffness: 100,
        damping: 30,
        restDelta: 0.001
    });

    return (
        <motion.div
            className="fixed top-0 left-0 right-0 z-50 origin-left"
            style={{
                scaleX,
                height,
                backgroundColor: color,
            }}
        />
    );
}
