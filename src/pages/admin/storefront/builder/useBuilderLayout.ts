/**
 * useBuilderLayout
 * Responsive layout hook that detects viewport breakpoints and adjusts
 * the builder UI accordingly (panel visibility, drawer mode, etc.)
 */

import { useState, useEffect, useCallback } from 'react';

export type BuilderBreakpoint = 'mobile' | 'tablet' | 'desktop';

interface UseBuilderLayoutReturn {
    breakpoint: BuilderBreakpoint;
    isMobile: boolean;
    isTablet: boolean;
    isDesktop: boolean;
    leftPanelOpen: boolean;
    setLeftPanelOpen: (open: boolean) => void;
    rightPanelOpen: boolean;
    setRightPanelOpen: (open: boolean) => void;
    useDrawerMode: boolean;
}

export function useBuilderLayout(): UseBuilderLayoutReturn {
    const getBreakpoint = (): BuilderBreakpoint => {
        if (typeof window === 'undefined') return 'desktop';
        const width = window.innerWidth;
        if (width < 768) return 'mobile';
        if (width < 1024) return 'tablet';
        return 'desktop';
    };

    const [breakpoint, setBreakpoint] = useState<BuilderBreakpoint>(getBreakpoint);
    const [leftPanelOpen, setLeftPanelOpen] = useState(true);
    const [rightPanelOpen, setRightPanelOpen] = useState(true);

    useEffect(() => {
        const handleResize = () => {
            const newBreakpoint = getBreakpoint();
            setBreakpoint(newBreakpoint);

            // Auto-collapse panels on smaller screens
            if (newBreakpoint === 'mobile') {
                setLeftPanelOpen(false);
                setRightPanelOpen(false);
            } else if (newBreakpoint === 'tablet') {
                setLeftPanelOpen(true);
                setRightPanelOpen(false);
            } else {
                setLeftPanelOpen(true);
                setRightPanelOpen(true);
            }
        };

        window.addEventListener('resize', handleResize);
        // Set initial state
        handleResize();
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    return {
        breakpoint,
        isMobile: breakpoint === 'mobile',
        isTablet: breakpoint === 'tablet',
        isDesktop: breakpoint === 'desktop',
        leftPanelOpen,
        setLeftPanelOpen,
        rightPanelOpen,
        setRightPanelOpen,
        useDrawerMode: breakpoint === 'mobile',
    };
}
