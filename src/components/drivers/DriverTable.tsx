import { ChevronLeft, ChevronRight } from 'lucide-react';

import type { Driver } from '@/pages/drivers/DriverDirectoryPage';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { DriverTableRow } from '@/components/drivers/DriverTableRow';

interface DriverTableProps {
  drivers: Driver[];
  isLoading: boolean;
  selectedIds: Set<string>;
  onSelectAll: (checked: boolean) => void;
  onSelectOne: (id: string, checked: boolean) => void;
  page: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  tenantId: string;
  onViewProfile?: (id: string) => void;
  onEditDetails?: (id: string) => void;
}

function SkeletonRow() {
  return (
    <TableRow className="border-border">
      <TableCell className="w-[40px] bg-transparent">
        <Skeleton className="h-4 w-4 bg-muted" />
      </TableCell>
      <TableCell className="bg-transparent">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-full bg-muted" />
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-28 bg-muted" />
            <Skeleton className="h-3 w-36 bg-muted" />
          </div>
        </div>
      </TableCell>
      <TableCell className="bg-transparent"><Skeleton className="h-4 w-24 bg-muted" /></TableCell>
      <TableCell className="bg-transparent"><Skeleton className="h-4 w-20 bg-muted" /></TableCell>
      <TableCell className="bg-transparent"><Skeleton className="h-4 w-16 bg-muted" /></TableCell>
      <TableCell className="bg-transparent"><Skeleton className="h-5 w-14 rounded-full bg-muted" /></TableCell>
      <TableCell className="bg-transparent"><Skeleton className="h-5 w-16 rounded-full bg-muted" /></TableCell>
      <TableCell className="bg-transparent"><Skeleton className="h-4 w-8 bg-muted" /></TableCell>
      <TableCell className="bg-transparent"><Skeleton className="h-4 w-6 bg-muted" /></TableCell>
      <TableCell className="bg-transparent"><Skeleton className="h-4 w-12 bg-muted" /></TableCell>
      <TableCell className="bg-transparent"><Skeleton className="h-4 w-16 bg-muted" /></TableCell>
      <TableCell className="bg-transparent"><Skeleton className="h-4 w-4 bg-muted" /></TableCell>
    </TableRow>
  );
}

export function DriverTable({
  drivers,
  isLoading,
  selectedIds,
  onSelectAll,
  onSelectOne,
  page,
  totalPages,
  totalCount,
  pageSize,
  onPageChange,
  tenantId,
  onViewProfile,
  onEditDetails,
}: DriverTableProps) {
  const allSelected = drivers.length > 0 && drivers.every((d) => selectedIds.has(d.id));
  const someSelected = drivers.some((d) => selectedIds.has(d.id)) && !allSelected;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalCount);

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <Table className="w-full bg-background" containerClassName="max-h-[calc(100vh-340px)]">
        <TableHeader>
          <TableRow className="border-border bg-background hover:bg-background">
            <TableHead className="w-[40px] bg-background text-muted-foreground">
              <Checkbox
                checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                onCheckedChange={(checked) => onSelectAll(!!checked)}
                className="border-muted-foreground data-[state=checked]:border-emerald-500 data-[state=checked]:bg-emerald-500"
              />
            </TableHead>
            <TableHead className="bg-background text-[11px] font-medium uppercase tracking-[0.05em] text-muted-foreground">
              Name
            </TableHead>
            <TableHead className="bg-background text-[11px] font-medium uppercase tracking-[0.05em] text-muted-foreground">
              Phone
            </TableHead>
            <TableHead className="bg-background text-[11px] font-medium uppercase tracking-[0.05em] text-muted-foreground">
              Vehicle
            </TableHead>
            <TableHead className="bg-background text-[11px] font-medium uppercase tracking-[0.05em] text-muted-foreground">
              Zone
            </TableHead>
            <TableHead className="bg-background text-[11px] font-medium uppercase tracking-[0.05em] text-muted-foreground">
              Status
            </TableHead>
            <TableHead className="bg-background text-[11px] font-medium uppercase tracking-[0.05em] text-muted-foreground">
              Availability
            </TableHead>
            <TableHead className="bg-background text-[11px] font-medium uppercase tracking-[0.05em] text-muted-foreground">
              Rating
            </TableHead>
            <TableHead className="bg-background text-[11px] font-medium uppercase tracking-[0.05em] text-muted-foreground">
              Deliv.
            </TableHead>
            <TableHead className="bg-background text-[11px] font-medium uppercase tracking-[0.05em] text-muted-foreground">
              Commission
            </TableHead>
            <TableHead className="bg-background text-[11px] font-medium uppercase tracking-[0.05em] text-muted-foreground">
              Last Active
            </TableHead>
            <TableHead className="w-[40px] bg-background" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)
          ) : drivers.length === 0 ? (
            <TableRow className="border-border">
              <TableCell colSpan={12} className="bg-transparent py-16 text-center text-sm text-muted-foreground">
                No drivers found. Adjust your search or filters.
              </TableCell>
            </TableRow>
          ) : (
            drivers.map((driver) => (
              <DriverTableRow
                key={driver.id}
                driver={driver}
                isSelected={selectedIds.has(driver.id)}
                onSelect={onSelectOne}
                tenantId={tenantId}
                onViewProfile={onViewProfile}
                onEditDetails={onEditDetails}
              />
            ))
          )}
        </TableBody>
      </Table>

      {/* Pagination footer */}
      <div className="flex items-center justify-between border-t border-border bg-background px-4 py-3">
        <span className="text-xs text-muted-foreground">
          {totalCount === 0
            ? 'No results'
            : `Showing ${from}–${to} of ${totalCount}`}
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            className="h-7 w-7 border-border bg-transparent p-0 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="px-2 text-xs text-muted-foreground">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            className="h-7 w-7 border-border bg-transparent p-0 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
