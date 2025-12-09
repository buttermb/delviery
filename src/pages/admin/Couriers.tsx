import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ResponsiveTable, ResponsiveColumn } from '@/components/shared/ResponsiveTable';
import { SearchInput } from '@/components/shared/SearchInput';
import { Users, TrendingUp, Star, Eye, Plus } from 'lucide-react';
import { SEOHead } from '@/components/SEOHead';
import { CourierLoginInfo } from '@/components/admin/CourierLoginInfo';
import { PullToRefresh } from '@/components/mobile/PullToRefresh';
import { AddCourierDialog } from '@/components/admin/AddCourierDialog';

interface Courier {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  vehicle_type: string;
  is_online: boolean;
  is_active: boolean;
  rating: number;
  total_deliveries: number;
  commission_rate: number;
}

export default function Couriers() {
  const navigate = useNavigate();
  const { tenant } = useTenantAdminAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddCourierOpen, setIsAddCourierOpen] = useState(false);

  const { data: couriers = [], isLoading, refetch } = useQuery({
    queryKey: ['couriers', tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) return [];
      const { data, error } = await supabase
        .from('couriers')
        .select('*')
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Courier[];
    },
    enabled: !!tenant?.id,
  });

  const filteredCouriers = couriers.filter(courier =>
    courier.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    courier.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    courier.phone?.includes(searchQuery)
  );

  const stats = [
    { label: 'Total Couriers', value: couriers.length, icon: Users, color: 'text-accent' },
    { label: 'Online Now', value: couriers.filter(c => c.is_online).length, icon: TrendingUp, color: 'text-primary' },
    { label: 'Active', value: couriers.filter(c => c.is_active).length, icon: Star, color: 'text-primary' },
    { label: 'Avg Rating', value: (couriers.reduce((acc, c) => acc + (c.rating || 0), 0) / couriers.length || 0).toFixed(1), icon: Star, color: 'text-accent' },
  ];

  const columns: ResponsiveColumn<Courier>[] = [
    {
      header: 'Name',
      accessorKey: 'full_name',
      className: 'font-medium'
    },
    {
      header: 'Contact',
      cell: (courier) => (
        <div>
          <p className="text-sm">{courier.email}</p>
          <p className="text-sm text-muted-foreground">{courier.phone}</p>
        </div>
      )
    },
    {
      header: 'Vehicle',
      accessorKey: 'vehicle_type',
      className: 'capitalize'
    },
    {
      header: 'Status',
      cell: (courier) => (
        <div className="flex flex-wrap gap-2">
          {courier.is_online && <Badge variant="default">Online</Badge>}
          {!courier.is_active && <Badge variant="destructive">Inactive</Badge>}
        </div>
      )
    },
    {
      header: 'Rating',
      cell: (courier) => (
        <div className="flex items-center gap-1">
          <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />
          {courier.rating?.toFixed(1) || '5.0'}
        </div>
      )
    },
    {
      header: 'Deliveries',
      accessorKey: 'total_deliveries'
    },
    {
      header: 'Commission',
      cell: (courier) => `${courier.commission_rate}%`
    },
    {
      header: 'Actions',
      cell: (courier) => (
        <Button
          size="sm"
          variant="ghost"
          className="min-h-[48px] min-w-[48px]"
          onClick={() => tenant?.slug && navigate(`/${tenant.slug}/admin/couriers/${courier.id}`)}
        >
          <Eye className="h-4 w-4" />
        </Button>
      )
    }
  ];

  return (
    <>
      <SEOHead
        title="Couriers Management | Admin"
        description="Manage delivery couriers"
      />

      <PullToRefresh onRefresh={async () => { await refetch(); }}>
        <div className="w-full max-w-full px-3 sm:px-4 md:px-6 py-3 sm:py-4 md:py-6 space-y-4 md:space-y-6 overflow-x-hidden">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
            <h1 className="text-2xl sm:text-3xl font-bold">Couriers Management</h1>
            <AddCourierDialog
              open={isAddCourierOpen}
              onOpenChange={setIsAddCourierOpen}
              onSuccess={refetch}
            />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            {stats.map((stat) => {
              const Icon = stat.icon;
              return (
                <Card key={stat.label} className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">{stat.label}</p>
                      <p className="text-2xl font-bold">{stat.value}</p>
                    </div>
                    <Icon className={`h-8 w-8 ${stat.color}`} />
                  </div>
                </Card>
              );
            })}
          </div>

          <CourierLoginInfo />

          <Card className="p-3 sm:p-4">
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-4">
              <div className="relative flex-1">
                <SearchInput
                  placeholder="Search by name, email, or phone..."
                  onSearch={setSearchQuery}
                  defaultValue={searchQuery}
                />
              </div>
            </div>

            <ResponsiveTable
              columns={columns}
              data={filteredCouriers}
              isLoading={isLoading}
              keyExtractor={(item) => item.id}
              emptyState={{
                icon: Users,
                title: searchQuery ? "No Couriers Found" : "No Couriers Yet",
                description: searchQuery ? "No couriers match your search." : "Add your first courier to get started.",
                primaryAction: !searchQuery ? {
                  label: "Add Courier",
                  onClick: () => setIsAddCourierOpen(true),
                  icon: Plus
                } : undefined,
                compact: true
              }}
              mobileRenderer={(courier) => (
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-base">{courier.full_name}</h3>
                      <p className="text-sm text-muted-foreground capitalize">{courier.vehicle_type}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="min-h-[48px] min-w-[48px]"
                      onClick={() => navigate(`/admin/couriers/${courier.id}`)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="space-y-2 pt-2 border-t">
                    <div className="flex flex-col gap-1">
                      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Contact</div>
                      <div className="text-sm">
                        <p>{courier.email}</p>
                        <p className="text-muted-foreground">{courier.phone}</p>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1">
                      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</div>
                      <div className="flex flex-wrap gap-2">
                        {courier.is_online && <Badge variant="default">Online</Badge>}
                        {!courier.is_active && <Badge variant="destructive">Inactive</Badge>}
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div className="flex flex-col gap-1">
                        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Rating</div>
                        <div className="flex items-center gap-1">
                          <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />
                          <span className="text-sm">{courier.rating?.toFixed(1) || '5.0'}</span>
                        </div>
                      </div>
                      <div className="flex flex-col gap-1">
                        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Deliveries</div>
                        <div className="text-sm">{courier.total_deliveries || 0}</div>
                      </div>
                      <div className="flex flex-col gap-1">
                        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Commission</div>
                        <div className="text-sm">{courier.commission_rate}%</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            />
          </Card>
        </div>
      </PullToRefresh>
    </>
  );
}
