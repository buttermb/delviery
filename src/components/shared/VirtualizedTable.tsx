/**
 * Virtualized Table Component
 * Uses react-window for efficient rendering of large datasets.
 * Only renders visible rows in the DOM for 60fps scrolling with 1000+ rows.
 */

import React, { memo, useMemo } from 'react';
import { List } from 'react-window';
import { cn } from '@/lib/utils';

interface Column<T> {
  accessorKey?: keyof T | string;
  header: string;
  cell?: (row: { original: T; index: number }) => React.ReactNode;
  id?: string;
  width?: number;
  className?: string;
}

interface VirtualizedTableProps<T> {
  columns: Column<T>[];
  data: T[];
  height?: number;
  rowHeight?: number;
  className?: string;
  emptyMessage?: string;
  getRowId?: (row: T, index: number) => string | number;
  onRowClick?: (row: T, index: number) => void;
  overscanCount?: number;
}

/** Props passed to VirtualizedRow via react-window's rowProps */
interface RowExtraProps {
  data: unknown[];
  columns: Column<unknown>[];
  onRowClick?: (row: unknown, index: number) => void;
}

/** Full props received by the row component (react-window injects index, style, ariaAttributes) */
interface RowComponentProps extends RowExtraProps {
  index: number;
  style: React.CSSProperties;
  ariaAttributes: {
    'aria-posinset': number;
    'aria-setsize': number;
    role: 'listitem';
  };
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
const VirtualizedRow = memo(function VirtualizedRow({
  index,
  style,
  data,
  columns,
  onRowClick,
}: RowComponentProps): React.ReactElement {
  const row = data[index];

  return (
    <div
      style={style}
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
});

/** Header height constant for calculations */
const HEADER_HEIGHT = 44;

function VirtualizedTableInner<T>({
  columns,
  data,
  height = 600,
  rowHeight = 48,
  className,
  emptyMessage = 'No data available',
  onRowClick,
  overscanCount = 5,
}: VirtualizedTableProps<T>) {
  // Stable row props reference - only changes when data/columns/callbacks change
  const rowProps: RowExtraProps = useMemo(() => ({
    data: data as unknown[],
    columns: columns as Column<unknown>[],
    onRowClick: onRowClick as ((row: unknown, index: number) => void) | undefined,
  }), [data, columns, onRowClick]);

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

      {/* Virtualized Rows via react-window */}
      <List<RowExtraProps>
        rowCount={data.length}
        rowHeight={rowHeight}
        overscanCount={overscanCount}
        style={{ height: listHeight }}
        rowComponent={VirtualizedRow as unknown as (props: RowExtraProps & { index: number; style: React.CSSProperties; ariaAttributes: Record<string, unknown> }) => React.ReactElement}
        rowProps={rowProps}
      />
    </div>
  );
}

// Export with proper typing
export const VirtualizedTable = VirtualizedTableInner as <T>(
  props: VirtualizedTableProps<T>
) => JSX.Element;

export type { VirtualizedTableProps, Column as VirtualizedTableColumn };
