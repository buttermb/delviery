/**
 * Virtualized Table Component
 * Simple table component for rendering data
 */

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
}

function VirtualizedTableInner<T>({
  columns,
  data,
  className,
  emptyMessage = 'No data available',
  getRowId,
  onRowClick,
}: VirtualizedTableProps<T>) {
  if (data.length === 0) {
    return (
      <div className={cn('flex items-center justify-center py-12 text-muted-foreground', className)}>
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className={cn('border rounded-lg overflow-hidden', className)}>
      {/* Header */}
      <div className="flex border-b bg-muted/50 sticky top-0 z-10">
        {columns.map((column, index) => (
          <div
            key={column.id || index}
            className={cn(
              'px-4 py-3 font-semibold text-sm',
              column.className,
              column.width ? '' : 'flex-1'
            )}
            style={{ width: column.width || 'auto', minWidth: column.width || 150 }}
          >
            {column.header}
          </div>
        ))}
      </div>

      {/* Data Rows */}
      <div>
        {data.map((row, index) => {
          const rowId = getRowId ? getRowId(row, index) : index;
          
          return (
            <div
              key={String(rowId)}
              className={cn(
                'flex border-b hover:bg-muted/50 transition-colors',
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
                      'px-4 py-2 flex items-center',
                      column.className,
                      column.width ? '' : 'flex-1'
                    )}
                    style={{ width: column.width || 'auto', minWidth: column.width || 150 }}
                  >
                    {cellContent !== null && cellContent !== undefined ? String(cellContent) : '-'}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Export with proper typing
export const VirtualizedTable = VirtualizedTableInner as <T>(
  props: VirtualizedTableProps<T>
) => JSX.Element;
