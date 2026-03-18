/**
 * Autosave Hook for Storefront Builder
 * Triggers a save draft mutation automatically after a period of inactivity
 * or when specific high-value actions occur.
 */

import { useEffect, useRef } from 'react';
import { type StorefrontSection, type ThemeConfig } from './storefront-builder.config';

interface UseBuilderAutosaveProps {
    layoutConfig: StorefrontSection[];
    themeConfig: ThemeConfig;
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
    delayMs = 5000
}: UseBuilderAutosaveProps) {
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    const isFirstRender = useRef(true);
    // Use refs for values that shouldn't trigger the effect
    const saveDraftRef = useRef(saveDraft);
    const isSavingRef = useRef(isSaving);
    const enabledRef = useRef(enabled);
    const delayMsRef = useRef(delayMs);

    // Keep refs in sync
    saveDraftRef.current = saveDraft;
    isSavingRef.current = isSaving;
    enabledRef.current = enabled;
    delayMsRef.current = delayMs;

    useEffect(() => {
        // Skip on initial mount
        if (isFirstRender.current) {
            isFirstRender.current = false;
            return;
        }

        if (!enabledRef.current) return;

        // Clear existing timeout
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        // Set new autosave timer
        timeoutRef.current = setTimeout(() => {
            if (!isSavingRef.current) {
                saveDraftRef.current();
            }
        }, delayMsRef.current);

        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, [layoutConfig, themeConfig]);
}
