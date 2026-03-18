import { useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useTenantNavigate } from '@/hooks/useTenantNavigate';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ResponsiveTable, ResponsiveColumn } from '@/components/shared/ResponsiveTable';
import { SearchInput } from '@/components/shared/SearchInput';
import { Users, Star, Eye, Plus, Trash2, Package, MapPin, UserCheck, Clock } from 'lucide-react';
import { SEOHead } from '@/components/SEOHead';
import { CourierLoginInfo } from '@/components/admin/CourierLoginInfo';
import { PullToRefresh } from '@/components/mobile/PullToRefresh';
import { AddCourierDialog } from '@/components/admin/AddCourierDialog';
import { ConfirmDeleteDialog } from '@/components/shared/ConfirmDeleteDialog';
import { toast } from 'sonner';
import { humanizeError } from '@/lib/humanizeError';
import { logger } from '@/lib/logger';
import { queryKeys } from '@/lib/queryKeys';

interface Courier {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  vehicle_type: string;
  is_online: boolean;
  is_active: boolean;
  age_verified: boolean;
  current_lat: number | null;
  current_lng: number | null;
  rating: number;
  total_deliveries: number;
  commission_rate: number;
}

type AvailabilityStatus = 'available' | 'offline' | 'inactive' | 'unverified';

function getAvailabilityStatus(courier: Courier): AvailabilityStatus {
  if (!courier.is_active) return 'inactive';
  if (!courier.age_verified) return 'unverified';
  if (!courier.is_online) return 'offline';
  return 'available';
}

