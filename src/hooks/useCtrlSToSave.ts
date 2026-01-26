import { useEffect, useCallback } from 'react';

/**
 * Hook to enable Ctrl+S (Windows/Linux) or Cmd+S (Mac) keyboard shortcut for saving
 *
 * @param onSave - Callback function to execute when save shortcut is pressed
 * @param enabled - Whether the shortcut is enabled (default: true)
 *
 * @example
 * ```tsx
 * const { mutate: saveData, isPending } = useMutation({ ... });
 *
 * useCtrlSToSave(() => {
 *   if (!isPending) {
 *     saveData();
 *   }
 * });
 * ```
 */
export function useCtrlSToSave(
  onSave: (() => void) | undefined,
  enabled: boolean = true
) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Check for Ctrl+S (Windows/Linux) or Cmd+S (Mac)
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        // Always prevent browser's default save dialog
        e.preventDefault();

        // Only trigger save if callback is provided and hook is enabled
        if (onSave && enabled) {
          onSave();
        }
      }
    },
    [onSave, enabled]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
