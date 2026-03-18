/**
 * Keyboard Shortcuts Hook for Storefront Builder
 * Handles Undo, Redo, Save, Duplicate, and Delete commands
 */

import { useEffect } from 'react';

interface UseBuilderKeyboardShortcutsProps {
    undo: () => void;
    redo: () => void;
    saveDraft: () => void;
    duplicateSection: (id: string, e?: React.MouseEvent) => void;
    requestRemoveSection: (id: string, e?: React.MouseEvent) => void;
    selectedSectionId: string | null;
    isSaving: boolean;
}

export function useBuilderKeyboardShortcuts({
    undo,
    redo,
    saveDraft,
    duplicateSection,
    requestRemoveSection,
    selectedSectionId,
    isSaving
}: UseBuilderKeyboardShortcutsProps) {
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Check if user is typing in an input/textarea
            const activeElement = document.activeElement;
            const isTyping = activeElement instanceof HTMLInputElement || 
                             activeElement instanceof HTMLTextAreaElement || 
                             activeElement?.hasAttribute('contenteditable');

            // 1. Undo / Redo (macOS & Windows)
            if ((e.metaKey || e.ctrlKey) && !isTyping) {
                if (e.key === 'z') {
                    e.preventDefault();
                    if (e.shiftKey) {
                        redo();
                    } else {
                        undo();
                    }
                    return;
                }
                if (e.key === 'y') {
                    e.preventDefault();
                    redo();
                    return;
                }
            }

            // 2. Save Draft (CMD+S / CTRL+S)
            if ((e.metaKey || e.ctrlKey) && e.key === 's') {
                e.preventDefault(); // always prevent default save dialog
                if (!isSaving) {
                    saveDraft();
                }
                return;
            }

            // 3. Duplicate Section (CMD+D / CTRL+D)
            if ((e.metaKey || e.ctrlKey) && e.key === 'd' && selectedSectionId && !isTyping) {
                e.preventDefault();
                duplicateSection(selectedSectionId);
                return;
            }

            // 4. Delete Section (Delete / Backspace)
            if ((e.key === 'Delete' || e.key === 'Backspace') && selectedSectionId && !isTyping) {
                e.preventDefault();
                requestRemoveSection(selectedSectionId);
                return;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [undo, redo, saveDraft, duplicateSection, requestRemoveSection, selectedSectionId, isSaving]);
}
