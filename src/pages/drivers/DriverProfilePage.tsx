import { useState, lazy, Suspense } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import { AdminLayout } from '@/components/admin/shared/AdminLayout';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ProfileHeader } from '@/components/drivers/profile/ProfileHeader';

// Lazy-load tab content
const OverviewTab = lazy(() => import('@/components/drivers/profile/tabs/OverviewTab').then(m => ({ default: m.OverviewTab })));
const DeliveriesTab = lazy(() => import('@/components/drivers/profile/tabs/DeliveriesTab').then(m => ({ default: m.DeliveriesTab })));
const EarningsTab = lazy(() => import('@/components/drivers/profile/tabs/EarningsTab').then(m => ({ default: m.EarningsTab })));
const VehicleTab = lazy(() => import('@/components/drivers/profile/tabs/VehicleTab').then(m => ({ default: m.VehicleTab })));
const ScheduleTab = lazy(() => import('@/components/drivers/profile/tabs/ScheduleTab').then(m => ({ default: m.ScheduleTab })));
const ActivityLogTab = lazy(() => import('@/components/drivers/profile/tabs/ActivityLogTab').then(m => ({ default: m.ActivityLogTab })));

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DriverProfile {
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
  zone_name: string | null;
  status: 'pending' | 'active' | 'inactive' | 'suspended' | 'terminated';
  availability: 'online' | 'offline' | 'on_delivery';
  commission_rate: number | null;
  is_active: boolean;
  is_online: boolean;
  notes: string | null;
  insurance_expiry: string | null;
  last_seen_at: string | null;
  created_at: string;
  updated_at: string;
  suspended_at: string | null;
  suspended_until: string | null;
  suspension_reason: string | null;
  terminated_at: string | null;
}

// ---------------------------------------------------------------------------
// Tabs config
// ---------------------------------------------------------------------------

const TABS = [
  { value: 'overview', label: 'Overview' },
  { value: 'deliveries', label: 'Deliveries' },
  { value: 'earnings', label: 'Earnings' },
  { value: 'vehicle', label: 'Vehicle' },
  { value: 'schedule', label: 'Schedule' },
  { value: 'activity', label: 'Activity Log' },
] as const;

type TabValue = typeof TABS[number]['value'];

// ---------------------------------------------------------------------------
// Tab loading fallback
// ---------------------------------------------------------------------------

function TabSkeleton() {
  return (
    <div className="space-y-4 pt-4">
      <div className="grid grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-lg bg-[#1E293B]" />
        ))}
      </div>
      <Skeleton className="h-48 rounded-lg bg-[#1E293B]" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function DriverProfilePage() {
  const { driverId } = useParams<{ driverId: string }>();
  const { tenant } = useTenantAdminAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const activeTab = (searchParams.get('tab') as TabValue) || 'overview';
  const [visitedTabs, setVisitedTabs] = useState<Set<TabValue>>(new Set([activeTab]));

  function handleTabChange(tab: string) {
    const t = tab as TabValue;
    setSearchParams({ tab: t }, { replace: true });
    setVisitedTabs((prev) => {
      if (prev.has(t)) return prev;
      const next = new Set(prev);
      next.add(t);
      return next;
    });
  }

  const tenantId = tenant?.id ?? '';

  // Fetch driver profile
  const driverQuery = useQuery({
    queryKey: [...queryKeys.couriersAdmin.byTenant(tenantId), 'profile', driverId],
    queryFn: async () => {
      if (!tenantId || !driverId) return null;

      const { data, error } = await supabase
        .from('couriers')
        .select(`
          id, user_id, full_name, display_name, email, phone,
          vehicle_type, vehicle_make, vehicle_model, vehicle_year,
          vehicle_color, vehicle_plate, zone_id, status, availability,
          commission_rate, is_active, is_online, notes, insurance_expiry,
          last_seen_at, created_at, updated_at,
          suspended_at, suspended_until, suspension_reason, terminated_at,
          delivery_zones ( name )
        `)
        .eq('id', driverId)
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (error) {
        logger.error('Failed to fetch driver profile', error);
        throw error;
      }

      if (!data) return null;

      return {
        ...data,
        zone_name: (data.delivery_zones as { name: string } | null)?.name ?? null,
      } as DriverProfile;
    },
    enabled: !!tenantId && !!driverId,
  });

  const driver = driverQuery.data;

  if (driverQuery.isLoading) {
    return (
      <AdminLayout title="Driver Profile" subtitle="Loading...">
        <div className="space-y-4">
          <Skeleton className="h-32 rounded-lg bg-[#1E293B]" />
          <div className="grid grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-lg bg-[#1E293B]" />
            ))}
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (!driver) {
    return (
      <AdminLayout title="Driver Profile" subtitle="Not found">
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-lg font-medium text-[#F8FAFC]">Driver not found</p>
          <p className="mt-1 text-sm text-[#64748B]">
            This driver may have been removed or you don't have access.
          </p>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title={driver.display_name || driver.full_name} subtitle="Driver Profile">
      <div className="space-y-0">
        <ProfileHeader driver={driver} tenantId={tenantId} />

        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList className="h-auto w-full justify-start gap-0 rounded-none border-b border-[#334155] bg-transparent p-0">
            {TABS.map(({ value, label }) => (
              <TabsTrigger
                key={value}
                value={value}
                className="relative rounded-none border-b-2 border-transparent bg-transparent px-4 py-2.5 text-sm text-[#64748B] shadow-none hover:text-[#94A3B8] data-[state=active]:border-[#10B981] data-[state=active]:bg-transparent data-[state=active]:text-[#10B981] data-[state=active]:shadow-none"
              >
                {label}
              </TabsTrigger>
            ))}
          </TabsList>

          <Suspense fallback={<TabSkeleton />}>
            <TabsContent value="overview" className="mt-0 pt-4">
              {visitedTabs.has('overview') && (
                <OverviewTab driver={driver} tenantId={tenantId} />
              )}
            </TabsContent>
            <TabsContent value="deliveries" className="mt-0 pt-4">
              {visitedTabs.has('deliveries') && (
                <DeliveriesTab driver={driver} tenantId={tenantId} />
              )}
            </TabsContent>
            <TabsContent value="earnings" className="mt-0 pt-4">
              {visitedTabs.has('earnings') && (
                <EarningsTab driver={driver} tenantId={tenantId} />
              )}
            </TabsContent>
            <TabsContent value="vehicle" className="mt-0 pt-4">
              {visitedTabs.has('vehicle') && (
                <VehicleTab driver={driver} tenantId={tenantId} />
              )}
            </TabsContent>
            <TabsContent value="schedule" className="mt-0 pt-4">
              {visitedTabs.has('schedule') && (
                <ScheduleTab driver={driver} tenantId={tenantId} />
              )}
            </TabsContent>
            <TabsContent value="activity" className="mt-0 pt-4">
              {visitedTabs.has('activity') && (
                <ActivityLogTab driver={driver} tenantId={tenantId} />
              )}
            </TabsContent>
          </Suspense>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
