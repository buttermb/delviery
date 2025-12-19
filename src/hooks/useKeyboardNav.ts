import { useEffect, useCallback } from 'react';

/**
 * Keyboard Navigation Hook
 * Adds keyboard support for mobile bottom navigation
 */
export function useKeyboardNav(
  onPrevious?: () => void,
  onNext?: () => void,
  onActivate?: () => void
) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Only handle if no input is focused
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA'
      ) {
        return;
      }

      switch (event.key) {
        case 'ArrowLeft':
          event.preventDefault();
          onPrevious?.();
          break;
        case 'ArrowRight':
          event.preventDefault();
          onNext?.();
          break;
        case 'Enter':
        case ' ':
          event.preventDefault();
          onActivate?.();
          break;
        default:
          break;
      }
    },
    [onPrevious, onNext, onActivate]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
