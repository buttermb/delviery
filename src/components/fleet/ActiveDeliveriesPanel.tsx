import { useState, useMemo } from 'react';

import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ActiveDelivery {
  id: string;
  order_number: string;
  status: 'picked_up' | 'in_transit' | 'arriving' | 'assigned';
  customer_name: string;
  delivery_address: string;
  driver_name: string;
  driver_id: string;
  eta_minutes: number | null;
  zone_name?: string | null;
  created_at: string;
}

type SortKey = 'eta' | 'status' | 'zone';

interface ActiveDeliveriesPanelProps {
  deliveries: ActiveDelivery[];
  loading?: boolean;
  onTrackDelivery: (delivery: ActiveDelivery) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<ActiveDelivery['status'], { label: string; color: string; order: number }> = {
  arriving: { label: 'Arriving', color: '#10B981', order: 0 },
  in_transit: { label: 'In Transit', color: '#3B82F6', order: 1 },
  picked_up: { label: 'Picked Up', color: '#F59E0B', order: 2 },
  assigned: { label: 'Assigned', color: '#94A3B8', order: 3 },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ActiveDeliveriesPanel({
  deliveries,
  loading,
  onTrackDelivery,
}: ActiveDeliveriesPanelProps) {
  const [sortBy, setSortBy] = useState<SortKey>('eta');

  const sorted = useMemo(() => {
    const list = [...deliveries];
    switch (sortBy) {
      case 'eta':
        return list.sort((a, b) => (a.eta_minutes ?? 999) - (b.eta_minutes ?? 999));
      case 'status':
        return list.sort(
          (a, b) => STATUS_CONFIG[a.status].order - STATUS_CONFIG[b.status].order,
        );
      case 'zone':
        return list.sort((a, b) =>
          (a.zone_name ?? '').localeCompare(b.zone_name ?? ''),
        );
      default:
        return list;
    }
  }, [deliveries, sortBy]);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-border px-4 py-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">
            Active Deliveries{' '}
            <span className="text-muted-foreground font-normal">({deliveries.length})</span>
          </h3>
          <div className="flex items-center gap-0.5 rounded-md bg-card p-0.5">
            {(['eta', 'status', 'zone'] as const).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setSortBy(key)}
                className={cn(
                  'rounded px-2 py-0.5 text-[10px] font-medium capitalize transition-colors',
                  sortBy === key
                    ? 'bg-muted text-foreground'
                    : 'text-muted-foreground hover:text-muted-foreground',
                )}
              >
                {key === 'eta' ? 'ETA' : key}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Delivery cards */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-lg bg-border" />
          ))
        ) : sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <svg className="mb-2 h-8 w-8 text-border" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25" />
            </svg>
            <p className="text-xs text-muted-foreground">No active deliveries</p>
          </div>
        ) : (
          sorted.map((delivery) => {
            const cfg = STATUS_CONFIG[delivery.status];

            return (
              <button
                key={delivery.id}
                type="button"
                onClick={() => onTrackDelivery(delivery)}
                className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-left transition-colors hover:border-muted-foreground"
              >
                {/* Top row */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-['Space_Grotesk'] text-sm font-semibold text-foreground">
                      #{delivery.order_number}
                    </span>
                    <span
                      className="rounded-full px-1.5 py-px text-[10px] font-medium"
                      style={{
                        color: cfg.color,
                        backgroundColor: `${cfg.color}15`,
                      }}
                    >
                      {cfg.label}
                    </span>
                  </div>
                  {delivery.eta_minutes != null && (
                    <span className="font-['Space_Grotesk'] text-xs font-semibold text-foreground">
                      {delivery.eta_minutes}m
                    </span>
                  )}
                </div>

                {/* Details */}
                <div className="mt-1.5 space-y-0.5">
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <svg className="h-3 w-3 flex-shrink-0 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span className="truncate">{delivery.delivery_address}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <svg className="h-3 w-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <span className="truncate">{delivery.driver_name}</span>
                    {delivery.zone_name && (
                      <>
                        <span className="text-border">/</span>
                        <span>{delivery.zone_name}</span>
                      </>
                    )}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
