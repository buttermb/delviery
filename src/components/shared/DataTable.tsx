/**
 * Modern Data Table Component
 * Reusable table with filtering, sorting, pagination, and bulk actions
 */

import { useState, useMemo, useCallback } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Eye, EyeOff } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { usePagination } from '@/hooks/usePagination';
import { StandardPagination } from '@/components/shared/StandardPagination';

type ColumnDef<T> = {
  accessorKey?: keyof T | string;
  header: string;
  cell?: (row: { original: T }) => React.ReactNode;
  id?: string;
  enableHiding?: boolean;
  visible?: boolean;
};

import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ChevronLeft,
  ChevronRight,
  Search,
  Download,
  Filter,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { VirtualizedTable } from './VirtualizedTable';

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData>[];
  data: TData[];
  searchable?: boolean;
  searchPlaceholder?: string;
  searchColumn?: string;
  pagination?: boolean;
  pageSize?: number;
  bulkActions?: React.ReactNode;
  exportAction?: () => void;
  filterAction?: () => void;
  loading?: boolean;
  emptyMessage?: string;
  enableSelection?: boolean;
  enableColumnVisibility?: boolean;
  onSelectionChange?: (selected: TData[]) => void;
  getRowId?: (row: TData) => string | number;
  virtualized?: boolean;
  virtualizedThreshold?: number;
  virtualizedHeight?: number;
  virtualizedRowHeight?: number;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  searchable = true,
  searchPlaceholder = 'Search...',
  searchColumn = 'name',
  pagination = true,
  pageSize = 10,
  bulkActions,
  exportAction,
  filterAction,
  loading = false,
  emptyMessage = 'No results found.',
  enableSelection = false,
  enableColumnVisibility = true,
  onSelectionChange,
  getRowId,
  virtualized,
  virtualizedThreshold = 100,
  virtualizedHeight = 600,
  virtualizedRowHeight = 50,
}: DataTableProps<TData, TValue>) {
  const [searchValue, setSearchValue] = useState('');
  const [selectedRows, setSelectedRows] = useState<Set<string | number>>(new Set());
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(
    new Set(columns.map((col) => col.id || col.accessorKey?.toString() || '').filter(Boolean))
  );

  // Filter data
  const filteredData = useMemo(() => {
    return data.filter((item: TData) => {
      if (!searchValue) return true;
      const searchLower = searchValue.toLowerCase();
      const columnKey = searchColumn as keyof TData;
      const value = item[columnKey];
      return value?.toString().toLowerCase().includes(searchLower);
    });
  }, [data, searchValue, searchColumn]);

  // Determine if virtualization should be used
  const shouldVirtualize = virtualized ?? (filteredData.length > virtualizedThreshold);
  const useVirtual = shouldVirtualize && !pagination; // Don't virtualize if pagination is enabled

  // Use standardized pagination hook
  const {
    paginatedItems,
    currentPage,
    pageSize: currentPageSize,
    totalPages,
    totalItems,
    goToPage,
    changePageSize,
    pageSizeOptions,
  } = usePagination(filteredData, {
    defaultPageSize: pageSize,
    persistInUrl: true,
    urlKey: 'table',
  });

  // Use paginated data or all filtered data based on virtualization
  const paginatedData = useVirtual ? filteredData : paginatedItems;

  // Filter visible columns
  const visibleColumnsList = columns.filter((col) => {
    const colId = col.id || col.accessorKey?.toString() || '';
    return visibleColumns.has(colId) && (col.visible !== false);
  });

  // Handle row selection
  const toggleRowSelection = (row: TData, rowIndex: number) => {
    const rowId = getRowId ? getRowId(row) : (row as Record<string, unknown>).id as string | number || rowIndex;
    const newSelected = new Set(selectedRows);
    if (newSelected.has(rowId)) {
      newSelected.delete(rowId);
    } else {
      newSelected.add(rowId);
    }
    setSelectedRows(newSelected);
    
    // Notify parent of selection changes
    if (onSelectionChange) {
      const selectedData = filteredData.filter((item, idx) => {
        const id = getRowId ? getRowId(item) : (item as Record<string, unknown>).id as string | number || idx;
        return newSelected.has(id);
      });
      onSelectionChange(selectedData);
    }
  };

  const toggleAllSelection = () => {
    if (selectedRows.size === paginatedData.length) {
      setSelectedRows(new Set());
      if (onSelectionChange) {
        onSelectionChange([]);
      }
    } else {
      const allIds = new Set<string | number>();
      paginatedData.forEach((row, idx) => {
        const id = getRowId ? getRowId(row) : (row as Record<string, unknown>).id as string | number || idx;
        allIds.add(id);
      });
      setSelectedRows(allIds);
      if (onSelectionChange) {
        onSelectionChange(paginatedData);
      }
    }
  };

  const isAllSelected = selectedRows.size === paginatedData.length && paginatedData.length > 0;
  const isIndeterminate = selectedRows.size > 0 && selectedRows.size < paginatedData.length;

  return (
    <Card className="overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-4 flex-1">
        {searchable && (
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={searchPlaceholder}
              value={searchValue}
              onChange={(e) => {
                setSearchValue(e.target.value);
                goToPage(0); // Reset to first page on search
              }}
              className="pl-9"
            />
          </div>
        )}

          {selectedRows.size > 0 && bulkActions && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {selectedRows.size} selected
              </span>
              {bulkActions}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {enableColumnVisibility && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Eye className="h-4 w-4 mr-2" />
                  Columns
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {columns.map((column) => {
                  const colId = column.id || column.accessorKey?.toString() || '';
                  const isVisible = visibleColumns.has(colId);
                  return (
                    <DropdownMenuCheckboxItem
                      key={colId}
                      checked={isVisible}
                      onCheckedChange={(checked) => {
                        const newVisible = new Set(visibleColumns);
                        if (checked) {
                          newVisible.add(colId);
                        } else {
                          newVisible.delete(colId);
                        }
                        setVisibleColumns(newVisible);
                      }}
                    >
                      {column.header}
                    </DropdownMenuCheckboxItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {filterAction && (
            <Button variant="outline" size="sm" onClick={filterAction}>
              <Filter className="h-4 w-4 mr-2" />
              Filter
            </Button>
          )}
          {exportAction && (
            <Button variant="outline" size="sm" onClick={exportAction}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      {useVirtual ? (
        <VirtualizedTable
          columns={visibleColumnsList.map((col) => ({
            accessorKey: col.accessorKey,
            header: col.header,
            cell: col.cell ? (row: { original: TData }) => col.cell!({ original: row.original }) : undefined,
            id: col.id || col.accessorKey?.toString(),
          }))}
          data={filteredData}
          height={virtualizedHeight}
          rowHeight={virtualizedRowHeight}
          emptyMessage={emptyMessage}
          getRowId={getRowId}
        />
      ) : (
        <div className="overflow-x-auto">
          <Table>
          <TableHeader>
            <TableRow>
              {enableSelection && (
                <TableHead className="w-12">
                  <Checkbox
                    checked={isAllSelected}
                    onCheckedChange={toggleAllSelection}
                    ref={(el) => {
                      if (el) {
                        const button = el as HTMLButtonElement & { indeterminate?: boolean };
                        if (button && 'indeterminate' in button) {
                          button.indeterminate = isIndeterminate;
                        }
                      }
                    }}
                    aria-label="Select all"
                  />
                </TableHead>
              )}
              {visibleColumnsList.map((column, index) => (
                <TableHead key={column.id || column.accessorKey?.toString() || index}>
                  {column.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell
                  colSpan={visibleColumnsList.length + (enableSelection ? 1 : 0)}
                  className="h-24 text-center"
                >
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                    <span className="ml-2">Loading...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : paginatedData.length ? (
              paginatedData.map((row, rowIndex) => {
                const rowId = getRowId ? getRowId(row) : (row as Record<string, unknown>).id as string | number || rowIndex;
                const isSelected = selectedRows.has(rowId);
                return (
                  <TableRow
                    key={rowIndex}
                    className={cn("hover:bg-muted/50", isSelected && "bg-muted")}
                  >
                    {enableSelection && (
                      <TableCell>
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleRowSelection(row, rowIndex)}
                          aria-label={`Select row ${rowIndex + 1}`}
                        />
                      </TableCell>
                    )}
                    {visibleColumnsList.map((column, colIndex) => (
                      <TableCell key={column.id || column.accessorKey?.toString() || colIndex}>
                        {column.cell
                          ? column.cell({ original: row })
                          : column.accessorKey
                          ? String((row as Record<string, unknown>)[column.accessorKey as string] ?? '')
                          : ''}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell
                  colSpan={visibleColumnsList.length + (enableSelection ? 1 : 0)}
                  className="h-24 text-center"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      )}

      {/* Pagination */}
      {!useVirtual && pagination && (
        <StandardPagination
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={currentPageSize}
          totalItems={totalItems}
          pageSizeOptions={pageSizeOptions}
          onPageChange={goToPage}
          onPageSizeChange={changePageSize}
        />
      )}
    </Card>
  );
}