export default function Couriers() {
  const navigate = useTenantNavigate();
  const { tenant } = useTenantAdminAuth();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddCourierOpen, setIsAddCourierOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [courierToDelete, setCourierToDelete] = useState<Courier | null>(null);

  const { data: couriers = [], isLoading, refetch } = useQuery({
    queryKey: queryKeys.couriersAdmin.byTenant(tenant?.id),
    queryFn: async () => {
      if (!tenant?.id) return [];
      const { data, error } = await supabase
        .from('couriers')
        .select('id, full_name, email, phone, vehicle_type, is_online, is_active, age_verified, current_lat, current_lng, rating, total_deliveries, commission_rate, created_at')
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Courier[];
    },
    enabled: !!tenant?.id,
  });

  const deleteMutation = useMutation({
    mutationFn: async (courierId: string) => {
      const { error } = await supabase
        .from('couriers')
        .delete()
        .eq('id', courierId)
        .eq('tenant_id', tenant?.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Courier deleted successfully');
      queryClient.invalidateQueries({ queryKey: queryKeys.couriersAdmin.byTenant(tenant?.id) });
      setDeleteDialogOpen(false);
      setCourierToDelete(null);
    },
    onError: (error) => {
      logger.error('Failed to delete courier', error instanceof Error ? error : new Error(String(error)));
      toast.error('Failed to delete courier', { description: humanizeError(error) });
    },
  });

  const handleDelete = (courier: Courier) => {
    setCourierToDelete(courier);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (courierToDelete) {
      deleteMutation.mutate(courierToDelete.id);
    }
  };

  const filteredCouriers = useMemo(() => couriers.filter(courier =>
    courier.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    courier.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    courier.phone?.includes(searchQuery)
  ), [couriers, searchQuery]);

  const { avgRating, availableForAssignment } = useMemo(() => {
    const avg = couriers.length > 0
      ? (couriers.reduce((acc, c) => acc + (c.rating ?? 0), 0) / couriers.length).toFixed(1)
      : '0.0';
    const available = couriers.filter(c =>
      c.is_online && c.is_active && c.age_verified
    ).length;
    return { avgRating: avg, availableForAssignment: available };
  }, [couriers]);

  const stats = useMemo(() => [
    { label: 'Total Couriers', value: couriers.length, icon: Users, color: 'text-accent' },
    { label: 'Available', value: availableForAssignment, icon: UserCheck, color: 'text-green-600' },
    { label: 'Offline', value: couriers.filter(c => c.is_active && !c.is_online).length, icon: Clock, color: 'text-muted-foreground' },
    { label: 'Avg Rating', value: avgRating, icon: Star, color: 'text-accent' },
  ], [couriers, availableForAssignment, avgRating]);

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
      header: 'Availability',
      cell: (courier) => {
        const status = getAvailabilityStatus(courier);
        const hasLocation = courier.current_lat !== null && courier.current_lng !== null;
        return (
          <div className="flex flex-wrap items-center gap-2">
            {status === 'available' && (
              <Badge variant="default" className="bg-green-600 hover:bg-green-600">
                <span className="relative flex h-2 w-2 mr-1">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-300 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-200"></span>
                </span>
                Available
              </Badge>
            )}
            {status === 'offline' && (
              <Badge variant="secondary">
                <Clock className="h-3 w-3 mr-1" />
                Offline
              </Badge>
            )}
            {status === 'inactive' && (
              <Badge variant="destructive">Inactive</Badge>
            )}
            {status === 'unverified' && (
              <Badge variant="outline" className="border-orange-500 text-orange-600">
                Unverified
              </Badge>
            )}
            {hasLocation && (
              <span title="GPS location available"><MapPin className="h-3 w-3 text-green-600" /></span>
            )}
          </div>
        );
      }
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
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            className="min-h-[44px] min-w-[44px]"
            onClick={() => navigate(`/${tenantSlug}/admin/couriers/${courier.id}`)}
          >
            <Eye className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="min-h-[44px] min-w-[44px] text-destructive hover:text-destructive"
            onClick={() => handleDelete(courier)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
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
        <div className="w-full max-w-full px-3 sm:px-4 md:px-4 py-3 sm:py-4 md:py-4 space-y-4 md:space-y-4 overflow-x-hidden">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
            <div>
              <h1 className="text-xl font-bold">Couriers Management</h1>
              <p className="text-sm text-muted-foreground mt-1">
                {availableForAssignment} courier{availableForAssignment !== 1 ? 's' : ''} available for assignment
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => navigate(`/${tenantSlug}/admin/fulfillment-hub?tab=pending`)}
              >
                <Package className="h-4 w-4 mr-2" />
                Assign to Orders
              </Button>
              <AddCourierDialog
                open={isAddCourierOpen}
                onOpenChange={setIsAddCourierOpen}
                onSuccess={refetch}
              />
            </div>
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

          <Card className="p-4 sm:p-6">
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
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="min-h-[44px] min-w-[44px]"
                        onClick={() => navigate(`/${tenantSlug}/admin/couriers/${courier.id}`)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="min-h-[44px] min-w-[44px] text-destructive hover:text-destructive"
                        onClick={() => handleDelete(courier)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
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
                      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Availability</div>
                      <div className="flex flex-wrap items-center gap-2">
                        {(() => {
                          const status = getAvailabilityStatus(courier);
                          const hasLocation = courier.current_lat !== null && courier.current_lng !== null;
                          return (
                            <>
                              {status === 'available' && (
                                <Badge variant="default" className="bg-green-600 hover:bg-green-600">
                                  <span className="relative flex h-2 w-2 mr-1">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-300 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-200"></span>
                                  </span>
                                  Available
                                </Badge>
                              )}
                              {status === 'offline' && (
                                <Badge variant="secondary">
                                  <Clock className="h-3 w-3 mr-1" />
                                  Offline
                                </Badge>
                              )}
                              {status === 'inactive' && <Badge variant="destructive">Inactive</Badge>}
                              {status === 'unverified' && (
                                <Badge variant="outline" className="border-orange-500 text-orange-600">
                                  Unverified
                                </Badge>
                              )}
                              {hasLocation && (
                                <span title="GPS location available"><MapPin className="h-3 w-3 text-green-600" /></span>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="flex flex-col gap-1">
                        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Rating</div>
                        <div className="flex items-center gap-1">
                          <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />
                          <span className="text-sm">{courier.rating?.toFixed(1) || '5.0'}</span>
                        </div>
                      </div>
                      <div className="flex flex-col gap-1">
                        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Deliveries</div>
                        <div className="text-sm">{courier.total_deliveries ?? 0}</div>
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

      <ConfirmDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={confirmDelete}
        isLoading={deleteMutation.isPending}
        title="Delete Courier"
        description={`Are you sure you want to delete ${courierToDelete?.full_name}? This action cannot be undone.`}
        itemName={courierToDelete?.full_name}
        itemType="courier"
      />
    </>
  );
}
