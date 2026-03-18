import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import { toast } from 'sonner';
import { humanizeError } from '@/lib/humanizeError';

export interface Location {
  id: string;
  tenant_id: string;
  account_id: string | null;
  name: string;
  address: string;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  phone: string | null;
  email: string | null;
  license_number: string | null;
  operating_hours: Record<string, unknown> | null;
  delivery_radius_miles: number | null;
  coordinates: Record<string, unknown> | null;
  status: 'active' | 'inactive' | 'pending';
  created_at: string;
  updated_at: string;
}

export interface LocationOperationsSummary {
  location_id: string;
  location_name: string;
  location_status: string;
  address: string | null;
  city: string | null;
  state: string | null;
  total_receiving_records: number;
  pending_receiving: number;
  completed_receiving: number;
  total_runners: number;
  active_runners: number;
  total_products: number;
  total_inventory_quantity: number;
  low_stock_products: number;
}

export interface CreateLocationInput {
  name: string;
  address: string;
  city?: string;
  state?: string;
  zip_code?: string;
  phone?: string;
  email?: string;
  license_number?: string;
  operating_hours?: Record<string, unknown>;
  delivery_radius_miles?: number;
  coordinates?: Record<string, unknown>;
  status?: 'active' | 'inactive' | 'pending';
}

export interface UpdateLocationInput extends Partial<CreateLocationInput> {
  id: string;
}

