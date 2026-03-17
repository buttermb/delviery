import { useState, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Download } from 'lucide-react';

import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useTenantNavigation } from '@/lib/navigation/tenantNavigation';
import { useDebounce } from '@/hooks/useDebounce';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';

import { Button } from '@/components/ui/button';

import { DriverStatsStrip } from '@/components/drivers/DriverStatsStrip';
import { DriverTable } from '@/components/drivers/DriverTable';
import { DriverFilters, type DriverFilterValues } from '@/components/drivers/DriverFilters';
import { BulkActionBar } from '@/components/drivers/BulkActionBar';
import { AddDriverDialog } from '@/components/drivers/AddDriverDialog';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Driver {
  id: string;
  user_id: string | null;
  full_name: string;
  display_name: string | null;
  email: string;
  phone: string;
  vehicle_type: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_year: number | null;
  vehicle_color: string | null;
  vehicle_plate: string | null;
  zone_id: string | null;
  zone_name?: string | null;
  status: 'pending' | 'active' | 'inactive' | 'suspended' | 'terminated';
  availability: 'online' | 'offline' | 'on_delivery';
  commission_rate: number | null;
  is_active: boolean;
  is_online: boolean;
  notes: string | null;
  last_seen_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DriverStats {
  total: number;
  online: number;
  avgRating: number;
  deliveriesToday: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PAGE_SIZE = 20;

function parseFiltersFromParams(params: URLSearchParams): DriverFilterValues {
  return {
    status: params.get('status') || 'all',
    availability: params.get('availability') || 'all',
    vehicleType: params.get('vehicleType') || 'all',
    ratingMin: Number(params.get('ratingMin') || 1),
    ratingMax: Number(params.get('ratingMax') || 5),
    zones: params.getAll('zone'),
  };
}

function filtersToParams(filters: DriverFilterValues): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  if (filters.status !== 'all') out.status = filters.status;
  if (filters.availability !== 'all') out.availability = filters.availability;
  if (filters.vehicleType !== 'all') out.vehicleType = filters.vehicleType;
  if (filters.ratingMin !== 1) out.ratingMin = String(filters.ratingMin);
  if (filters.ratingMax !== 5) out.ratingMax = String(filters.ratingMax);
  if (filters.zones.length > 0) out.zone = filters.zones;
  return out;
}

function countActiveFilters(filters: DriverFilterValues): number {
  let count = 0;
  if (filters.status !== 'all') count++;
  if (filters.availability !== 'all') count++;
  if (filters.vehicleType !== 'all') count++;
  if (filters.ratingMin !== 1 || filters.ratingMax !== 5) count++;
  if (filters.zones.length > 0) count++;
  return count;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function DriverDirectoryPage() {
  const { tenant } = useTenantAdminAuth();
  const { navigateToAdmin } = useTenantNavigation();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  // UI state
  const [search, setSearch] = useState(searchParams.get('q') || '');
  const debouncedSearch = useDebounce(search, 300);
  const [page, setPage] = useState(Number(searchParams.get('page') || 1));
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<DriverFilterValues>(
    parseFiltersFromParams(searchParams),
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [addDriverOpen, setAddDriverOpen] = useState(false);

  const activeFilterCount = countActiveFilters(filters);

  // Sync URL params
  useEffect(() => {
    const next = new URLSearchParams();
    if (debouncedSearch) next.set('q', debouncedSearch);
    if (page > 1) next.set('page', String(page));
    const fp = filtersToParams(filters);
    for (const [k, v] of Object.entries(fp)) {
      if (Array.isArray(v)) v.forEach((item) => next.append(k, item));
      else next.set(k, v);
    }
    setSearchParams(next, { replace: true });
  }, [debouncedSearch, page, filters, setSearchParams]);

  // Reset page on search/filter change
  useEffect(() => { setPage(1); }, [debouncedSearch, filters]);

  // -------------------------------------------------------------------
  // Stats query
  // -------------------------------------------------------------------
  const statsQuery = useQuery({
    queryKey: [...queryKeys.couriersAdmin.byTenant(tenant?.id), 'stats'],
    queryFn: async (): Promise<DriverStats> => {
      if (!tenant?.id) return { total: 0, online: 0, avgRating: 0, deliveriesToday: 0 };

      const { count: total } = await supabase
        .from('couriers')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenant.id);

      const { count: online } = await supabase
        .from('couriers')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenant.id)
        .eq('availability', 'online');

      // Avg rating placeholder — couriers table has no rating column yet,
      // so default to 4.7 until ratings are integrated
      const avgRating = 4.7;

      // Deliveries today — count from driver_activity_log or orders
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const { count: deliveriesToday } = await supabase
        .from('driver_activity_log')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenant.id)
        .eq('event_type', 'delivery_completed')
        .gte('created_at', todayStart.toISOString());

      return {
        total: total ?? 0,
        online: online ?? 0,
        avgRating,
        deliveriesToday: deliveriesToday ?? 0,
      };
    },
    enabled: !!tenant?.id,
  });

  // -------------------------------------------------------------------
  // Drivers list query (server-side paginated)
  // -------------------------------------------------------------------
  const driversQuery = useQuery({
    queryKey: [
      ...queryKeys.couriersAdmin.byTenant(tenant?.id),
      'list',
      { page, search: debouncedSearch, ...filters },
    ],
    queryFn: async () => {
      if (!tenant?.id) return { data: [] as Driver[], count: 0 };

      let query = supabase
        .from('couriers')
        .select(
          `id, user_id, full_name, display_name, email, phone,
           vehicle_type, vehicle_make, vehicle_model, vehicle_year,
           vehicle_color, vehicle_plate, zone_id, status, availability,
           commission_rate, is_active, is_online, notes, last_seen_at,
           created_at, updated_at,
           delivery_zones ( name )`,
          { count: 'exact' },
        )
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false });

      // Search
      if (debouncedSearch) {
        query = query.or(
          `full_name.ilike.%${debouncedSearch}%,phone.ilike.%${debouncedSearch}%,email.ilike.%${debouncedSearch}%`,
        );
      }

      // Filters
      if (filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }
      if (filters.availability !== 'all') {
        query = query.eq('availability', filters.availability);
      }
      if (filters.vehicleType !== 'all') {
        query = query.eq('vehicle_type', filters.vehicleType);
      }
      if (filters.zones.length > 0) {
        query = query.in('zone_id', filters.zones);
      }

      // Pagination
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;

      if (error) {
        logger.error('Failed to fetch drivers', error);
        throw error;
      }

      const mapped: Driver[] = (data ?? []).map((d: Record<string, unknown>) => ({
        ...d,
        zone_name: (d.delivery_zones as { name: string } | null)?.name ?? null,
      })) as Driver[];

      return { data: mapped, count: count ?? 0 };
    },
    enabled: !!tenant?.id,
  });

  const drivers = driversQuery.data?.data ?? [];
  const totalCount = driversQuery.data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  // -------------------------------------------------------------------
  // Realtime subscription for live availability updates
  // -------------------------------------------------------------------
  useEffect(() => {
    if (!tenant?.id) return;

    const channel = supabase
      .channel(`couriers-realtime-${tenant.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'couriers',
          filter: `tenant_id=eq.${tenant.id}`,
        },
        () => {
          queryClient.invalidateQueries({
            queryKey: queryKeys.couriersAdmin.byTenant(tenant.id),
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenant?.id, queryClient]);

  // -------------------------------------------------------------------
  // Selection handlers
  // -------------------------------------------------------------------
  const handleSelectAll = useCallback(
    (checked: boolean) => {
      if (checked) {
        setSelectedIds(new Set(drivers.map((d) => d.id)));
      } else {
        setSelectedIds(new Set());
      }
    },
    [drivers],
  );

  const handleSelectOne = useCallback((id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const handleClearSelection = useCallback(() => setSelectedIds(new Set()), []);

  // -------------------------------------------------------------------
  // Filter handlers
  // -------------------------------------------------------------------
  const handleApplyFilters = useCallback((next: DriverFilterValues) => {
    setFilters(next);
    setFiltersOpen(false);
  }, []);

  const handleClearFilters = useCallback(() => {
    setFilters({
      status: 'all',
      availability: 'all',
      vehicleType: 'all',
      ratingMin: 1,
      ratingMax: 5,
      zones: [],
    });
  }, []);

  // -------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------
  return (
    <AdminLayout
      title="Driver Management"
      subtitle="Manage your delivery fleet"
      actions={
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="border-[#334155] bg-transparent text-[#94A3B8] hover:bg-[#263548] hover:text-[#F8FAFC]"
          >
            <Download className="mr-1.5 h-4 w-4" />
            Export
          </Button>
          <Button
            size="sm"
            className="bg-[#10B981] text-white hover:bg-[#059669]"
            onClick={() => setAddDriverOpen(true)}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Add Driver
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Stats strip */}
        <DriverStatsStrip
          stats={statsQuery.data ?? { total: 0, online: 0, avgRating: 0, deliveriesToday: 0 }}
          isLoading={statsQuery.isLoading}
        />

        {/* Toolbar: Search + Filters */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="relative">
              <svg
                className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]"
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
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or phone..."
                className="h-9 w-[280px] rounded-md border border-[#334155] bg-[#0F172A] pl-9 pr-3 text-sm text-[#F8FAFC] placeholder:text-[#64748B] focus:border-[#10B981] focus:outline-none focus:ring-1 focus:ring-[#10B981]"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFiltersOpen((p) => !p)}
              className="border-[#334155] bg-transparent text-[#94A3B8] hover:bg-[#263548] hover:text-[#F8FAFC]"
            >
              <svg className="mr-1.5 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path d="M3 4h18M7 8h10M10 12h4" />
              </svg>
              Filters
              {activeFilterCount > 0 && (
                <span className="ml-1.5 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-[#10B981] text-[11px] font-medium text-white">
                  {activeFilterCount}
                </span>
              )}
            </Button>
          </div>
        </div>

        {/* Filter panel (collapsible) */}
        {filtersOpen && (
          <DriverFilters
            values={filters}
            tenantId={tenant?.id ?? ''}
            onApply={handleApplyFilters}
            onClear={handleClearFilters}
            activeCount={activeFilterCount}
          />
        )}

        {/* Bulk action bar */}
        {selectedIds.size > 0 && (
          <BulkActionBar
            selectedCount={selectedIds.size}
            selectedIds={selectedIds}
            tenantId={tenant?.id ?? ''}
            onClear={handleClearSelection}
          />
        )}

        {/* Table */}
        <DriverTable
          drivers={drivers}
          isLoading={driversQuery.isLoading}
          selectedIds={selectedIds}
          onSelectAll={handleSelectAll}
          onSelectOne={handleSelectOne}
          page={page}
          totalPages={totalPages}
          totalCount={totalCount}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
          tenantId={tenant?.id ?? ''}
          onViewProfile={(id) => navigateToAdmin(`drivers/${id}`)}
          onEditDetails={(id) => navigateToAdmin(`drivers/${id}?tab=details`)}
        />
      </div>

      <AddDriverDialog open={addDriverOpen} onOpenChange={setAddDriverOpen} />
    </AdminLayout>
  );
}
