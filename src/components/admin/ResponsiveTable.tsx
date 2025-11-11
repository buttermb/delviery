/**
 * ResponsiveTable Component
 * Converts tables to mobile-friendly card layouts on small screens
 */

import { ReactNode } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface Column<T = Record<string, unknown>> {
  key: string;
  label: string;
  render?: (value: unknown, row: T) => ReactNode;
  className?: string;
  mobileLabel?: string;
}

interface ResponsiveTableProps<T = Record<string, unknown>> {
  columns: Column<T>[];
  data: T[];
  emptyMessage?: string;
  loading?: boolean;
  className?: string;
  mobileCardClassName?: string;
}

export function ResponsiveTable<T = Record<string, unknown>>({
  columns,
  data,
  emptyMessage = 'No data available',
  loading = false,
  className,
  mobileCardClassName,
}: ResponsiveTableProps) {
  return (
    <>
      {/* Desktop Table View */}
      <div className={cn('hidden md:block', className)}>
        <div className="rounded-md border overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((column) => (
                  <TableHead key={column.key} className={column.className}>
                    {column.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={columns.length} className="text-center py-8">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length} className="text-center py-8 text-muted-foreground">
                    {emptyMessage}
                  </TableCell>
                </TableRow>
              ) : (
                data.map((row, rowIndex) => (
                  <TableRow key={(row as Record<string, unknown>).id as string || rowIndex}>
                    {columns.map((column) => (
                    <TableCell key={column.key} className={column.className}>
                        {column.render
                          ? (column.render((row as Record<string, unknown>)[column.key], row) as React.ReactNode)
                          : ((row as Record<string, unknown>)[column.key] ?? '-') as React.ReactNode}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Mobile Card View */}
      <div className={cn('md:hidden space-y-3', className)}>
        {loading ? (
          <Card>
            <CardContent className="p-4">
              <div className="text-center text-muted-foreground">Loading...</div>
            </CardContent>
          </Card>
        ) : data.length === 0 ? (
          <Card>
            <CardContent className="p-4">
              <div className="text-center text-muted-foreground">{emptyMessage}</div>
            </CardContent>
          </Card>
        ) : (
          data.map((row, rowIndex) => (
            <Card key={(row as Record<string, unknown>).id as string || rowIndex} className={mobileCardClassName}>
              <CardContent className="p-4 space-y-3">
                {columns.map((column) => {
                  const label = column.mobileLabel || column.label;
                  const value = column.render
                    ? column.render((row as Record<string, unknown>)[column.key], row)
                    : (row as Record<string, unknown>)[column.key] ?? '-';

                  return (
                    <div key={column.key} className="flex flex-col gap-1">
                      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        {label}
                      </div>
                      <div className={cn('text-sm', column.className)}>{value as React.ReactNode}</div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </>
  );
}

