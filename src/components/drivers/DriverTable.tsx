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
    <TableRow className="border-[#334155]">
      <TableCell className="w-[40px] bg-transparent">
        <Skeleton className="h-4 w-4 bg-[#334155]" />
      </TableCell>
      <TableCell className="bg-transparent">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-full bg-[#334155]" />
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-28 bg-[#334155]" />
            <Skeleton className="h-3 w-36 bg-[#334155]" />
          </div>
        </div>
      </TableCell>
      <TableCell className="bg-transparent"><Skeleton className="h-4 w-24 bg-[#334155]" /></TableCell>
      <TableCell className="bg-transparent"><Skeleton className="h-4 w-20 bg-[#334155]" /></TableCell>
      <TableCell className="bg-transparent"><Skeleton className="h-4 w-16 bg-[#334155]" /></TableCell>
      <TableCell className="bg-transparent"><Skeleton className="h-5 w-14 rounded-full bg-[#334155]" /></TableCell>
      <TableCell className="bg-transparent"><Skeleton className="h-5 w-16 rounded-full bg-[#334155]" /></TableCell>
      <TableCell className="bg-transparent"><Skeleton className="h-4 w-8 bg-[#334155]" /></TableCell>
      <TableCell className="bg-transparent"><Skeleton className="h-4 w-6 bg-[#334155]" /></TableCell>
      <TableCell className="bg-transparent"><Skeleton className="h-4 w-12 bg-[#334155]" /></TableCell>
      <TableCell className="bg-transparent"><Skeleton className="h-4 w-16 bg-[#334155]" /></TableCell>
      <TableCell className="bg-transparent"><Skeleton className="h-4 w-4 bg-[#334155]" /></TableCell>
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
}: DriverTableProps) {
  const allSelected = drivers.length > 0 && drivers.every((d) => selectedIds.has(d.id));
  const someSelected = drivers.some((d) => selectedIds.has(d.id)) && !allSelected;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalCount);

  return (
    <div className="overflow-hidden rounded-lg border border-[#334155]">
      <Table className="w-full bg-[#0F172A]" containerClassName="max-h-[calc(100vh-340px)]">
        <TableHeader>
          <TableRow className="border-[#334155] bg-[#0F172A] hover:bg-[#0F172A]">
            <TableHead className="w-[40px] bg-[#0F172A] text-[#64748B]">
              <Checkbox
                checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                onCheckedChange={(checked) => onSelectAll(!!checked)}
                className="border-[#475569] data-[state=checked]:border-[#10B981] data-[state=checked]:bg-[#10B981]"
              />
            </TableHead>
            <TableHead className="bg-[#0F172A] text-[11px] font-medium uppercase tracking-[0.05em] text-[#64748B]">
              Name
            </TableHead>
            <TableHead className="bg-[#0F172A] text-[11px] font-medium uppercase tracking-[0.05em] text-[#64748B]">
              Phone
            </TableHead>
            <TableHead className="bg-[#0F172A] text-[11px] font-medium uppercase tracking-[0.05em] text-[#64748B]">
              Vehicle
            </TableHead>
            <TableHead className="bg-[#0F172A] text-[11px] font-medium uppercase tracking-[0.05em] text-[#64748B]">
              Zone
            </TableHead>
            <TableHead className="bg-[#0F172A] text-[11px] font-medium uppercase tracking-[0.05em] text-[#64748B]">
              Status
            </TableHead>
            <TableHead className="bg-[#0F172A] text-[11px] font-medium uppercase tracking-[0.05em] text-[#64748B]">
              Availability
            </TableHead>
            <TableHead className="bg-[#0F172A] text-[11px] font-medium uppercase tracking-[0.05em] text-[#64748B]">
              Rating
            </TableHead>
            <TableHead className="bg-[#0F172A] text-[11px] font-medium uppercase tracking-[0.05em] text-[#64748B]">
              Deliv.
            </TableHead>
            <TableHead className="bg-[#0F172A] text-[11px] font-medium uppercase tracking-[0.05em] text-[#64748B]">
              Commission
            </TableHead>
            <TableHead className="bg-[#0F172A] text-[11px] font-medium uppercase tracking-[0.05em] text-[#64748B]">
              Last Active
            </TableHead>
            <TableHead className="w-[40px] bg-[#0F172A]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)
          ) : drivers.length === 0 ? (
            <TableRow className="border-[#334155]">
              <TableCell colSpan={12} className="bg-transparent py-16 text-center text-sm text-[#64748B]">
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
              />
            ))
          )}
        </TableBody>
      </Table>

      {/* Pagination footer */}
      <div className="flex items-center justify-between border-t border-[#334155] bg-[#0F172A] px-4 py-3">
        <span className="text-xs text-[#64748B]">
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
            className="h-7 w-7 border-[#334155] bg-transparent p-0 text-[#94A3B8] hover:bg-[#263548] hover:text-[#F8FAFC] disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="px-2 text-xs text-[#94A3B8]">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            className="h-7 w-7 border-[#334155] bg-transparent p-0 text-[#94A3B8] hover:bg-[#263548] hover:text-[#F8FAFC] disabled:opacity-40"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
