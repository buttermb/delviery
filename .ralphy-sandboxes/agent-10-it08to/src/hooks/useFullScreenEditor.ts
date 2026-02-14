/**
 * useFullScreenEditor Hook
 * Manages full-screen state for the storefront editor with unsaved changes handling
 */

import { useState, useCallback, useEffect } from 'react';
import { logger } from '@/lib/logger';

interface UseFullScreenEditorOptions {
    onSave: () => Promise<void>;
    hasUnsavedChanges: boolean;
}

export function useFullScreenEditor({
    onSave,
    hasUnsavedChanges,
}: UseFullScreenEditorOptions) {
    const [isFullScreen, setIsFullScreen] = useState(false);
    const [showExitDialog, setShowExitDialog] = useState(false);
    const [isExiting, setIsExiting] = useState(false);

    const openFullScreen = useCallback(() => {
        setIsFullScreen(true);
        logger.info('storefront_editor_fullscreen_opened');
    }, []);

    const requestClose = useCallback(() => {
        if (hasUnsavedChanges) {
            setShowExitDialog(true);
        } else {
            setIsFullScreen(false);
            logger.info('storefront_editor_fullscreen_closed');
        }
    }, [hasUnsavedChanges]);

    const confirmDiscard = useCallback(() => {
        setShowExitDialog(false);
        setIsFullScreen(false);
        logger.info('storefront_editor_changes_discarded');
    }, []);

    const confirmSaveAndExit = useCallback(async () => {
        setIsExiting(true);
        try {
            await onSave();
            setShowExitDialog(false);
            setIsFullScreen(false);
            logger.info('storefront_editor_saved_and_closed');
        } catch (error) {
            logger.error('Failed to save before exit', error);
        } finally {
            setIsExiting(false);
        }
    }, [onSave]);

    const cancelExit = useCallback(() => {
        setShowExitDialog(false);
    }, []);

    // ESC key handler
    useEffect(() => {
        if (!isFullScreen) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                requestClose();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isFullScreen, requestClose]);

    // Lock body scroll when full-screen
    useEffect(() => {
        if (isFullScreen) {
            const originalOverflow = document.body.style.overflow;
            document.body.style.overflow = 'hidden';
            return () => {
                document.body.style.overflow = originalOverflow;
            };
        }
    }, [isFullScreen]);

    return {
        isFullScreen,
        showExitDialog,
        isExiting,
        openFullScreen,
        requestClose,
        confirmDiscard,
        confirmSaveAndExit,
        cancelExit,
    };
}
