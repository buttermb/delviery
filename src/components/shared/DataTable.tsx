/**
 * Modern Data Table Component
 * Reusable table with filtering, sorting, pagination, and bulk actions
 */

import { useState } from 'react';
// Simplified DataTable without @tanstack/react-table dependency
// TODO: Install @tanstack/react-table for full functionality: npm install @tanstack/react-table

type ColumnDef<T> = {
  accessorKey?: keyof T | string;
  header: string;
  cell?: (row: { original: T }) => React.ReactNode;
  id?: string;
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
}: DataTableProps<TData, TValue>) {
  const [currentPage, setCurrentPage] = useState(0);
  const [searchValue, setSearchValue] = useState('');
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());

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
              {columns.map((column, index) => (
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
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                    <span className="ml-2">Loading...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : paginatedData.length ? (
              paginatedData.map((row, rowIndex) => (
                <TableRow
                  key={rowIndex}
                  className="hover:bg-muted/50"
                >
                  {columns.map((column, colIndex) => (
                    <TableCell key={column.id || column.accessorKey?.toString() || colIndex}>
                      {column.cell
                        ? column.cell({ original: row })
                        : column.accessorKey
                        ? (row as any)[column.accessorKey]
                        : ''}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
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

