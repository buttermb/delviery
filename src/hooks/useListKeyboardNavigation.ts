/**
 * useListKeyboardNavigation
 * Hook for keyboard navigation in list/table views.
 *
 * - Arrow Up/Down to move focus between rows
 * - Enter to select/open focused row
 * - Escape to clear focus
 * - Home/End to jump to first/last row
 */

import { useCallback, useState } from 'react';

interface UseListKeyboardNavigationOptions {
  /** Total number of items in the list */
  itemCount: number;
  /** Called when Enter is pressed on a focused item */
  onSelect: (index: number) => void;
  /** Whether keyboard navigation is enabled */
  enabled?: boolean;
}

interface UseListKeyboardNavigationReturn {
  focusedIndex: number;
  setFocusedIndex: (index: number) => void;
  handleKeyDown: (e: React.KeyboardEvent) => void;
}

export function useListKeyboardNavigation({
  itemCount,
  onSelect,
  enabled = true,
}: UseListKeyboardNavigationOptions): UseListKeyboardNavigationReturn {
  const [focusedIndex, setFocusedIndex] = useState(-1);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!enabled || itemCount === 0) return;

      // Don't capture events from interactive elements inside rows
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'SELECT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'BUTTON'
      ) {
        return;
      }

      switch (e.key) {
        case 'ArrowDown': {
          e.preventDefault();
          setFocusedIndex((prev) =>
            prev < itemCount - 1 ? prev + 1 : prev
          );
          break;
        }
        case 'ArrowUp': {
          e.preventDefault();
          setFocusedIndex((prev) => (prev > 0 ? prev - 1 : prev));
          break;
        }
        case 'Enter': {
          if (focusedIndex >= 0 && focusedIndex < itemCount) {
            e.preventDefault();
            onSelect(focusedIndex);
          }
          break;
        }
        case 'Escape': {
          e.preventDefault();
          setFocusedIndex(-1);
          break;
        }
        case 'Home': {
          e.preventDefault();
          setFocusedIndex(0);
          break;
        }
        case 'End': {
          e.preventDefault();
          setFocusedIndex(itemCount - 1);
          break;
        }
      }
    },
    [enabled, itemCount, focusedIndex, onSelect]
  );

  return { focusedIndex, setFocusedIndex, handleKeyDown };
}
