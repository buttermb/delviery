/**
 * Customer Notes Hook
 *
 * Provides CRUD operations for customer notes including:
 * - Fetching notes with timeline view
 * - Adding/updating/deleting notes
 * - Pinning/unpinning notes
 * - Searching notes
 * - Linking notes to orders
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import { escapePostgresLike } from '@/lib/utils/searchSanitize';
import { toast } from 'sonner';

// Types
export type NoteType = 'general' | 'preference' | 'medical' | 'complaint' | 'compliment' | 'followup';

export interface CustomerNote {
  id: string;
  tenant_id: string;
  account_id: string;
  customer_id: string;
  note: string;
  note_type: NoteType;
  is_internal: boolean;
  is_pinned: boolean;
  order_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  author?: {
    full_name: string | null;
    email: string | null;
  };
  order?: {
    id: string;
    status: string;
    total_amount: number;
  };
}

export interface CreateNoteInput {
  customer_id: string;
  note: string;
  note_type?: NoteType;
  is_internal?: boolean;
  order_id?: string | null;
}

export interface UpdateNoteInput {
  id: string;
  note?: string;
  note_type?: NoteType;
  is_pinned?: boolean;
}

/**
 * Hook to fetch all notes for a customer
 */
export function useCustomerNotes(customerId: string | undefined) {
  const { tenant, admin } = useTenantAdminAuth();

  return useQuery({
    queryKey: queryKeys.customerNotes.byCustomer(customerId || '', tenant?.id),
    queryFn: async () => {
      if (!tenant?.id || !customerId) throw new Error('No tenant or customer');

      const { data, error } = await (supabase as any)
        .from('customer_notes')
        .select(`
          *,
          author:profiles!customer_notes_created_by_fkey(full_name, email),
          order:orders(id, status, total_amount)
        `)
        .eq('tenant_id', tenant.id)
        .eq('customer_id', customerId)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) {
        logger.error('Failed to fetch customer notes', error, { customerId, tenantId: tenant.id });
        throw error;
      }

      return (data || []) as CustomerNote[];
    },
    enabled: !!tenant?.id && !!customerId,
    staleTime: 30000,
  });
}

/**
 * Hook to fetch pinned notes for a customer
 */
export function useCustomerPinnedNotes(customerId: string | undefined) {
  const { tenant } = useTenantAdminAuth();

  return useQuery({
    queryKey: queryKeys.customerNotes.pinned(customerId || '', tenant?.id),
    queryFn: async () => {
      if (!tenant?.id || !customerId) throw new Error('No tenant or customer');

      const { data, error } = await (supabase as any)
        .from('customer_notes')
        .select(`
          *,
          author:profiles!customer_notes_created_by_fkey(full_name, email)
        `)
        .eq('tenant_id', tenant.id)
        .eq('customer_id', customerId)
        .eq('is_pinned', true)
        .order('created_at', { ascending: false });

      if (error) {
        logger.error('Failed to fetch pinned customer notes', error, { customerId, tenantId: tenant.id });
        throw error;
      }

      return (data || []) as unknown as CustomerNote[];
    },
    enabled: !!tenant?.id && !!customerId,
    staleTime: 30000,
  });
}

/**
 * Hook to fetch notes linked to a specific order
 */
export function useOrderLinkedNotes(orderId: string | undefined) {
  const { tenant } = useTenantAdminAuth();

  return useQuery({
    queryKey: queryKeys.customerNotes.byOrder(orderId || ''),
    queryFn: async () => {
      if (!tenant?.id || !orderId) throw new Error('No tenant or order');

      const { data, error } = await (supabase as any)
        .from('customer_notes')
        .select(`
          *,
          author:profiles!customer_notes_created_by_fkey(full_name, email)
        `)
        .eq('tenant_id', tenant.id)
        .eq('order_id', orderId)
        .order('created_at', { ascending: false });

      if (error) {
        logger.error('Failed to fetch order-linked notes', error, { orderId, tenantId: tenant.id });
        throw error;
      }

      return (data || []) as unknown as CustomerNote[];
    },
    enabled: !!tenant?.id && !!orderId,
    staleTime: 30000,
  });
}

/**
 * Hook to search notes for a customer
 */
export function useSearchCustomerNotes(customerId: string | undefined, searchQuery: string) {
  const { tenant } = useTenantAdminAuth();

  return useQuery({
    queryKey: queryKeys.customerNotes.search(customerId || '', searchQuery, tenant?.id),
    queryFn: async () => {
      if (!tenant?.id || !customerId || !searchQuery.trim()) {
        return [];
      }

      const { data, error } = await (supabase as any)
        .from('customer_notes')
        .select(`
          *,
          author:profiles!customer_notes_created_by_fkey(full_name, email),
          order:orders(id, status, total_amount)
        `)
        .eq('tenant_id', tenant.id)
        .eq('customer_id', customerId)
        .ilike('note', `%${escapePostgresLike(searchQuery)}%`)
        .order('created_at', { ascending: false });

      if (error) {
        logger.error('Failed to search customer notes', error, { customerId, searchQuery, tenantId: tenant.id });
        throw error;
      }

      return (data || []) as unknown as CustomerNote[];
    },
    enabled: !!tenant?.id && !!customerId && searchQuery.trim().length > 0,
    staleTime: 10000,
  });
}

