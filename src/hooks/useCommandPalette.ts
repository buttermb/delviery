/**
 * Command Palette Hook
 * Manages global ⌘K shortcut and command palette state
 */

import { useState, useEffect, useCallback } from 'react';

export function useCommandPalette() {
    const [open, setOpen] = useState(false);

    const toggle = useCallback(() => setOpen((prev) => !prev), []);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // ⌘K or Ctrl+K to toggle command palette
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                toggle();
            }

            // Escape to close
            if (e.key === 'Escape' && open) {
                e.preventDefault();
                setOpen(false);
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [open, toggle]);

    return {
        open,
        setOpen,
        toggle,
    };
}
