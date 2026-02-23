/**
 * ForceLightMode Component
 * 
 * Wraps marketing pages to ensure they always render in light mode,
 * regardless of user's system preference or app theme setting.
 * 
 * This prevents color inconsistencies when users have dark mode enabled
 * on their device but the marketing site is designed for light mode only.
 */

import { useLayoutEffect } from 'react';

interface ForceLightModeProps {
    children: React.ReactNode;
}

export function ForceLightMode({ children }: ForceLightModeProps) {
    useLayoutEffect(() => {
        // Store original theme class
        const root = document.documentElement;
        const originalTheme = root.classList.contains('dark') ? 'dark' : 'light';

        // Force light mode
        root.classList.remove('dark');
        root.classList.add('light');

        // Restore original theme on unmount
        return () => {
            root.classList.remove('light', 'dark');
            root.classList.add(originalTheme);
        };
    }, []);

    return <>{children}</>;
}

export default ForceLightMode;
