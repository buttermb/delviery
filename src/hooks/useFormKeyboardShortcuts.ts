import { useEffect, useCallback } from 'react';

interface FormKeyboardShortcutsOptions {
  onSave?: () => void;
  onCancel?: () => void;
  onNew?: () => void;
  enabled?: boolean;
}

/**
 * Hook to handle common form keyboard shortcuts:
 * - Cmd/Ctrl+S → Save / Submit
 * - Escape → Cancel / Close
 * - Cmd/Ctrl+N → New / Create (only when not in an input)
 */
export function useFormKeyboardShortcuts({
  onSave,
  onCancel,
  onNew,
  enabled = true,
}: FormKeyboardShortcutsOptions) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled) return;

      const isInputFocused = ['INPUT', 'TEXTAREA', 'SELECT'].includes(
        (e.target as HTMLElement).tagName
      );

      // Cmd/Ctrl+S → Save
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        onSave?.();
        return;
      }

      // Escape → Cancel (works even in inputs)
      if (e.key === 'Escape') {
        onCancel?.();
        return;
      }

      // Cmd/Ctrl+N → New (only outside inputs to avoid conflict with browser new window)
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'n' && !isInputFocused) {
        e.preventDefault();
        onNew?.();
        return;
      }
    },
    [onSave, onCancel, onNew, enabled]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
