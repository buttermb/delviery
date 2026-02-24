/**
 * Hook for fetching pinned order notes for the dashboard "Requires Attention" section
 *
 * Pinned notes indicate orders that need special attention:
 * - Wrong address
 * - Customer callback needed
 * - Product substitution required
 * - Other flagged issues
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import { toast } from 'sonner';
import { humanizeError } from '@/lib/humanizeError';

/** Pinned order note from the database */
export interface PinnedOrderNote {
  id: string;
  tenant_id: string;
  order_id: string;
  user_id: string;
  content: string;
  is_pinned: boolean;
  pinned_at: string | null;
  pinned_by: string | null;
  pin_reason: string | null;
  created_at: string;
  // Joined user info
  user?: {
    user_id: string;
    full_name: string | null;
    first_name: string | null;
    last_name: string | null;
    avatar_url: string | null;
    email: string;
  } | null;
  // Joined order info
  order?: {
    id: string;
    order_number?: string | null;
    status?: string | null;
    customer_name?: string | null;
  } | null;
}

/** Pin reason options */
export const PIN_REASONS = [
  { value: 'wrong_address', label: 'Wrong Address' },
  { value: 'callback_needed', label: 'Customer Callback Needed' },
  { value: 'substitution_required', label: 'Product Substitution Required' },
  { value: 'payment_issue', label: 'Payment Issue' },
  { value: 'delivery_issue', label: 'Delivery Issue' },
  { value: 'custom', label: 'Other' },
] as const;

export type PinReason = typeof PIN_REASONS[number]['value'];

export function usePinnedOrderNotes() {
  const { tenant, admin } = useTenantAdminAuth();
  const queryClient = useQueryClient();
  const tenantId = tenant?.id;
  const currentUserId = admin?.id;

  // Fetch pinned notes
  const { data: pinnedNotes = [], isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.orderNotes.pinned(tenantId),
    queryFn: async (): Promise<PinnedOrderNote[]> => {
      if (!tenantId) return [];

      // Query order_notes with is_pinned = true
      const { data, error: fetchError } = await supabase
        .from('order_notes')
        .select(`
          id,
          tenant_id,
          order_id,
          user_id,
          content,
          is_pinned,
          pinned_at,
          pinned_by,
          pin_reason,
          created_at,
          user:tenant_users!order_notes_user_id_fkey(user_id, full_name, first_name, last_name, avatar_url, email),
          order:orders!order_notes_order_id_fkey(id, order_number, status, customer_name)
        `)
        .eq('tenant_id', tenantId)
        .eq('is_pinned', true)
        .order('pinned_at', { ascending: false })
        .limit(20);

      if (fetchError) {
        // Table might not exist or column might not exist yet
        if ((fetchError as { code?: string }).code === '42P01' ||
            (fetchError as { code?: string }).code === '42703') {
          logger.debug('order_notes table or is_pinned column does not exist yet', {
            component: 'usePinnedOrderNotes',
          });
          return [];
        }
        logger.error('Failed to fetch pinned order notes', fetchError as Error, {
          component: 'usePinnedOrderNotes',
        });
        return [];
      }

      return (data || []) as PinnedOrderNote[];
    },
    enabled: !!tenantId,
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // Refetch every minute
  });

  // Pin a note mutation
  const pinNoteMutation = useMutation({
    mutationFn: async ({ noteId, reason }: { noteId: string; reason?: PinReason }): Promise<void> => {
      if (!tenantId || !currentUserId) {
        throw new Error('Missing required data');
      }

      const { error: updateError } = await supabase
        .from('order_notes')
        .update({
          is_pinned: true,
          pinned_at: new Date().toISOString(),
          pinned_by: currentUserId,
          pin_reason: reason || null,
        })
        .eq('id', noteId)
        .eq('tenant_id', tenantId);

      if (updateError) throw updateError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.orderNotes.pinned(tenantId) });
      toast.success('Note pinned to dashboard');
    },
    onError: (err) => {
      logger.error('Failed to pin order note', err, {
        component: 'usePinnedOrderNotes',
      });
      toast.error('Failed to pin note', { description: humanizeError(err) });
    },
  });

  // Unpin a note mutation
  const unpinNoteMutation = useMutation({
    mutationFn: async (noteId: string): Promise<void> => {
      if (!tenantId) {
        throw new Error('Missing tenant ID');
      }

      const { error: updateError } = await supabase
        .from('order_notes')
        .update({
          is_pinned: false,
          pinned_at: null,
          pinned_by: null,
          pin_reason: null,
        })
        .eq('id', noteId)
        .eq('tenant_id', tenantId);

      if (updateError) throw updateError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.orderNotes.pinned(tenantId) });
      toast.success('Note unpinned from dashboard');
    },
    onError: (err) => {
      logger.error('Failed to unpin order note', err, {
        component: 'usePinnedOrderNotes',
      });
      toast.error('Failed to unpin note', { description: humanizeError(err) });
    },
  });

  return {
    pinnedNotes,
    isLoading,
    error,
    refetch,
    pinNote: pinNoteMutation.mutate,
    unpinNote: unpinNoteMutation.mutate,
    isPinning: pinNoteMutation.isPending,
    isUnpinning: unpinNoteMutation.isPending,
  };
}
