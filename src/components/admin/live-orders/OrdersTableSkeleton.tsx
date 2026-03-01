/**
 * Skeleton loading state for the Live Orders table.
 * Mirrors the 10-column layout of LiveOrdersTable with realistic widths.
 */

import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface OrdersTableSkeletonProps {
  rows?: number;
}

/** Column definitions matching LiveOrdersTable layout */
const COLUMNS = [
  { width: 'w-16', align: '' },        // Order #
  { width: 'w-24', align: '' },        // Customer
  { width: 'w-20', align: '' },        // Phone
  { width: 'w-8', align: 'mx-auto' },  // Items (centered)
  { width: 'w-16', align: 'ml-auto' }, // Total (right-aligned)
  { width: 'w-16', align: '' },        // Payment
  { width: 'w-16', align: '' },        // Fulfillment
  { width: 'w-20', align: '' },        // Status
  { width: 'w-14', align: '' },        // Time
  { width: 'w-8', align: 'ml-auto' },  // Actions (right-aligned)
] as const;

export function OrdersTableSkeleton({ rows = 5 }: OrdersTableSkeletonProps) {
  return (
    <div className="rounded-lg border bg-white dark:bg-zinc-900">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[120px]"><Skeleton className="h-4 w-14" /></TableHead>
            <TableHead><Skeleton className="h-4 w-18" /></TableHead>
            <TableHead><Skeleton className="h-4 w-12" /></TableHead>
            <TableHead className="text-center"><Skeleton className="h-4 w-10 mx-auto" /></TableHead>
            <TableHead className="text-right"><Skeleton className="h-4 w-10 ml-auto" /></TableHead>
            <TableHead><Skeleton className="h-4 w-16" /></TableHead>
            <TableHead><Skeleton className="h-4 w-18" /></TableHead>
            <TableHead><Skeleton className="h-4 w-12" /></TableHead>
            <TableHead><Skeleton className="h-4 w-10" /></TableHead>
            <TableHead className="text-right w-[60px]"><Skeleton className="h-4 w-8 ml-auto" /></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: rows }).map((_, i) => (
            <TableRow key={i}>
              {COLUMNS.map((col, j) => (
                <TableCell key={j}>
                  <Skeleton className={`h-4 ${col.width} ${col.align}`} />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
