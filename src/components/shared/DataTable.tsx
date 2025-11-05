/**
 * Modern Data Table Component
 * Reusable table with filtering, sorting, pagination, and bulk actions
 */

import { useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Eye, EyeOff } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

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
}: DataTableProps<TData, TValue>) {
  const [currentPage, setCurrentPage] = useState(0);
  const [searchValue, setSearchValue] = useState('');
  const [selectedRows, setSelectedRows] = useState<Set<string | number>>(new Set());
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(
    new Set(columns.map((col) => col.id || col.accessorKey?.toString() || '').filter(Boolean))
  );

  // Filter data
  const filteredData = data.filter((item: any) => {
    if (!searchValue) return true;
    const searchLower = searchValue.toLowerCase();
    const columnKey = searchColumn as keyof TData;
    const value = item[columnKey];
    return value?.toString().toLowerCase().includes(searchLower);
  });

  // Paginate data
  const paginatedData = pagination
    ? filteredData.slice(currentPage * pageSize, (currentPage + 1) * pageSize)
    : filteredData;

  const totalPages = pagination ? Math.ceil(filteredData.length / pageSize) : 1;

  // Filter visible columns
  const visibleColumnsList = columns.filter((col) => {
    const colId = col.id || col.accessorKey?.toString() || '';
    return visibleColumns.has(colId) && (col.visible !== false);
  });

  // Handle row selection
  const toggleRowSelection = (row: TData, rowIndex: number) => {
    const rowId = getRowId ? getRowId(row) : (row as any).id || rowIndex;
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
        const id = getRowId ? getRowId(item) : (item as any).id || idx;
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
        const id = getRowId ? getRowId(row) : (row as any).id || idx;
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
                setCurrentPage(0); // Reset to first page on search
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
                        const button = el as any;
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
                const rowId = getRowId ? getRowId(row) : (row as any).id || rowIndex;
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
                          ? (row as any)[column.accessorKey]
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

      {/* Pagination */}
      {pagination && totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t">
          <div className="text-sm text-muted-foreground">
            Showing {currentPage * pageSize + 1} to{' '}
            {Math.min((currentPage + 1) * pageSize, filteredData.length)} of{' '}
            {filteredData.length} results
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(0)}
              disabled={currentPage === 0}
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
              disabled={currentPage === 0}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-sm text-muted-foreground px-2">
              Page {currentPage + 1} of {totalPages}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={currentPage >= totalPages - 1}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(totalPages - 1)}
              disabled={currentPage >= totalPages - 1}
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

