/**
 * Sidebar Mode Hook
 * 
 * Simple hook to toggle between Classic (AdaptiveSidebar) and Optimized sidebar modes.
 * Uses localStorage for persistence.
 */

import { useState, useCallback } from 'react';
import { STORAGE_KEYS } from '@/constants/storageKeys';

export type SidebarMode = 'classic' | 'optimized';

export function useSidebarMode() {
    const [mode, setModeState] = useState<SidebarMode>(() => {
        if (typeof window !== 'undefined') {
            const stored = localStorage.getItem(STORAGE_KEYS.SIDEBAR_MODE);
            return (stored as SidebarMode) || 'classic';
        }
        return 'classic';
    });

    const setMode = useCallback((newMode: SidebarMode) => {
        setModeState(newMode);
        localStorage.setItem(STORAGE_KEYS.SIDEBAR_MODE, newMode);
    }, []);

    const toggleMode = useCallback(() => {
        setMode(mode === 'classic' ? 'optimized' : 'classic');
    }, [mode, setMode]);

    return {
        mode,
        setMode,
        toggleMode,
        isOptimized: mode === 'optimized',
        isClassic: mode === 'classic',
    };
}

export { useSidebarMode as default };
