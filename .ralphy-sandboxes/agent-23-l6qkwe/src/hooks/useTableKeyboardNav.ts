import { useCallback, useRef, useState } from "react";

/**
 * Hook for keyboard navigation in data tables.
 * Provides arrow key row navigation, Enter to activate, Home/End for first/last row.
 *
 * Usage:
 * ```tsx
 * const { tableProps, getRowProps } = useTableKeyboardNav({
 *   rowCount: data.length,
 *   onActivate: (index) => onRowClick(data[index]),
 * });
 *
 * <Table {...tableProps}>
 *   <TableBody>
 *     {data.map((item, i) => (
 *       <TableRow key={item.id} {...getRowProps(i)}>...</TableRow>
 *     ))}
 *   </TableBody>
 * </Table>
 * ```
 */

interface UseTableKeyboardNavOptions {
  /** Total number of rows */
  rowCount: number;
  /** Called when a row is activated (Enter/Space) */
  onActivate?: (index: number) => void;
  /** Whether keyboard nav is enabled (default: true) */
  enabled?: boolean;
}

export function useTableKeyboardNav({
  rowCount,
  onActivate,
  enabled = true,
}: UseTableKeyboardNavOptions) {
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const rowRefs = useRef<Map<number, HTMLTableRowElement>>(new Map());

  const focusRow = useCallback(
    (index: number) => {
      if (index < 0 || index >= rowCount) return;
      setFocusedIndex(index);
      rowRefs.current.get(index)?.focus();
    },
    [rowCount]
  );

  const handleRowKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTableRowElement>, index: number) => {
      if (!enabled) return;

      // Don't capture keyboard events from inputs/selects/buttons inside cells
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "SELECT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "BUTTON" ||
        target.isContentEditable
      ) {
        return;
      }

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          focusRow(Math.min(index + 1, rowCount - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          focusRow(Math.max(index - 1, 0));
          break;
        case "Home":
          e.preventDefault();
          focusRow(0);
          break;
        case "End":
          e.preventDefault();
          focusRow(rowCount - 1);
          break;
        case "Enter":
        case " ":
          if (onActivate) {
            e.preventDefault();
            onActivate(index);
          }
          break;
      }
    },
    [enabled, focusRow, rowCount, onActivate]
  );

  const setRowRef = useCallback(
    (index: number, el: HTMLTableRowElement | null) => {
      if (el) {
        rowRefs.current.set(index, el);
      } else {
        rowRefs.current.delete(index);
      }
    },
    []
  );

  const getRowProps = useCallback(
    (index: number) => ({
      tabIndex: focusedIndex === index ? 0 : -1,
      "aria-rowindex": index + 1,
      onKeyDown: (e: React.KeyboardEvent<HTMLTableRowElement>) =>
        handleRowKeyDown(e, index),
      onFocus: () => setFocusedIndex(index),
      ref: (el: HTMLTableRowElement | null) => setRowRef(index, el),
    }),
    [focusedIndex, handleRowKeyDown, setRowRef]
  );

  const tableProps = {
    role: "grid" as const,
    "aria-rowcount": rowCount,
  };

  return { tableProps, getRowProps, focusedIndex };
}
