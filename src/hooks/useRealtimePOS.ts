import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';

export function useRealtimeShifts(tenantId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!tenantId) return;

    const channel = supabase
      .channel('pos-shifts-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'pos_shifts',
          filter: `tenant_id=eq.${tenantId}`,
        },
        () => {
          // Invalidate all shift-related queries
          queryClient.invalidateQueries({ queryKey: ['active-shift', tenantId] });
          queryClient.invalidateQueries({ queryKey: ['recent-shifts', tenantId] });
          queryClient.invalidateQueries({ queryKey: ['closed-shifts', tenantId] });
          queryClient.invalidateQueries({ queryKey: ['pos-shifts-summary', tenantId] });
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[useRealtimeShifts] Realtime subscription active');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('[useRealtimeShifts] Realtime subscription error');
          // Invalidate queries to trigger refetch
          queryClient.invalidateQueries({ queryKey: ['active-shift', tenantId] });
          queryClient.invalidateQueries({ queryKey: ['recent-shifts', tenantId] });
        } else if (status === 'TIMED_OUT') {
          console.error('[useRealtimeShifts] Realtime subscription timed out');
          // Invalidate queries to trigger refetch
          queryClient.invalidateQueries({ queryKey: ['active-shift', tenantId] });
          queryClient.invalidateQueries({ queryKey: ['recent-shifts', tenantId] });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenantId, queryClient]);
}

export function useRealtimeTransactions(tenantId: string | undefined, shiftId?: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!tenantId) return;

    let filter = `tenant_id=eq.${tenantId}`;
    if (shiftId) {
      filter += `,shift_id=eq.${shiftId}`;
    }

    const channel = supabase
      .channel('pos-transactions-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'pos_transactions',
          filter,
        },
        () => {
          // Invalidate transaction-related queries
          queryClient.invalidateQueries({ queryKey: ['pos-analytics', tenantId] });
          queryClient.invalidateQueries({ queryKey: ['shift-transactions', shiftId] });
          queryClient.invalidateQueries({ queryKey: ['active-shift', tenantId] });
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[useRealtimeTransactions] Realtime subscription active');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('[useRealtimeTransactions] Realtime subscription error');
          // Invalidate queries to trigger refetch
          queryClient.invalidateQueries({ queryKey: ['pos-analytics', tenantId] });
          queryClient.invalidateQueries({ queryKey: ['shift-transactions', shiftId] });
        } else if (status === 'TIMED_OUT') {
          console.error('[useRealtimeTransactions] Realtime subscription timed out');
          // Invalidate queries to trigger refetch
          queryClient.invalidateQueries({ queryKey: ['pos-analytics', tenantId] });
          queryClient.invalidateQueries({ queryKey: ['shift-transactions', shiftId] });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenantId, shiftId, queryClient]);
}

export function useRealtimeCashDrawer(shiftId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!shiftId) return;

    const channel = supabase
      .channel('cash-drawer-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'pos_cash_drawer_events',
          filter: `shift_id=eq.${shiftId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['cash-drawer-events', shiftId] });
          queryClient.invalidateQueries({ queryKey: ['active-shift'] });
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[useRealtimeCashDrawer] Realtime subscription active');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('[useRealtimeCashDrawer] Realtime subscription error');
          // Invalidate queries to trigger refetch
          queryClient.invalidateQueries({ queryKey: ['cash-drawer-events', shiftId] });
          queryClient.invalidateQueries({ queryKey: ['active-shift'] });
        } else if (status === 'TIMED_OUT') {
          console.error('[useRealtimeCashDrawer] Realtime subscription timed out');
          // Invalidate queries to trigger refetch
          queryClient.invalidateQueries({ queryKey: ['cash-drawer-events', shiftId] });
          queryClient.invalidateQueries({ queryKey: ['active-shift'] });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [shiftId, queryClient]);
}
