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
      .subscribe();

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
      .subscribe();

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
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [shiftId, queryClient]);
}
