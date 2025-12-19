import { useEffect } from 'react';

/**
 * Quality of life keyboard shortcuts for forms
 * - Shift + Enter: Submit form
 * - Escape: Clear/close form
 */
export function useFormKeyboardShortcuts(
  onSubmit?: () => void,
  onEscape?: () => void
) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Shift + Enter to submit
      if (e.shiftKey && e.key === 'Enter' && onSubmit) {
        e.preventDefault();
        onSubmit();
      }
      
      // Escape to clear/close
      if (e.key === 'Escape' && onEscape) {
        e.preventDefault();
        onEscape();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onSubmit, onEscape]);
}
