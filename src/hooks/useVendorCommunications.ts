/**
 * Vendor Communications Hook
 *
 * Manages communication logs for vendors including CRUD operations,
 * filtering, and search functionality.
 */

import { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { toast } from 'sonner';

import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';

// ============================================================================
// Types
// ============================================================================

export type CommunicationType = 'call' | 'email' | 'meeting' | 'note' | 'other';

export interface VendorCommunicationLog {
  id: string;
  tenant_id: string;
  vendor_id: string;
  communication_type: CommunicationType;
  subject: string | null;
  content: string;
  purchase_order_id: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  created_by: string | null;
  created_by_name: string | null;
  communication_date: string;
  created_at: string;
  updated_at: string;
  // Joined data
  purchase_order?: {
    id: string;
    po_number: string;
  } | null;
}

export interface CreateCommunicationInput {
  vendor_id: string;
  communication_type: CommunicationType;
  subject?: string;
  content: string;
  purchase_order_id?: string;
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
  communication_date?: string;
}

export interface UpdateCommunicationInput {
  id: string;
  communication_type?: CommunicationType;
  subject?: string;
  content?: string;
  purchase_order_id?: string | null;
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
  communication_date?: string;
}

export interface CommunicationFilters {
  type?: CommunicationType;
  startDate?: string;
  endDate?: string;
  searchQuery?: string;
}

// ============================================================================
// Constants
// ============================================================================

export const COMMUNICATION_TYPE_LABELS: Record<CommunicationType, string> = {
  call: 'Phone Call',
  email: 'Email',
  meeting: 'Meeting',
  note: 'Note',
  other: 'Other',
};

export const COMMUNICATION_TYPE_OPTIONS = Object.entries(COMMUNICATION_TYPE_LABELS).map(
  ([value, label]) => ({
    value: value as CommunicationType,
    label,
  })
);

// ============================================================================
// Hook: useVendorCommunications
// ============================================================================

export function useVendorCommunications(vendorId: string) {
  const { tenant, admin: user } = useTenantAdminAuth();
  const queryClient = useQueryClient();
  const tenantId = tenant?.id;

  // Local state for filters
  const [filters, setFilters] = useState<CommunicationFilters>({});

  // Fetch all communication logs for a vendor
  const communicationsQuery = useQuery({
    queryKey: queryKeys.vendors.communications(tenantId || '', vendorId),
    queryFn: async (): Promise<VendorCommunicationLog[]> => {
      if (!tenantId) {
        throw new Error('No tenant context');
      }

      const { data, error } = await (supabase as any)
        .from('vendor_communication_logs')
        .select(`
          *,
          purchase_order:purchase_orders(id, po_number)
        `)
        .eq('tenant_id', tenantId)
        .eq('vendor_id', vendorId)
        .order('communication_date', { ascending: false });

      if (error) {
        logger.error('Failed to fetch vendor communications', error, {
          component: 'useVendorCommunications',
          tenantId,
          vendorId,
        });
        throw error;
      }

      return (data ?? []) as VendorCommunicationLog[];
    },
    enabled: !!tenantId && !!vendorId,
  });

  // Filter communications client-side
  const filteredCommunications = useMemo(() => {
    if (!communicationsQuery.data) return [];

    let result = [...communicationsQuery.data];

    // Filter by type
    if (filters.type) {
      result = result.filter((c) => c.communication_type === filters.type);
    }

    // Filter by date range
    if (filters.startDate) {
      const start = new Date(filters.startDate);
      result = result.filter(
        (c) => new Date(c.communication_date) >= start
      );
    }

    if (filters.endDate) {
      const end = new Date(filters.endDate);
      end.setHours(23, 59, 59, 999);
      result = result.filter(
        (c) => new Date(c.communication_date) <= end
      );
    }

    // Filter by search query
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      result = result.filter(
        (c) =>
          c.content.toLowerCase().includes(query) ||
          (c.subject && c.subject.toLowerCase().includes(query)) ||
          (c.contact_name && c.contact_name.toLowerCase().includes(query))
      );
    }

    return result;
  }, [communicationsQuery.data, filters]);

  // Create communication mutation
  const createCommunicationMutation = useMutation({
    mutationFn: async (input: CreateCommunicationInput): Promise<VendorCommunicationLog> => {
      if (!tenantId) {
        throw new Error('No tenant context');
      }

      // Get user name for created_by_name
      let createdByName: string | null = null;
      if (user?.id) {
        const { data: profile } = await (supabase as any)
          .from('tenant_users')
          .select('full_name')
          .eq('user_id', user.id)
          .eq('tenant_id', tenantId)
          .maybeSingle();
        createdByName = (profile as any)?.full_name ?? user.email ?? null;
      }

      const { data, error } = await (supabase as any)
        .from('vendor_communication_logs')
        .insert({
          tenant_id: tenantId,
          vendor_id: input.vendor_id,
          communication_type: input.communication_type,
          subject: input.subject ?? null,
          content: input.content,
          purchase_order_id: input.purchase_order_id ?? null,
          contact_name: input.contact_name ?? null,
          contact_email: input.contact_email ?? null,
          contact_phone: input.contact_phone ?? null,
          communication_date: input.communication_date ?? new Date().toISOString(),
          created_by: user?.id ?? null,
          created_by_name: createdByName,
        })
        .select(`
          *,
          purchase_order:purchase_orders(id, po_number)
        `)
        .single();

      if (error) {
        logger.error('Failed to create vendor communication', error, {
          component: 'useVendorCommunications',
          tenantId,
          vendorId: input.vendor_id,
        });
        throw error;
      }

      return data as VendorCommunicationLog;
    },
    onSuccess: () => {
      toast.success('Communication logged successfully');
      queryClient.invalidateQueries({
        queryKey: queryKeys.vendors.communications(tenantId || '', vendorId),
      });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to log communication');
    },
  });

  // Update communication mutation
  const updateCommunicationMutation = useMutation({
    mutationFn: async (input: UpdateCommunicationInput): Promise<VendorCommunicationLog> => {
      if (!tenantId) {
        throw new Error('No tenant context');
      }

      const updateData: Record<string, unknown> = {};
      if (input.communication_type !== undefined) updateData.communication_type = input.communication_type;
      if (input.subject !== undefined) updateData.subject = input.subject;
      if (input.content !== undefined) updateData.content = input.content;
      if (input.purchase_order_id !== undefined) updateData.purchase_order_id = input.purchase_order_id;
      if (input.contact_name !== undefined) updateData.contact_name = input.contact_name;
      if (input.contact_email !== undefined) updateData.contact_email = input.contact_email;
      if (input.contact_phone !== undefined) updateData.contact_phone = input.contact_phone;
      if (input.communication_date !== undefined) updateData.communication_date = input.communication_date;

      const { data, error } = await (supabase as any)
        .from('vendor_communication_logs')
        .update(updateData)
        .eq('id', input.id)
        .eq('tenant_id', tenantId)
        .select(`
          *,
          purchase_order:purchase_orders(id, po_number)
        `)
        .single();

      if (error) {
        logger.error('Failed to update vendor communication', error, {
          component: 'useVendorCommunications',
          tenantId,
          communicationId: input.id,
        });
        throw error;
      }

      return data as VendorCommunicationLog;
    },
    onSuccess: () => {
      toast.success('Communication updated successfully');
      queryClient.invalidateQueries({
        queryKey: queryKeys.vendors.communications(tenantId || '', vendorId),
      });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to update communication');
    },
  });

  // Delete communication mutation
  const deleteCommunicationMutation = useMutation({
    mutationFn: async (communicationId: string): Promise<void> => {
      if (!tenantId) {
        throw new Error('No tenant context');
      }

      const { error } = await (supabase as any)
        .from('vendor_communication_logs')
        .delete()
        .eq('id', communicationId)
        .eq('tenant_id', tenantId);

      if (error) {
        logger.error('Failed to delete vendor communication', error, {
          component: 'useVendorCommunications',
          tenantId,
          communicationId,
        });
        throw error;
      }
    },
    onSuccess: () => {
      toast.success('Communication deleted successfully');
      queryClient.invalidateQueries({
        queryKey: queryKeys.vendors.communications(tenantId || '', vendorId),
      });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to delete communication');
    },
  });

  // Filter handlers
  const updateFilters = useCallback((newFilters: Partial<CommunicationFilters>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({});
  }, []);

  return {
    // Query data
    communications: communicationsQuery.data ?? [],
    filteredCommunications,
    isLoading: communicationsQuery.isLoading,
    isError: communicationsQuery.isError,
    error: communicationsQuery.error,

    // Filters
    filters,
    updateFilters,
    clearFilters,

    // Mutations
    createCommunication: createCommunicationMutation.mutateAsync,
    updateCommunication: updateCommunicationMutation.mutateAsync,
    deleteCommunication: deleteCommunicationMutation.mutateAsync,

    // Mutation states
    isCreating: createCommunicationMutation.isPending,
    isUpdating: updateCommunicationMutation.isPending,
    isDeleting: deleteCommunicationMutation.isPending,
  };
}

// ============================================================================
// Hook: useVendorPurchaseOrders (for PO dropdown)
// ============================================================================

export function useVendorPurchaseOrders(vendorId: string) {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;

  return useQuery({
    queryKey: queryKeys.vendors.orders(tenantId || '', vendorId),
    queryFn: async () => {
      if (!tenantId) {
        throw new Error('No tenant context');
      }

      const { data, error } = await (supabase as any)
        .from('purchase_orders')
        .select('id, po_number, status, created_at')
        .eq('tenant_id', tenantId)
        .eq('vendor_id', vendorId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        logger.error('Failed to fetch vendor purchase orders', error, {
          component: 'useVendorPurchaseOrders',
          tenantId,
          vendorId,
        });
        throw error;
      }

      return data ?? [];
    },
    enabled: !!tenantId && !!vendorId,
  });
}