/**
 * Hook to create a new note
 */
export function useCreateCustomerNote() {
  const { tenant, admin } = useTenantAdminAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateNoteInput) => {
      if (!tenant?.id) throw new Error('No tenant');

      // Get account_id from customer
      const { data: customer, error: customerError } = await supabase
        .from('customers')
        .select('account_id')
        .eq('id', input.customer_id)
        .eq('tenant_id', tenant.id)
        .maybeSingle();

      if (customerError || !customer) {
        throw new Error('Customer not found');
      }

      const { data, error } = await (supabase as any)
        .from('customer_notes')
        .insert({
          tenant_id: tenant.id,
          account_id: customer.account_id,
          customer_id: input.customer_id,
          note: input.note.trim(),
          note_type: input.note_type || 'general',
          is_internal: input.is_internal ?? true,
          is_pinned: false,
          order_id: input.order_id || null,
          created_by: admin?.userId || null,
        })
        .select(`
          *,
          author:profiles!customer_notes_created_by_fkey(full_name, email)
        `)
        .maybeSingle();

      if (error) {
        logger.error('Failed to create customer note', error, { input, tenantId: tenant.id });
        throw error;
      }

      return data as unknown as CustomerNote;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.customerNotes.byCustomer(variables.customer_id, tenant?.id),
      });
      if (variables.order_id) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.customerNotes.byOrder(variables.order_id),
        });
      }
      toast.success('Note added successfully');
    },
    onError: (error) => {
      logger.error('Failed to create note', error);
      toast.error('Failed to add note');
    },
  });
}

/**
 * Hook to update a note
 */
export function useUpdateCustomerNote() {
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateNoteInput) => {
      if (!tenant?.id) throw new Error('No tenant');

      const updateData: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };
      if (input.note !== undefined) updateData.note = input.note.trim();
      if (input.note_type !== undefined) updateData.note_type = input.note_type;
      if (input.is_pinned !== undefined) updateData.is_pinned = input.is_pinned;

      const { data, error } = await (supabase as any)
        .from('customer_notes')
        .update(updateData)
        .eq('id', input.id)
        .eq('tenant_id', tenant.id)
        .select(`
          *,
          author:profiles!customer_notes_created_by_fkey(full_name, email)
        `)
        .maybeSingle();

      if (error) {
        logger.error('Failed to update customer note', error, { input, tenantId: tenant.id });
        throw error;
      }

      return data as unknown as CustomerNote;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.customerNotes.byCustomer(data.customer_id, tenant?.id),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.customerNotes.pinned(data.customer_id, tenant?.id),
      });
      if (data.order_id) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.customerNotes.byOrder(data.order_id),
        });
      }
      toast.success('Note updated successfully');
    },
    onError: (error) => {
      logger.error('Failed to update note', error);
      toast.error('Failed to update note');
    },
  });
}

/**
 * Hook to delete a note
 */
export function useDeleteCustomerNote() {
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ noteId, customerId, orderId }: { noteId: string; customerId: string; orderId?: string | null }) => {
      if (!tenant?.id) throw new Error('No tenant');

      const { error } = await (supabase as any)
        .from('customer_notes')
        .delete()
        .eq('id', noteId)
        .eq('tenant_id', tenant.id);

      if (error) {
        logger.error('Failed to delete customer note', error, { noteId, tenantId: tenant.id });
        throw error;
      }

      return { customerId, orderId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.customerNotes.byCustomer(data.customerId, tenant?.id),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.customerNotes.pinned(data.customerId, tenant?.id),
      });
      if (data.orderId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.customerNotes.byOrder(data.orderId),
        });
      }
      toast.success('Note deleted successfully');
    },
    onError: (error) => {
      logger.error('Failed to delete note', error);
      toast.error('Failed to delete note');
    },
  });
}

/**
 * Hook to toggle pin status of a note
 */
export function useTogglePinNote() {
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ noteId, isPinned, customerId }: { noteId: string; isPinned: boolean; customerId: string }) => {
      if (!tenant?.id) throw new Error('No tenant');

      const { data, error } = await (supabase as any)
        .from('customer_notes')
        .update({ is_pinned: !isPinned, updated_at: new Date().toISOString() })
        .eq('id', noteId)
        .eq('tenant_id', tenant.id)
        .select()
        .maybeSingle();

      if (error) {
        logger.error('Failed to toggle pin status', error, { noteId, tenantId: tenant.id });
        throw error;
      }

      return { ...data, customerId } as unknown as CustomerNote & { customerId: string };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.customerNotes.byCustomer(data.customerId, tenant?.id),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.customerNotes.pinned(data.customerId, tenant?.id),
      });
      toast.success(data.is_pinned ? 'Note pinned' : 'Note unpinned');
    },
    onError: (error) => {
      logger.error('Failed to toggle pin', error);
      toast.error('Failed to update pin status');
    },
  });
}
