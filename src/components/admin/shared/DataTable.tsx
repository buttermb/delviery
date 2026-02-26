/**
 * Shared Admin Data Table Component
 *
 * A reusable data table with sorting, filtering, pagination, row selection, and bulk actions.
 * Designed for consistent admin UI patterns across all modules.
 *
 * Features:
 * - Column-based sorting (client-side and server-side)
 * - Search/filtering with customizable placeholder
 * - Pagination with configurable page sizes
 * - Row selection with bulk actions support
 * - Empty state display with custom content
 * - Loading state handling
 *
 * Usage:
 * ```tsx
 * <DataTable
 *   columns={[
 *     { accessorKey: 'name', header: 'Name', sortable: true },
 *     { accessorKey: 'status', header: 'Status', cell: (row) => <Badge>{row.original.status}</Badge> }
 *   ]}
 *   data={products}
 *   onRowClick={(row) => navigate(`/${tenantSlug}/admin/products/${row.id}`)}
 *   bulkActions={[
 *     { label: 'Delete', onClick: handleBulkDelete, variant: 'destructive' },
 *     { label: 'Export', onClick: handleExport }
 *   ]}
 *   searchPlaceholder="Search products..."
 *   emptyState={<EmptyState icon={Package} title="No products" />}
 * />
 * ```
 */

import { useState, useMemo, useCallback, ReactNode } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown, Search, ChevronLeft, ChevronRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

/**
 * Column definition for the data table
 */
export interface ColumnDef<TData> {
  /** Unique identifier for the column */
  id?: string;
  /** Key to access data from row object */
  accessorKey?: keyof TData | string;
  /** Header text or render function */
  header: string | ((props: { column: ColumnDef<TData> }) => ReactNode);
  /** Custom cell renderer */
  cell?: (props: { original: TData; value: unknown }) => ReactNode;
  /** Enable sorting for this column */
  sortable?: boolean;
  /** Custom sort function */
  sortFn?: (a: TData, b: TData) => number;
  /** Column width (e.g., '100px', '10%') */
  width?: string;
  /** Hide column on mobile */
  hideOnMobile?: boolean;
}

/**
 * Bulk action configuration
 */
export interface BulkAction {
  /** Display label for the action */
  label: string;
  /** Click handler receiving selected row IDs */
  onClick: (selectedIds: string[]) => void;
  /** Button variant */
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  /** Icon to display before label */
  icon?: ReactNode;
  /** Disable the action */
  disabled?: boolean;
}

/**
 * Server-side pagination configuration
 */
export interface ServerPagination {
  /** Current page (1-indexed) */
  page: number;
  /** Items per page */
  pageSize: number;
  /** Total number of items */
  totalItems: number;
  /** Total number of pages */
  totalPages: number;
  /** Callback when page changes */
  onPageChange: (page: number) => void;
  /** Callback when page size changes */
  onPageSizeChange: (pageSize: number) => void;
}

/**
 * Sorting state
 */
export interface SortingState {
  /** Column ID being sorted */
  columnId: string;
  /** Sort direction */
  direction: 'asc' | 'desc';
}

interface DataTableProps<TData> {
  /** Column definitions */
  columns: ColumnDef<TData>[];
  /** Data array to display */
  data: TData[];
  /** Callback when a row is clicked */
  onRowClick?: (row: TData) => void;
  /** Array of bulk action configurations */
  bulkActions?: BulkAction[];
  /** Placeholder text for search input */
  searchPlaceholder?: string;
  /** Custom empty state content */
  emptyState?: ReactNode;
  /** Loading state */
  loading?: boolean;
  /** Enable row selection */
  enableSelection?: boolean;
  /** Column key to search against (supports nested paths like 'customer.name') */
  searchColumn?: string | string[];
  /** Server-side pagination config (if undefined, uses client-side) */
  serverPagination?: ServerPagination;
  /** Default page size for client-side pagination */
  defaultPageSize?: number;
  /** Available page size options */
  pageSizeOptions?: number[];
  /** Function to get unique row ID */
  getRowId?: (row: TData) => string;
  /** Server-side sorting callback */
  onSortChange?: (sorting: SortingState | null) => void;
  /** External search value (for controlled search) */
  searchValue?: string;
  /** External search change handler (for controlled search) */
  onSearchChange?: (value: string) => void;
  /** Additional class name */
  className?: string;
}

