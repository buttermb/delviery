import { useState, useMemo } from 'react';

import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RosterDriver {
  id: string;
  full_name: string;
  status: 'online' | 'delivering' | 'idle' | 'offline';
  current_lat: number | null;
  current_lng: number | null;
  phone?: string;
  zone_name?: string | null;
  last_updated?: string;
}

interface DriverRosterPanelProps {
  drivers: RosterDriver[];
  selectedDriverId?: string | null;
  onSelectDriver: (driver: RosterDriver) => void;
  loading?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<RosterDriver['status'], { label: string; color: string; order: number }> = {
  delivering: { label: 'Delivering', color: '#F59E0B', order: 0 },
  online: { label: 'Online', color: '#10B981', order: 1 },
  idle: { label: 'Idle', color: '#94A3B8', order: 2 },
  offline: { label: 'Offline', color: '#64748B', order: 3 },
};

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DriverRosterPanel({
  drivers,
  selectedDriverId,
  onSelectDriver,
  loading,
}: DriverRosterPanelProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<RosterDriver['status'] | 'all'>('all');

  const filtered = useMemo(() => {
    let list = [...drivers];

    if (statusFilter !== 'all') {
      list = list.filter((d) => d.status === statusFilter);
    }

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (d) =>
          d.full_name.toLowerCase().includes(q) ||
          d.zone_name?.toLowerCase().includes(q),
      );
    }

    list.sort((a, b) => STATUS_CONFIG[a.status].order - STATUS_CONFIG[b.status].order);
    return list;
  }, [drivers, search, statusFilter]);

  const counts = useMemo(() => {
    const map = { online: 0, delivering: 0, idle: 0, offline: 0 };
    for (const d of drivers) {
      map[d.status] = (map[d.status] ?? 0) + 1;
    }
    return map;
  }, [drivers]);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold text-foreground">
          Drivers <span className="text-muted-foreground font-normal">({drivers.length})</span>
        </h3>

        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search drivers..."
          className="mt-2 h-8 min-h-0 border-border bg-card text-xs text-foreground placeholder:text-muted-foreground focus-visible:ring-emerald-500"
        />

        {/* Status filter chips */}
        <div className="mt-2 flex flex-wrap gap-1.5">
          <FilterChip
            label="All"
            count={drivers.length}
            active={statusFilter === 'all'}
            onClick={() => setStatusFilter('all')}
          />
          <FilterChip
            label="Active"
            count={counts.delivering}
            color="#F59E0B"
            active={statusFilter === 'delivering'}
            onClick={() => setStatusFilter('delivering')}
          />
          <FilterChip
            label="Online"
            count={counts.online}
            color="#10B981"
            active={statusFilter === 'online'}
            onClick={() => setStatusFilter('online')}
          />
          <FilterChip
            label="Offline"
            count={counts.offline}
            color="#64748B"
            active={statusFilter === 'offline'}
            onClick={() => setStatusFilter('offline')}
          />
        </div>
      </div>

      {/* Driver list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded-lg bg-border" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <p className="px-4 py-8 text-center text-xs text-muted-foreground">
            {search ? 'No matching drivers' : 'No drivers found'}
          </p>
        ) : (
          <div className="p-2 space-y-0.5">
            {filtered.map((driver) => {
              const cfg = STATUS_CONFIG[driver.status];
              const isSelected = driver.id === selectedDriverId;
              const hasLocation = driver.current_lat != null && driver.current_lng != null;

              return (
                <button
                  key={driver.id}
                  type="button"
                  onClick={() => onSelectDriver(driver)}
                  disabled={!hasLocation}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors',
                    isSelected
                      ? 'bg-emerald-500/10 ring-1 ring-emerald-500/30'
                      : hasLocation
                        ? 'hover:bg-muted'
                        : 'opacity-50 cursor-not-allowed',
                  )}
                >
                  {/* Status dot */}
                  <div
                    className="h-2 w-2 flex-shrink-0 rounded-full"
                    style={{ backgroundColor: cfg.color }}
                  />

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="truncate text-sm text-foreground">{driver.full_name}</span>
                      {driver.last_updated && (
                        <span className="ml-2 flex-shrink-0 text-[10px] text-muted-foreground">
                          {formatRelativeTime(driver.last_updated)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <span style={{ color: cfg.color }}>{cfg.label}</span>
                      {driver.zone_name && (
                        <>
                          <span className="text-border">/</span>
                          <span className="truncate">{driver.zone_name}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* FlyTo indicator */}
                  {hasLocation && (
                    <svg className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l-4 4m0-4l4 4m6-4a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function FilterChip({
  label,
  count,
  color,
  active,
  onClick,
}: {
  label: string;
  count: number;
  color?: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors',
        active
          ? 'bg-emerald-500/10 text-emerald-500'
          : 'bg-card text-muted-foreground hover:text-muted-foreground',
      )}
    >
      {color && (
        <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
      )}
      {label}
      <span className={active ? 'text-emerald-500/70' : 'text-muted-foreground'}>{count}</span>
    </button>
  );
}
