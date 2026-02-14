/**
 * Virtualized Dynamic List Component
 * Extends VirtualizedTableTanstack with smart row height estimation for variable content.
 * Automatically estimates heights based on text content, wrapped text, and multi-line cells.
 */

import React, { useMemo } from 'react';
import { VirtualizedTableTanstack, VirtualizedTableTanstackProps } from './VirtualizedTableTanstack';

interface DynamicListProps<T> extends Omit<VirtualizedTableTanstackProps<T>, 'enableDynamicHeight' | 'estimateRowHeight' | 'measureElement'> {
  /** Configuration for dynamic height calculation */
  dynamicHeightConfig?: {
    /** Base height for a single line of text (default: 48) */
    baseHeight?: number;
    /** Additional height per estimated line of text (default: 20) */
    lineHeight?: number;
    /** Average characters per line for wrapping estimation (default: 50) */
    charsPerLine?: number;
    /** Padding per row (default: 16) */
    padding?: number;
    /** Enable DOM measurement for precise heights (default: false) */
    measureElement?: boolean;
  };
}

/**
 * Estimates the number of lines a text will occupy based on length
 */
function estimateTextLines(text: string, charsPerLine: number): number {
  if (!text) return 1;
  const textLength = String(text).length;
  return Math.max(1, Math.ceil(textLength / charsPerLine));
}

/**
 * Calculates estimated row height based on cell content
 */
function calculateRowHeight<T>(
  row: T,
  columns: Array<{ accessorKey?: keyof T | string; cell?: (row: { original: T; index: number }) => React.ReactNode }>,
  config: Required<NonNullable<DynamicListProps<T>['dynamicHeightConfig']>>
): number {
  const { baseHeight, lineHeight, charsPerLine, padding } = config;

  let maxLines = 1;

  // Check each column for content that might wrap
  for (const column of columns) {
    let cellContent: unknown;

    if (column.cell) {
      // For custom cell renderers, we can't easily estimate, so use a conservative estimate
      maxLines = Math.max(maxLines, 2);
      continue;
    }

    if (column.accessorKey) {
      cellContent = (row as Record<string, unknown>)[column.accessorKey as string];
    }

    if (cellContent !== null && cellContent !== undefined) {
      const textContent = typeof cellContent === 'object'
        ? JSON.stringify(cellContent)
        : String(cellContent);

      const lines = estimateTextLines(textContent, charsPerLine);
      maxLines = Math.max(maxLines, lines);
    }
  }

  // Calculate total height: base height + additional lines + padding
  return baseHeight + (maxLines - 1) * lineHeight + padding;
}

function VirtualizedDynamicListInner<T>(props: DynamicListProps<T>) {
  const {
    dynamicHeightConfig,
    columns,
    data,
    ...otherProps
  } = props;

  // Merge default config with provided config
  const config: Required<NonNullable<DynamicListProps<T>['dynamicHeightConfig']>> = useMemo(() => ({
    baseHeight: dynamicHeightConfig?.baseHeight ?? 48,
    lineHeight: dynamicHeightConfig?.lineHeight ?? 20,
    charsPerLine: dynamicHeightConfig?.charsPerLine ?? 50,
    padding: dynamicHeightConfig?.padding ?? 16,
    measureElement: dynamicHeightConfig?.measureElement ?? false,
  }), [dynamicHeightConfig]);

  // Create estimator function
  const estimateRowHeight = useMemo(() => {
    return (row: T): number => {
      return calculateRowHeight(row, columns, config);
    };
  }, [columns, config]);

  return (
    <VirtualizedTableTanstack
      {...otherProps}
      columns={columns}
      data={data}
      enableDynamicHeight={true}
      estimateRowHeight={estimateRowHeight}
      measureElement={config.measureElement}
    />
  );
}

// Export with proper typing
export const VirtualizedDynamicList = VirtualizedDynamicListInner as <T>(
  props: DynamicListProps<T>
) => JSX.Element;

export type { DynamicListProps };