/**
 * Get a nested value from an object using dot notation
 */
function getNestedValue<T>(obj: T, path: string): unknown {
  return path.split('.').reduce((acc: unknown, part) => {
    if (acc && typeof acc === 'object' && part in acc) {
      return (acc as Record<string, unknown>)[part];
    }
    return undefined;
  }, obj);
}

/**
 * Shared Admin Data Table Component
 */
export function DataTable<TData extends Record<string, unknown>>({
  columns,
  data,
  onRowClick,
  bulkActions = [],
  searchPlaceholder = 'Search...',
  emptyState,
  loading = false,
  enableSelection = false,
  searchColumn,
  serverPagination,
  defaultPageSize = 10,
  pageSizeOptions = [10, 25, 50, 100],
  getRowId,
  onSortChange,
  searchValue: controlledSearchValue,
  onSearchChange,
  className,
}: DataTableProps<TData>) {
  // Internal state
  const [internalSearchValue, setInternalSearchValue] = useState('');
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [sorting, setSorting] = useState<SortingState | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);

  // Controlled vs uncontrolled search
  const searchValue = controlledSearchValue ?? internalSearchValue;
  const handleSearchChange = onSearchChange ?? setInternalSearchValue;

  // Get row ID helper
  const getRowIdFn = useCallback(
    (row: TData, index: number): string => {
      if (getRowId) {
        return getRowId(row);
      }
      if ('id' in row) {
        return String(row.id);
      }
      return String(index);
    },
    [getRowId]
  );

  // Get column ID helper
  const getColumnId = useCallback((column: ColumnDef<TData>): string => {
    return column.id ?? String(column.accessorKey ?? '');
  }, []);

  // Filter data based on search
  const filteredData = useMemo(() => {
    if (!searchValue || serverPagination) {
      return data;
    }

    const searchLower = searchValue.toLowerCase();
    const searchColumns = Array.isArray(searchColumn)
      ? searchColumn
      : searchColumn
      ? [searchColumn]
      : columns.map((col) => String(col.accessorKey ?? '')).filter(Boolean);

    return data.filter((row) => {
      return searchColumns.some((col) => {
        const value = getNestedValue(row, col);
        return value?.toString().toLowerCase().includes(searchLower);
      });
    });
  }, [data, searchValue, searchColumn, columns, serverPagination]);

  // Sort data
  const sortedData = useMemo(() => {
    if (!sorting || serverPagination) {
      return filteredData;
    }

    const column = columns.find((col) => getColumnId(col) === sorting.columnId);
    if (!column) {
      return filteredData;
    }

    return [...filteredData].sort((a, b) => {
      // Use custom sort function if provided
      if (column.sortFn) {
        const result = column.sortFn(a, b);
        return sorting.direction === 'desc' ? -result : result;
      }

      // Default sort by accessor key
      const aValue = getNestedValue(a, String(column.accessorKey ?? ''));
      const bValue = getNestedValue(b, String(column.accessorKey ?? ''));

      // Handle null/undefined
      if (aValue == null && bValue == null) return 0;
      if (aValue == null) return 1;
      if (bValue == null) return -1;

      // Compare values
      let comparison = 0;
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        comparison = aValue - bValue;
      } else {
        comparison = String(aValue).localeCompare(String(bValue));
      }

      return sorting.direction === 'desc' ? -comparison : comparison;
    });
  }, [filteredData, sorting, columns, serverPagination, getColumnId]);

  // Paginate data (client-side only)
  const paginatedData = useMemo(() => {
    if (serverPagination) {
      return sortedData;
    }

    const startIndex = (currentPage - 1) * pageSize;
    return sortedData.slice(startIndex, startIndex + pageSize);
  }, [sortedData, currentPage, pageSize, serverPagination]);

  // Pagination values
  const totalItems = serverPagination?.totalItems ?? sortedData.length;
  const totalPages = serverPagination?.totalPages ?? Math.ceil(sortedData.length / pageSize);
  const activePage = serverPagination?.page ?? currentPage;
  const activePageSize = serverPagination?.pageSize ?? pageSize;

  // Handle sort toggle
  const handleSort = (column: ColumnDef<TData>) => {
    if (!column.sortable) return;

    const columnId = getColumnId(column);
    let newSorting: SortingState | null;

    if (sorting?.columnId === columnId) {
      if (sorting.direction === 'asc') {
        newSorting = { columnId, direction: 'desc' };
      } else {
        newSorting = null; // Remove sorting
      }
    } else {
      newSorting = { columnId, direction: 'asc' };
    }

    setSorting(newSorting);
    onSortChange?.(newSorting);
  };

  // Handle row selection
  const toggleRowSelection = (rowId: string) => {
    const newSelected = new Set(selectedRows);
    if (newSelected.has(rowId)) {
      newSelected.delete(rowId);
    } else {
      newSelected.add(rowId);
    }
    setSelectedRows(newSelected);
  };

  // Handle select all
  const toggleSelectAll = () => {
    if (selectedRows.size === paginatedData.length) {
      setSelectedRows(new Set());
    } else {
      const allIds = new Set(paginatedData.map((row, idx) => getRowIdFn(row, idx)));
      setSelectedRows(allIds);
    }
  };

  // Handle page change
  const handlePageChange = (page: number) => {
    if (serverPagination) {
      serverPagination.onPageChange(page);
    } else {
      setCurrentPage(page);
    }
  };

  // Handle page size change
  const handlePageSizeChange = (size: number) => {
    if (serverPagination) {
      serverPagination.onPageSizeChange(size);
    } else {
      setPageSize(size);
      setCurrentPage(1); // Reset to first page
    }
  };

  // Selection state
  const isAllSelected = paginatedData.length > 0 && selectedRows.size === paginatedData.length;
  const isIndeterminate = selectedRows.size > 0 && selectedRows.size < paginatedData.length;
  const selectedIds = Array.from(selectedRows);

  // Render sort icon
  const renderSortIcon = (column: ColumnDef<TData>) => {
    if (!column.sortable) return null;

    const columnId = getColumnId(column);
    if (sorting?.columnId !== columnId) {
      return <ArrowUpDown className="ml-2 h-4 w-4 text-muted-foreground" />;
    }

    return sorting.direction === 'asc' ? (
      <ArrowUp className="ml-2 h-4 w-4" />
    ) : (
      <ArrowDown className="ml-2 h-4 w-4" />
    );
  };

  // Render cell value
  const renderCell = (column: ColumnDef<TData>, row: TData): ReactNode => {
    const value = column.accessorKey
      ? getNestedValue(row, String(column.accessorKey))
      : undefined;

    if (column.cell) {
      return column.cell({ original: row, value });
    }

    if (value == null) {
      return <span className="text-muted-foreground">—</span>;
    }

    return String(value);
  };

  // Render header
  const renderHeader = (column: ColumnDef<TData>): ReactNode => {
    if (typeof column.header === 'function') {
      return column.header({ column });
    }
    return column.header;
  };

  return (
    <div className={cn('rounded-md border bg-card', className)}>
      {/* Toolbar */}
      <div className="flex flex-col gap-4 p-4 border-b sm:flex-row sm:items-center sm:justify-between">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            value={searchValue}
            onChange={(e) => {
              handleSearchChange(e.target.value);
              if (!serverPagination) {
                setCurrentPage(1); // Reset to first page on search
              }
            }}
            className="pl-9"
          />
        </div>

        {/* Bulk Actions */}
        {enableSelection && selectedRows.size > 0 && bulkActions.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {selectedRows.size} selected
            </span>
            {bulkActions.map((action, idx) => (
              <Button
                key={idx}
                variant={action.variant ?? 'outline'}
                size="sm"
                onClick={() => action.onClick(selectedIds)}
                disabled={action.disabled}
              >
                {action.icon}
                {action.label}
              </Button>
            ))}
          </div>
        )}
      </div>

      {/* Table */}
      <div>
        <Table containerClassName="max-h-[600px]">
          <TableHeader>
            <TableRow>
              {enableSelection && (
                <TableHead className="w-12">
                  <Checkbox
                    checked={isAllSelected}
                    onCheckedChange={toggleSelectAll}
                    aria-label="Select all rows"
                    ref={(el) => {
                      if (el) {
                        const button = el as HTMLButtonElement & { indeterminate?: boolean };
                        if ('indeterminate' in button) {
                          button.indeterminate = isIndeterminate;
                        }
                      }
                    }}
                  />
                </TableHead>
              )}
              {columns.map((column, idx) => (
                <TableHead
                  key={getColumnId(column) || idx}
                  style={{ width: column.width }}
                  className={cn(
                    column.sortable && 'cursor-pointer select-none hover:bg-muted/50',
                    column.hideOnMobile && 'hidden md:table-cell'
                  )}
                  onClick={() => handleSort(column)}
                >
                  <div className="flex items-center">
                    {renderHeader(column)}
                    {renderSortIcon(column)}
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length + (enableSelection ? 1 : 0)}
                  className="h-32 text-center"
                >
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                    <span className="ml-2 text-muted-foreground">Loading...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : paginatedData.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length + (enableSelection ? 1 : 0)}
                  className="h-32 text-center"
                >
                  {emptyState ?? (
                    <span className="text-muted-foreground">No results found.</span>
                  )}
                </TableCell>
              </TableRow>
            ) : (
              paginatedData.map((row, rowIndex) => {
                const rowId = getRowIdFn(row, rowIndex);
                const isSelected = selectedRows.has(rowId);

                return (
                  <TableRow
                    key={rowId}
                    className={cn(
                      onRowClick && 'cursor-pointer',
                      isSelected && 'bg-muted'
                    )}
                    onClick={(e) => {
                      // Don't trigger row click when clicking checkbox
                      if ((e.target as HTMLElement).closest('[role="checkbox"]')) {
                        return;
                      }
                      onRowClick?.(row);
                    }}
                    data-state={isSelected ? 'selected' : undefined}
                  >
                    {enableSelection && (
                      <TableCell>
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleRowSelection(rowId)}
                          aria-label={`Select row ${rowIndex + 1}`}
                        />
                      </TableCell>
                    )}
                    {columns.map((column, colIndex) => (
                      <TableCell
                        key={getColumnId(column) || colIndex}
                        className={cn(column.hideOnMobile && 'hidden md:table-cell')}
                      >
                        {renderCell(column, row)}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalItems > 0 && (
        <div className="flex flex-col gap-4 px-4 py-3 border-t sm:flex-row sm:items-center sm:justify-between">
          {/* Page size selector and item count */}
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <span>Rows per page:</span>
              <Select
                value={String(activePageSize)}
                onValueChange={(value) => handlePageSizeChange(Number(value))}
              >
                <SelectTrigger className="w-[70px] h-8">
                  <SelectValue placeholder="Rows" />
                </SelectTrigger>
                <SelectContent>
                  {pageSizeOptions.map((size) => (
                    <SelectItem key={size} value={String(size)}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <span>
              Showing {((activePage - 1) * activePageSize) + 1} to{' '}
              {Math.min(activePage * activePageSize, totalItems)} of {totalItems}
            </span>
          </div>

          {/* Page navigation */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(activePage - 1)}
              disabled={activePage <= 1}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <span className="text-sm text-muted-foreground px-2">
              Page {activePage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(activePage + 1)}
              disabled={activePage >= totalPages}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Export selected row IDs - helper for bulk operations
 */
export function useDataTableSelection() {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const clearSelection = useCallback(() => {
    setSelectedIds([]);
  }, []);

  return {
    selectedIds,
    setSelectedIds,
    clearSelection,
    hasSelection: selectedIds.length > 0,
    selectionCount: selectedIds.length,
  };
}
