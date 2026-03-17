import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Download } from 'lucide-react';

import type { DriverProfile } from '@/pages/drivers/DriverProfilePage';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PAGE_SIZE = 10;

const STATUS_CHIPS = [
  { value: 'completed', label: 'Completed', color: '#10B981' },
  { value: 'in_transit', label: 'In Transit', color: '#F59E0B' },
  { value: 'failed', label: 'Failed', color: '#EF4444' },
] as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface DeliveriesTabProps {
  driver: DriverProfile;
  tenantId: string;
}

export function DeliveriesTab({ driver, tenantId }: DeliveriesTabProps) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [activeStatuses, setActiveStatuses] = useState<Set<string>>(
    new Set(['completed', 'in_transit', 'failed']),
  );

  function toggleStatus(status: string) {
    setActiveStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
    setPage(1);
  }

  const deliveriesQuery = useQuery({
    queryKey: [
      ...queryKeys.couriersAdmin.byTenant(tenantId),
      'deliveries',
      driver.id,
      { page, search, statuses: Array.from(activeStatuses) },
    ],
    queryFn: async () => {
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let query = supabase
        .from('driver_activity_log')
        .select('*', { count: 'exact' })
        .eq('tenant_id', tenantId)
        .eq('driver_id', driver.id)
        .eq('event_type', 'delivery_completed')
        .order('created_at', { ascending: false })
        .range(from, to);

      if (search) {
        query = query.ilike('event_data->>order_number', `%${search}%`);
      }

      const { data, error, count } = await query;

      if (error) {
        logger.error('Failed to fetch deliveries', error);
        throw error;
      }

      return { data: data ?? [], count: count ?? 0 };
    },
    enabled: !!tenantId && !!driver.id,
  });

  const deliveries = deliveriesQuery.data?.data ?? [];
  const totalCount = deliveriesQuery.data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const fromRow = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const toRow = Math.min(page * PAGE_SIZE, totalCount);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {/* Status chips */}
          {STATUS_CHIPS.map(({ value, label, color }) => {
            const active = activeStatuses.has(value);
            return (
              <button
                key={value}
                type="button"
                onClick={() => toggleStatus(value)}
                className="rounded-full px-3 py-1 text-xs font-medium transition-colors"
                style={{
                  backgroundColor: active ? `${color}20` : 'transparent',
                  color: active ? color : '#64748B',
                  border: `1px solid ${active ? color : '#334155'}`,
                }}
              >
                {label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search by order #..."
              className="h-9 w-[200px] rounded-md border border-border bg-background pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-9 border-border bg-transparent text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <Download className="mr-1.5 h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-lg border border-border">
        <Table className="w-full bg-background">
          <TableHeader>
            <TableRow className="border-border bg-background hover:bg-background">
              {['Date', 'Order #', 'Pickup', 'Dropoff', 'Status', 'Duration', 'Tip', 'Rating'].map(
                (h) => (
                  <TableHead
                    key={h}
                    className="bg-background text-[11px] font-medium uppercase tracking-[0.05em] text-muted-foreground"
                  >
                    {h}
                  </TableHead>
                ),
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {deliveriesQuery.isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i} className="border-border">
                  {Array.from({ length: 8 }).map((_, j) => (
                    <TableCell key={j} className="bg-transparent">
                      <Skeleton className="h-4 w-16 bg-muted" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : deliveries.length === 0 ? (
              <TableRow className="border-border">
                <TableCell colSpan={8} className="bg-transparent py-12 text-center text-sm text-muted-foreground">
                  No deliveries found.
                </TableCell>
              </TableRow>
            ) : (
              deliveries.map((row) => {
                const eventData = (row.event_data ?? {}) as Record<string, unknown>;
                const date = new Date(row.created_at).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                });
                return (
                  <TableRow key={row.id} className="border-border hover:bg-accent">
                    <TableCell className="bg-transparent text-xs text-muted-foreground">{date}</TableCell>
                    <TableCell className="bg-transparent font-['JetBrains_Mono'] text-xs text-foreground">
                      {(eventData.order_number as string) ?? '—'}
                    </TableCell>
                    <TableCell className="bg-transparent text-xs text-muted-foreground">
                      {(eventData.pickup as string) ?? '—'}
                    </TableCell>
                    <TableCell className="bg-transparent text-xs text-muted-foreground">
                      {(eventData.dropoff as string) ?? '—'}
                    </TableCell>
                    <TableCell className="bg-transparent">
                      <span className="inline-flex items-center rounded-full bg-emerald-500/20 px-2 py-0.5 text-[11px] font-medium text-emerald-500">
                        Completed
                      </span>
                    </TableCell>
                    <TableCell className="bg-transparent text-xs text-muted-foreground">
                      {(eventData.duration as string) ?? '—'}
                    </TableCell>
                    <TableCell className="bg-transparent text-xs text-emerald-500">
                      {eventData.tip ? `$${eventData.tip}` : '—'}
                    </TableCell>
                    <TableCell className="bg-transparent text-xs text-muted-foreground">
                      {eventData.rating ? `${eventData.rating}★` : '—'}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>

        {/* Pagination */}
        <div className="flex items-center justify-between border-t border-border bg-background px-4 py-3">
          <span className="text-xs text-muted-foreground">
            {totalCount === 0
              ? 'No results'
              : `Showing ${fromRow}–${toRow} of ${totalCount} deliveries`}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="h-7 w-7 border-border bg-transparent p-0 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="px-2 text-xs text-muted-foreground">{page} / {totalPages}</span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="h-7 w-7 border-border bg-transparent p-0 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
