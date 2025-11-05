import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';

export function useRealtimeShifts(tenantId: string | undefined) {
  const { loading } = useTenantAdminAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    // Guard: Don't subscribe if auth is still loading or tenantId not available
    if (loading || !tenantId) {
      console.log('[useRealtimeShifts] Waiting for authentication...', { loading, hasTenantId: !!tenantId });
      return;
    }

    console.log('[useRealtimeShifts] Authentication verified, establishing realtime subscription');

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
      console.log('[useRealtimeShifts] Cleaning up realtime subscription');
      supabase.removeChannel(channel);
    };
  }, [loading, tenantId, queryClient]);
}

export function useRealtimeTransactions(tenantId: string | undefined, shiftId?: string) {
  const { loading } = useTenantAdminAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    // Guard: Don't subscribe if auth is still loading or tenantId not available
    if (loading || !tenantId) {
      console.log('[useRealtimeTransactions] Waiting for authentication...', { loading, hasTenantId: !!tenantId });
      return;
    }

    console.log('[useRealtimeTransactions] Authentication verified, establishing realtime subscription');

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
      console.log('[useRealtimeTransactions] Cleaning up realtime subscription');
      supabase.removeChannel(channel);
    };
  }, [loading, tenantId, shiftId, queryClient]);
}

export function useRealtimeCashDrawer(shiftId: string | undefined) {
  const { loading } = useTenantAdminAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    // Guard: Don't subscribe if auth is still loading or shiftId not available
    if (loading || !shiftId) {
      console.log('[useRealtimeCashDrawer] Waiting for authentication...', { loading, hasShiftId: !!shiftId });
      return;
    }

    console.log('[useRealtimeCashDrawer] Authentication verified, establishing realtime subscription');

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
      console.log('[useRealtimeCashDrawer] Cleaning up realtime subscription');
      supabase.removeChannel(channel);
    };
  }, [loading, shiftId, queryClient]);
}
