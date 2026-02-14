/**
 * useMobileOptimized Hook
 * 
 * Enhanced mobile detection hook that provides multiple breakpoint checks
 * and accessibility preferences for optimized mobile experiences.
 */

import { useState, useEffect } from 'react';

const MOBILE_BREAKPOINT = 768;
const TABLET_BREAKPOINT = 1024;

export function useMobileOptimized() {
    const [isMobile, setIsMobile] = useState<boolean>(false);
    const [isTablet, setIsTablet] = useState<boolean>(false);
    const [prefersReducedMotion, setPrefersReducedMotion] = useState<boolean>(false);

    useEffect(() => {
        // Check initial values
        const checkBreakpoints = () => {
            const width = window.innerWidth;
            setIsMobile(width < MOBILE_BREAKPOINT);
            setIsTablet(width >= MOBILE_BREAKPOINT && width < TABLET_BREAKPOINT);
        };

        // Check reduced motion preference
        const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        setPrefersReducedMotion(motionQuery.matches);

        // Set up listeners
        const mobileQuery = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
        const tabletQuery = window.matchMedia(`(min-width: ${MOBILE_BREAKPOINT}px) and (max-width: ${TABLET_BREAKPOINT - 1}px)`);

        const handleMobileChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
        const handleTabletChange = (e: MediaQueryListEvent) => setIsTablet(e.matches);
        const handleMotionChange = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);

        mobileQuery.addEventListener('change', handleMobileChange);
        tabletQuery.addEventListener('change', handleTabletChange);
        motionQuery.addEventListener('change', handleMotionChange);

        // Initial check
        checkBreakpoints();

        return () => {
            mobileQuery.removeEventListener('change', handleMobileChange);
            tabletQuery.removeEventListener('change', handleTabletChange);
            motionQuery.removeEventListener('change', handleMotionChange);
        };
    }, []);

    return {
        isMobile,
        isTablet,
        isDesktop: !isMobile && !isTablet,
        prefersReducedMotion,
        // Use static fallback if mobile OR user prefers reduced motion
        shouldUseStaticFallback: isMobile || prefersReducedMotion,
        // For touch devices - shows tap hints instead of hover hints
        isTouchDevice: isMobile || isTablet,
    };
}

export default useMobileOptimized;
