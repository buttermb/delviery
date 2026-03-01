/**
 * Virtualized Table Component using TanStack Virtual
 * Uses @tanstack/react-virtual for efficient rendering of large datasets.
 * Only renders visible rows in the DOM for 60fps scrolling with 1000+ rows.
 */

import React, { memo, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { cn } from '@/lib/utils';

interface Column<T> {
  accessorKey?: keyof T | string;
  header: string;
  cell?: (row: { original: T; index: number }) => React.ReactNode;
  id?: string;
  width?: number;
  className?: string;
}

interface VirtualizedTableTanstackProps<T> {
  columns: Column<T>[];
  data: T[];
  height?: number;
  rowHeight?: number;
  className?: string;
  emptyMessage?: string;
  getRowId?: (row: T, index: number) => string | number;
  onRowClick?: (row: T, index: number) => void;
  overscanCount?: number;
  /** Enable dynamic row height estimation based on content */
  enableDynamicHeight?: boolean;
  /** Custom function to estimate row height based on data */
  estimateRowHeight?: (row: T, index: number) => number;
  /** Measure actual row heights after rendering for precise scrolling */
  measureElement?: boolean;
}

/** Memoized row component to prevent unnecessary re-renders */
function renderCellValue(cellContent: React.ReactNode): React.ReactNode {
  if (cellContent == null) return '-';
  if (React.isValidElement(cellContent)) return cellContent;
  if (typeof cellContent === 'string' || typeof cellContent === 'number' || typeof cellContent === 'boolean') {
    return String(cellContent);
  }
  return '-';
}

/** Memoized row component to prevent unnecessary re-renders */
const VirtualizedRow = memo(function VirtualizedRow<T>({
  row,
  index,
  columns,
  onRowClick,
}: {
  row: T;
  index: number;
  columns: Column<T>[];
  onRowClick?: (row: T, index: number) => void;
}): React.ReactElement {
  return (
    <div
      className={cn(
        'flex border-b hover:bg-muted/50 transition-colors items-center dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700',
        onRowClick && 'cursor-pointer'
      )}
      onClick={() => onRowClick?.(row, index)}
    >
      {columns.map((column, colIndex) => {
        const cellContent = column.cell
          ? column.cell({ original: row, index })
          : column.accessorKey
            ? (row as Record<string, unknown>)[column.accessorKey as string]
            : null;

        return (
          <div
            key={column.id || colIndex}
            className={cn(
              'px-4 flex items-center text-sm truncate',
              column.className,
              column.width ? '' : 'flex-1'
            )}
            style={{ width: column.width || 'auto', minWidth: column.width || 150 }}
          >
            {renderCellValue(cellContent as React.ReactNode)}
          </div>
        );
      })}
    </div>
  );
}) as <T>(props: {
  row: T;
  index: number;
  columns: Column<T>[];
  onRowClick?: (row: T, index: number) => void;
}) => React.ReactElement;

/** Header height constant for calculations */
const HEADER_HEIGHT = 44;

function VirtualizedTableTanstackInner<T>({
  columns,
  data,
  height = 600,
  rowHeight = 48,
  className,
  emptyMessage = 'No data available',
  onRowClick,
  overscanCount = 5,
  enableDynamicHeight = false,
  estimateRowHeight,
  measureElement = false,
}: VirtualizedTableTanstackProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);

  // Calculate estimated size for each row
  const getEstimatedSize = React.useCallback(
    (index: number): number => {
      if (estimateRowHeight && data[index]) {
        return estimateRowHeight(data[index], index);
      }
      return rowHeight;
    },
    [estimateRowHeight, data, rowHeight]
  );

  // Create virtualizer instance with dynamic or static height estimation
  const rowVirtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => parentRef.current,
    estimateSize: enableDynamicHeight ? getEstimatedSize : () => rowHeight,
    overscan: overscanCount,
    // Enable measuring actual DOM elements for precise heights when needed
    measureElement: enableDynamicHeight && measureElement
      ? (element) => element?.getBoundingClientRect().height
      : undefined,
  });

  if (data.length === 0) {
    return (
      <div className={cn('flex items-center justify-center py-12 text-muted-foreground', className)}>
        {emptyMessage}
      </div>
    );
  }

  const listHeight = Math.max(height - HEADER_HEIGHT, 200);

  return (
    <div className={cn('border rounded-lg overflow-hidden dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700', className)}>
      {/* Sticky Header */}
      <div
        className="flex border-b bg-muted/50 dark:bg-gray-800 dark:border-gray-700"
        style={{ height: HEADER_HEIGHT }}
      >
        {columns.map((column, index) => (
          <div
            key={column.id || index}
            className={cn(
              'px-4 py-3 font-semibold text-sm flex items-center',
              column.className,
              column.width ? '' : 'flex-1'
            )}
            style={{ width: column.width || 'auto', minWidth: column.width || 150 }}
          >
            {column.header}
          </div>
        ))}
      </div>

      {/* Virtualized Rows via TanStack Virtual */}
      <div
        ref={parentRef}
        className="overflow-auto"
        style={{ height: listHeight }}
      >
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualItem) => {
            const row = data[virtualItem.index];
            return (
              <div
                key={virtualItem.key}
                data-index={virtualItem.index}
                ref={(node) => {
                  if (enableDynamicHeight && measureElement && node) {
                    rowVirtualizer.measureElement(node);
                  }
                }}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualItem.size}px`,
                  transform: `translateY(${virtualItem.start}px)`,
                }}
              >
                <VirtualizedRow
                  row={row}
                  index={virtualItem.index}
                  columns={columns}
                  onRowClick={onRowClick}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Export with proper typing
export const VirtualizedTableTanstack = VirtualizedTableTanstackInner as <T>(
  props: VirtualizedTableTanstackProps<T>
) => JSX.Element;

export type { VirtualizedTableTanstackProps, Column as VirtualizedTableTanstackColumn };
