/**
 * Runners & Vehicles Page
 * Manage delivery runners and their vehicles
 */

import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { DataTable } from '@/components/shared/DataTable';
import { AddRunnerDialog } from '@/components/admin/AddRunnerDialog';
import { Truck, MapPin, Phone, Mail } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAccount } from '@/contexts/AccountContext';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { queryKeys } from '@/lib/queryKeys';

type ColumnDef<T> = {
  accessorKey?: keyof T | string;
  header: string;
  cell?: (row: { original: T }) => React.ReactNode;
  id?: string;
};

interface Runner {
  id: string;
  full_name: string;
  phone?: string;
  email?: string;
  status: string;
  vehicle_info?: string;
  active_deliveries?: number;
}

export default function RunnersPage() {
  const navigate = useNavigate();
  const { account } = useAccount();
  const { tenant } = useTenantAdminAuth();

  const { data: runners, isLoading } = useQuery({

    queryKey: queryKeys.runnersAdmin.byAccount(account?.id),
    queryFn: async () => {
      if (!account?.id) return [];

      const { data, error } = await supabase
        .from('wholesale_runners')
        .select('id, full_name, phone, email, status, vehicle_info')
        .order('full_name');

      if (error) throw error;

      // Get active deliveries count for each runner
      const runnersWithDeliveries = await Promise.all(
        (data ?? []).map(async (runner) => {
          const { count } = await supabase
            .from('wholesale_deliveries')
            .select('id', { count: 'exact', head: true })
            .eq('runner_id', runner.id)
            .in('status', ['assigned', 'in_transit']);

          return {
            ...runner,
            active_deliveries: count ?? 0,
          };
        })
      );

      return runnersWithDeliveries;
    },
    enabled: !!account?.id,
  });

  const columns: ColumnDef<Runner>[] = [
    {
      accessorKey: 'full_name',
      header: 'Runner',
      cell: ({ original }) => (
        <div className="flex items-center gap-2">
          <Truck className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{original.full_name}</span>
        </div>
      ),
    },
    {
      accessorKey: 'phone',
      header: 'Contact',
      cell: ({ original }) => (
        <div className="space-y-1">
          {original.phone && (
            <div className="flex items-center gap-1 text-sm">
              <Phone className="h-3 w-3" />
              {original.phone}
            </div>
          )}
          {original.email && (
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Mail className="h-3 w-3" />
              {original.email}
            </div>
          )}
        </div>
      ),
    },
    {
      accessorKey: 'vehicle_info',
      header: 'Vehicle',
      cell: ({ original }) => original.vehicle_info || '—',
    },
    {
      accessorKey: 'active_deliveries',
      header: 'Active Deliveries',
      cell: ({ original }) => (
        <Badge variant={original.active_deliveries ? 'default' : 'secondary'}>
          {original.active_deliveries ?? 0}
        </Badge>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ original }) => <StatusBadge status={original.status} />,
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ original }) => (
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (tenant?.slug) { navigate(`/${tenant.slug}/admin/fulfillment-hub?tab=fleet&runner=${original.id}`); }
            }}
          >
            <MapPin className="h-4 w-4 mr-1" />
            Track
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="container mx-auto p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold mb-2">Runners & Vehicles</h1>
          <p className="text-muted-foreground">
            Manage delivery runners, track active deliveries, and monitor fleet operations
          </p>
        </div>
        <AddRunnerDialog />
      </div>

      <Card className="p-6">
        <DataTable
          columns={columns}
          data={runners ?? []}
          loading={isLoading}
          emptyMessage="No runners found. Add your first delivery runner!"
        />
      </Card>

      {/* Runner Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="text-sm text-muted-foreground mb-1">Total Runners</div>
          <div className="text-2xl font-bold">{runners?.length ?? 0}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground mb-1">Active Runners</div>
          <div className="text-2xl font-bold">
            {runners?.filter((r) => r.status === 'active').length ?? 0}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground mb-1">On Delivery</div>
          <div className="text-2xl font-bold">
            {runners?.filter((r) => (r.active_deliveries ?? 0) > 0).length ?? 0}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground mb-1">Total Active Deliveries</div>
          <div className="text-2xl font-bold">
            {runners?.reduce((sum, r) => sum + (r.active_deliveries ?? 0), 0) ?? 0}
          </div>
        </Card>
      </div>
    </div>
  );
}

