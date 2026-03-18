/**
 * Autosave Hook for Storefront Builder
 * Triggers a save draft mutation automatically after a period of inactivity
 * or when specific high-value actions occur.
 */

import { useEffect, useRef } from 'react';

interface UseBuilderAutosaveProps {
    layoutConfig: any;
    themeConfig: any;
    saveDraft: () => void;
    isSaving: boolean;
    enabled: boolean;
    delayMs?: number;
}

export function useBuilderAutosave({
    layoutConfig,
    themeConfig,
    saveDraft,
    isSaving,
    enabled,
    delayMs = 5000 // 5 seconds default
}: UseBuilderAutosaveProps) {
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    const isFirstRender = useRef(true);

    useEffect(() => {
        // Skip on initial mount
        if (isFirstRender.current) {
            isFirstRender.current = false;
            return;
        }

        if (!enabled) return;

        // Clear existing timeout
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        // Set new autosave timer
        timeoutRef.current = setTimeout(() => {
            if (!isSaving) {
                saveDraft();
            }
        }, delayMs);

        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, [layoutConfig, themeConfig]); // Re-run when config changes
}
