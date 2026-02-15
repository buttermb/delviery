/**
 * Delivery Zones Hook
 * Provides CRUD operations for delivery zones with TanStack Query
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { useTenantContext } from '@/hooks/useTenantContext';
import type { DeliveryZone, DeliveryZoneFormData, DEFAULT_DELIVERY_HOURS } from '@/types/delivery-zone';

const QUERY_KEY = 'delivery-zones';

/**
 * Hook for managing delivery zones
 */
export function useDeliveryZones() {
  const { tenantId, userId } = useTenantContext();
  const queryClient = useQueryClient();

  // Fetch all zones for tenant
  const {
    data: zones = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: [QUERY_KEY, tenantId],
    queryFn: async () => {
      if (!tenantId) return [];

      const { data, error } = await (supabase as any)
        .from('delivery_zones')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('priority', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) {
        logger.error('Failed to fetch delivery zones', error);
        throw error;
      }

      return (data || []) as DeliveryZone[];
    },
    enabled: !!tenantId,
  });

  // Fetch single zone by ID
  const fetchZone = async (zoneId: string): Promise<DeliveryZone | null> => {
    if (!tenantId) return null;

    const { data, error } = await (supabase as any)
      .from('delivery_zones')
      .select('*')
      .eq('id', zoneId)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (error) {
      logger.error('Failed to fetch delivery zone', error);
      throw error;
    }

    return data as DeliveryZone | null;
  };

  // Create zone mutation
  const createZoneMutation = useMutation({
    mutationFn: async (formData: DeliveryZoneFormData) => {
      if (!tenantId) throw new Error('No tenant context');

      const { data, error } = await (supabase as any)
        .from('delivery_zones')
        .insert({
          tenant_id: tenantId,
          name: formData.name,
          description: formData.description || null,
          color: formData.color,
          polygon: formData.polygon,
          zip_codes: formData.zip_codes,
          delivery_fee: formData.delivery_fee,
          minimum_order: formData.minimum_order,
          delivery_hours: formData.delivery_hours,
          estimated_time_min: formData.estimated_time_min,
          estimated_time_max: formData.estimated_time_max,
          is_active: formData.is_active,
          priority: formData.priority,
          created_by: userId,
        })
        .select()
        .single();

      if (error) {
        logger.error('Failed to create delivery zone', error);
        throw error;
      }

      return data as DeliveryZone;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY, tenantId] });
    },
  });

  // Update zone mutation
  const updateZoneMutation = useMutation({
    mutationFn: async ({
      zoneId,
      formData,
    }: {
      zoneId: string;
      formData: Partial<DeliveryZoneFormData>;
    }) => {
      if (!tenantId) throw new Error('No tenant context');

      const { data, error } = await (supabase as any)
        .from('delivery_zones')
        .update({
          ...formData,
          updated_at: new Date().toISOString(),
        })
        .eq('id', zoneId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        logger.error('Failed to update delivery zone', error);
        throw error;
      }

      return data as DeliveryZone;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY, tenantId] });
    },
  });

  // Delete zone mutation
  const deleteZoneMutation = useMutation({
    mutationFn: async (zoneId: string) => {
      if (!tenantId) throw new Error('No tenant context');

      const { error } = await (supabase as any)
        .from('delivery_zones')
        .delete()
        .eq('id', zoneId)
        .eq('tenant_id', tenantId);

      if (error) {
        logger.error('Failed to delete delivery zone', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY, tenantId] });
    },
  });

  // Toggle zone active status
  const toggleZoneMutation = useMutation({
    mutationFn: async ({ zoneId, isActive }: { zoneId: string; isActive: boolean }) => {
      if (!tenantId) throw new Error('No tenant context');

      const { error } = await (supabase as any)
        .from('delivery_zones')
        .update({ is_active: isActive, updated_at: new Date().toISOString() })
        .eq('id', zoneId)
        .eq('tenant_id', tenantId);

      if (error) {
        logger.error('Failed to toggle delivery zone', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY, tenantId] });
    },
  });

  return {
    // Data
    zones,
    isLoading,
    error,
    refetch,

    // Single zone fetch
    fetchZone,

    // Mutations
    createZone: createZoneMutation.mutateAsync,
    isCreating: createZoneMutation.isPending,
    createError: createZoneMutation.error,

    updateZone: updateZoneMutation.mutateAsync,
    isUpdating: updateZoneMutation.isPending,
    updateError: updateZoneMutation.error,

    deleteZone: deleteZoneMutation.mutateAsync,
    isDeleting: deleteZoneMutation.isPending,
    deleteError: deleteZoneMutation.error,

    toggleZone: toggleZoneMutation.mutateAsync,
    isToggling: toggleZoneMutation.isPending,
  };
}

/**
 * Hook to check if an address/coordinates are within a delivery zone
 */
export function useZoneValidation() {
  const { tenantId } = useTenantContext();

  // Check zone by coordinates
  const checkByCoordinates = async (
    lat: number,
    lng: number
  ): Promise<{
    inZone: boolean;
    zone: DeliveryZone | null;
  }> => {
    if (!tenantId) return { inZone: false, zone: null };

    const { data, error } = await supabase.rpc('point_in_delivery_zone', {
      p_tenant_id: tenantId,
      p_lat: lat,
      p_lng: lng,
    });

    if (error) {
      logger.error('Failed to check zone by coordinates', error);
      return { inZone: false, zone: null };
    }

    if (data && data.length > 0) {
      return {
        inZone: true,
        zone: data[0] as unknown as DeliveryZone,
      };
    }

    return { inZone: false, zone: null };
  };

  // Check zone by ZIP code
  const checkByZipCode = async (
    zipCode: string
  ): Promise<{
    inZone: boolean;
    zone: DeliveryZone | null;
  }> => {
    if (!tenantId) return { inZone: false, zone: null };

    const { data, error } = await supabase.rpc('zip_in_delivery_zone', {
      p_tenant_id: tenantId,
      p_zip_code: zipCode,
    });

    if (error) {
      logger.error('Failed to check zone by ZIP code', error);
      return { inZone: false, zone: null };
    }

    if (data && data.length > 0) {
      return {
        inZone: true,
        zone: data[0] as unknown as DeliveryZone,
      };
    }

    return { inZone: false, zone: null };
  };

  return {
    checkByCoordinates,
    checkByZipCode,
  };
}

export default useDeliveryZones;