export const useLocations = (filters?: { status?: string }) => {
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();

  // Fetch all locations for the tenant
  const locationsQuery = useQuery({
    queryKey: queryKeys.locations.list(tenant?.id, filters as Record<string, unknown>),
    queryFn: async () => {
      if (!tenant?.id) return [];

      let query = supabase
        .from('locations')
        .select('id, tenant_id, account_id, name, address, city, state, zip_code, phone, email, license_number, operating_hours, delivery_radius_miles, coordinates, status, created_at, updated_at')
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false });

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }

      const { data, error } = await query;
      if (error) {
        logger.error('Failed to fetch locations', { error, tenantId: tenant.id });
        throw error;
      }
      return (data ?? []) as Location[];
    },
    enabled: !!tenant?.id,
  });

  // Fetch operations summary for locations
  const operationsSummaryQuery = useQuery({
    queryKey: queryKeys.locations.operationsSummary(tenant?.id ?? ''),
    queryFn: async () => {
      if (!tenant?.id) return [];

      // Try to use the RPC function if available, otherwise compute manually
      try {
        const { data, error } = await supabase.rpc('get_location_operations_summary', {
          p_tenant_id: tenant.id,
        });

        if (error) {
          logger.warn('get_location_operations_summary RPC failed, computing manually', {
            component: 'useLocations',
            error,
          });
        }
        if (!error && data) {
          return data as unknown as LocationOperationsSummary[];
        }
      } catch {
        // RPC not available, fall back to manual computation
        logger.warn('get_location_operations_summary RPC not available, computing manually');
      }

      // Fallback: compute summary manually
      const locations = locationsQuery.data ?? [];
      if (locations.length === 0) return [];

      const summaries: LocationOperationsSummary[] = [];

      for (const location of locations) {
        // Get receiving records count for this location
        const { count: totalReceiving } = await supabase
          .from('receiving_records')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenant.id)
          .eq('location_id', location.id);

        const { count: pendingReceiving } = await supabase
          .from('receiving_records')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenant.id)
          .eq('location_id', location.id)
          .eq('status', 'in_progress');

        // Get runners count for this location
        const { count: totalRunners } = await supabase
          .from('wholesale_runners')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenant.id)
          .eq('home_location_id', location.id);

        const { count: activeRunners } = await supabase
          .from('wholesale_runners')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenant.id)
          .eq('home_location_id', location.id)
          .eq('status', 'active');

        // Get inventory stats for this location
        const { data: inventoryData } = await supabase
          .from('location_inventory')
          .select('quantity, reserved_quantity, reorder_point')
          .eq('location_id', location.id);

        const inventory = (inventoryData ?? []) as Array<{ quantity: number; reserved_quantity: number; reorder_point: number }>;
        const totalProducts = inventory.length;
        const totalQuantity = inventory.reduce((sum, i) => sum + (i.quantity || 0), 0);
        const lowStockProducts = inventory.filter(
          (i) => i.reorder_point && i.quantity <= i.reorder_point
        ).length;

        summaries.push({
          location_id: location.id,
          location_name: location.name,
          location_status: location.status,
          address: location.address,
          city: location.city,
          state: location.state,
          total_receiving_records: totalReceiving ?? 0,
          pending_receiving: pendingReceiving ?? 0,
          completed_receiving: (totalReceiving ?? 0) - (pendingReceiving ?? 0),
          total_runners: totalRunners ?? 0,
          active_runners: activeRunners ?? 0,
          total_products: totalProducts,
          total_inventory_quantity: totalQuantity,
          low_stock_products: lowStockProducts,
        });
      }

      return summaries;
    },
    enabled: !!tenant?.id && (locationsQuery.data?.length ?? 0) > 0,
  });

  // Create a new location
  const createLocationMutation = useMutation({
    mutationFn: async (input: CreateLocationInput) => {
      if (!tenant?.id) throw new Error('No tenant');

      const { data, error } = await supabase
        .from('locations')
        .insert([{
          ...input,
          tenant_id: tenant.id,
          coordinates: input.coordinates ? JSON.stringify(input.coordinates) : null,
          operating_hours: input.operating_hours ? JSON.stringify(input.operating_hours) : null,
          status: input.status || 'active',
        }])
        .select()
        .maybeSingle();

      if (error) {
        logger.error('Failed to create location', { error, input });
        throw error;
      }
      return data as Location;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.locations.all });
      toast.success('Location created successfully');
    },
    onError: (error) => {
      logger.error('Create location error', { error });
      toast.error('Failed to create location', { description: humanizeError(error) });
    },
  });

  // Update an existing location
  const updateLocationMutation = useMutation({
    mutationFn: async ({ id, ...input }: UpdateLocationInput) => {
      if (!tenant?.id) throw new Error('No tenant');

      const updatePayload = {
        ...input,
        coordinates: input.coordinates ? JSON.stringify(input.coordinates) : undefined,
        operating_hours: input.operating_hours ? JSON.stringify(input.operating_hours) : undefined,
      };

      const { data, error } = await supabase
        .from('locations')
        .update(updatePayload)
        .eq('id', id)
        .eq('tenant_id', tenant.id)
        .select()
        .maybeSingle();

      if (error) {
        logger.error('Failed to update location', { error, id, input });
        throw error;
      }
      return data as Location;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.locations.all });
      toast.success('Location updated successfully');
    },
    onError: (error) => {
      logger.error('Update location error', { error });
      toast.error('Failed to update location', { description: humanizeError(error) });
    },
  });

  // Delete a location
  const deleteLocationMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!tenant?.id) throw new Error('No tenant');

      const { error } = await supabase
        .from('locations')
        .delete()
        .eq('id', id)
        .eq('tenant_id', tenant.id);

      if (error) {
        logger.error('Failed to delete location', { error, id });
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.locations.all });
      toast.success('Location deleted successfully');
    },
    onError: (error) => {
      logger.error('Delete location error', { error });
      toast.error('Failed to delete location', { description: humanizeError(error) });
    },
  });

  // Get a single location by ID
  const getLocationById = (id: string) => {
    return locationsQuery.data?.find((loc) => loc.id === id);
  };

  // Get operations summary for a specific location
  const getLocationSummary = (locationId: string) => {
    return operationsSummaryQuery.data?.find((s) => s.location_id === locationId);
  };

  return {
    locations: locationsQuery.data ?? [],
    operationsSummary: operationsSummaryQuery.data ?? [],
    isLoading: locationsQuery.isLoading,
    isSummaryLoading: operationsSummaryQuery.isLoading,
    error: locationsQuery.error,
    summaryError: operationsSummaryQuery.error,
    getLocationById,
    getLocationSummary,
    createLocation: createLocationMutation.mutate,
    updateLocation: updateLocationMutation.mutate,
    deleteLocation: deleteLocationMutation.mutate,
    isCreating: createLocationMutation.isPending,
    isUpdating: updateLocationMutation.isPending,
    isDeleting: deleteLocationMutation.isPending,
    refetch: () => {
      locationsQuery.refetch();
      operationsSummaryQuery.refetch();
    },
  };
};

// Hook to get locations for dropdown/select components
export const useLocationOptions = () => {
  const { locations, isLoading, error, refetch } = useLocations({ status: 'active' });

  const options = locations.map((loc) => ({
    value: loc.id,
    label: loc.name,
    description: `${loc.city ?? ''}${loc.city && loc.state ? ', ' : ''}${loc.state ?? ''}`,
  }));

  return {
    options,
    isLoading,
    isError: !!error,
    error,
    refetch,
  };
};
