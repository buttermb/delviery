import { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useMapboxToken } from '@/hooks/useMapboxToken';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import { SEOHead } from '@/components/SEOHead';
import { EnhancedLoadingState } from '@/components/EnhancedLoadingState';
import { FleetLiveMap, type MapDriver } from '@/components/fleet/FleetLiveMap';
import { DriverRosterPanel, type RosterDriver } from '@/components/fleet/DriverRosterPanel';
import { ActiveDeliveriesPanel, type ActiveDelivery } from '@/components/fleet/ActiveDeliveriesPanel';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const COURIER_POLL_MS = 15_000;
const DELIVERY_POLL_MS = 10_000;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PanelTab = 'drivers' | 'deliveries';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function FleetMapPage() {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id ?? '';
  const { token: mapboxToken, loading: tokenLoading } = useMapboxToken();

  const [panelTab, setPanelTab] = useState<PanelTab>('drivers');
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);

  // -----------------------------------------------------------------------
  // Fetch couriers
  // -----------------------------------------------------------------------

  const couriersQuery = useQuery({
    queryKey: [...queryKeys.fleetCouriers.byTenant(tenantId), 'fleet-map'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('couriers')
        .select('id, full_name, is_online, current_lat, current_lng, phone, status, last_updated, vehicle_type, zone_id')
        .eq('tenant_id', tenantId)
        .order('full_name');
      if (error) {
        logger.error('Failed to fetch fleet couriers', error);
        throw error;
      }
      return data ?? [];
    },
    enabled: !!tenantId,
    refetchInterval: COURIER_POLL_MS,
  });

  // Fetch zone names for the roster
  const zonesQuery = useQuery({
    queryKey: queryKeys.delivery.zones(tenantId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('delivery_zones')
        .select('id, name')
        .eq('tenant_id', tenantId)
        .eq('is_active', true);
      if (error) {
        logger.error('Failed to fetch zones', error);
        throw error;
      }
      return new Map((data ?? []).map((z) => [z.id, z.name]));
    },
    enabled: !!tenantId,
  });

  // Fetch active deliveries
  const deliveriesQuery = useQuery({
    queryKey: [...queryKeys.orders.live(tenantId), 'fleet-deliveries'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('id, order_number, status, customer_name, delivery_address, courier_id, eta_minutes, created_at')
        .eq('tenant_id', tenantId)
        .in('status', ['assigned', 'picked_up', 'in_transit', 'arriving'])
        .order('eta_minutes', { ascending: true, nullsFirst: false });
      if (error) {
        logger.error('Failed to fetch active deliveries', error);
        throw error;
      }
      return data ?? [];
    },
    enabled: !!tenantId,
    refetchInterval: DELIVERY_POLL_MS,
  });

  // -----------------------------------------------------------------------
  // Real-time subscription
  // -----------------------------------------------------------------------

  useEffect(() => {
    if (!tenantId) return;

    const channel = supabase
      .channel(`fleet-map-${tenantId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'couriers',
          filter: `tenant_id=eq.${tenantId}`,
        },
        () => {
          couriersQuery.refetch().catch((err) =>
            logger.error('Realtime courier refetch failed', err),
          );
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `tenant_id=eq.${tenantId}`,
        },
        () => {
          deliveriesQuery.refetch().catch((err) =>
            logger.error('Realtime delivery refetch failed', err),
          );
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  // -----------------------------------------------------------------------
  // Derived data
  // -----------------------------------------------------------------------

  const zoneMap = zonesQuery.data ?? new Map<string, string>();

  const mapDrivers: MapDriver[] = useMemo(
    () =>
      (couriersQuery.data ?? []).map((c) => ({
        id: c.id,
        full_name: c.full_name,
        status: (c.is_online
          ? c.status === 'delivering'
            ? 'delivering'
            : 'online'
          : 'offline') as MapDriver['status'],
        current_lat: c.current_lat,
        current_lng: c.current_lng,
        phone: c.phone ?? undefined,
        vehicle_type: c.vehicle_type ?? undefined,
        last_updated: c.last_updated ?? undefined,
      })),
    [couriersQuery.data],
  );

  const rosterDrivers: RosterDriver[] = useMemo(
    () =>
      (couriersQuery.data ?? []).map((c) => ({
        id: c.id,
        full_name: c.full_name,
        status: (c.is_online
          ? c.status === 'delivering'
            ? 'delivering'
            : 'online'
          : 'offline') as RosterDriver['status'],
        current_lat: c.current_lat,
        current_lng: c.current_lng,
        phone: c.phone ?? undefined,
        zone_name: c.zone_id ? zoneMap.get(c.zone_id) ?? null : null,
        last_updated: c.last_updated ?? undefined,
      })),
    [couriersQuery.data, zoneMap],
  );

  const activeDeliveries: ActiveDelivery[] = useMemo(() => {
    const couriers = couriersQuery.data ?? [];
    const courierMap = new Map(couriers.map((c) => [c.id, c]));

    return (deliveriesQuery.data ?? []).map((o) => {
      const courier = o.courier_id ? courierMap.get(o.courier_id) : undefined;
      return {
        id: o.id,
        order_number: o.order_number ?? o.id.slice(0, 8),
        status: o.status as ActiveDelivery['status'],
        customer_name: o.customer_name ?? 'Unknown',
        delivery_address: o.delivery_address,
        driver_name: courier?.full_name ?? 'Unassigned',
        driver_id: o.courier_id ?? '',
        eta_minutes: o.eta_minutes,
        zone_name: courier?.zone_id ? zoneMap.get(courier.zone_id) ?? null : null,
        created_at: o.created_at ?? '',
      };
    });
  }, [deliveriesQuery.data, couriersQuery.data, zoneMap]);

  // -----------------------------------------------------------------------
  // Handlers
  // -----------------------------------------------------------------------

  const handleRosterSelect = useCallback((driver: RosterDriver) => {
    setSelectedDriverId(driver.id);
  }, []);

  const handleTrackDelivery = useCallback((delivery: ActiveDelivery) => {
    if (delivery.driver_id) {
      setSelectedDriverId(delivery.driver_id);
    }
  }, []);

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  if (tokenLoading) {
    return <EnhancedLoadingState message="Loading map..." />;
  }

  if (!mapboxToken) {
    return (
      <div className="flex h-full items-center justify-center bg-[#0F172A]">
        <div className="max-w-md rounded-lg border border-[#334155] bg-[#1E293B] p-6 text-center">
          <svg className="mx-auto mb-3 h-10 w-10 text-[#64748B]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" />
          </svg>
          <h3 className="text-sm font-medium text-[#F8FAFC]">Mapbox token not configured</h3>
          <p className="mt-1 text-xs text-[#64748B]">
            Add a Mapbox token in Settings &gt; Integrations to enable the fleet map.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <SEOHead title="Fleet Map" />

      <div className="flex h-[calc(100vh-64px)] bg-[#0F172A]">
        {/* Map — 70% */}
        <div className="flex-1 relative">
          <FleetLiveMap
            mapboxToken={mapboxToken}
            drivers={mapDrivers}
            selectedDriverId={selectedDriverId}
            onSelectDriver={setSelectedDriverId}
          />
        </div>

        {/* Right panel — 30% */}
        <div className="w-[360px] flex-shrink-0 border-l border-[#334155] bg-[#1E293B] flex flex-col">
          {/* Panel tabs */}
          <div className="flex border-b border-[#334155]">
            <button
              type="button"
              onClick={() => setPanelTab('drivers')}
              className={`flex-1 py-2.5 text-xs font-medium transition-colors ${
                panelTab === 'drivers'
                  ? 'border-b-2 border-[#10B981] text-[#F8FAFC]'
                  : 'text-[#64748B] hover:text-[#94A3B8]'
              }`}
            >
              Drivers
            </button>
            <button
              type="button"
              onClick={() => setPanelTab('deliveries')}
              className={`flex-1 py-2.5 text-xs font-medium transition-colors ${
                panelTab === 'deliveries'
                  ? 'border-b-2 border-[#10B981] text-[#F8FAFC]'
                  : 'text-[#64748B] hover:text-[#94A3B8]'
              }`}
            >
              Deliveries
              {activeDeliveries.length > 0 && (
                <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[#10B981] px-1 text-[10px] font-bold text-white">
                  {activeDeliveries.length}
                </span>
              )}
            </button>
          </div>

          {/* Panel content */}
          <div className="flex-1 overflow-hidden">
            {panelTab === 'drivers' ? (
              <DriverRosterPanel
                drivers={rosterDrivers}
                selectedDriverId={selectedDriverId}
                onSelectDriver={handleRosterSelect}
                loading={couriersQuery.isLoading}
              />
            ) : (
              <ActiveDeliveriesPanel
                deliveries={activeDeliveries}
                loading={deliveriesQuery.isLoading}
                onTrackDelivery={handleTrackDelivery}
              />
            )}
          </div>
        </div>
      </div>
    </>
  );
}
