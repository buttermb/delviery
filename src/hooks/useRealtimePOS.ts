import { logger } from '@/lib/logger';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useVerification } from '@/contexts/VerificationContext';

export function useRealtimeShifts(tenantId: string | undefined) {
  const { loading } = useTenantAdminAuth();
  const { isVerified, isVerifying } = useVerification();
  const queryClient = useQueryClient();

  useEffect(() => {
    // Guard 1: Don't subscribe if auth is still loading or tenantId not available
    if (loading || !tenantId) {
      logger.debug('Waiting for authentication', { loading, hasTenantId: !!tenantId, component: 'useRealtimeShifts' });
      return;
    }

    // Guard 2: Don't subscribe until verification is complete
    if (!isVerified || isVerifying) {
      logger.debug('Waiting for verification to complete', { isVerified, isVerifying, component: 'useRealtimeShifts' });
      return;
    }

    logger.debug('Authentication verified, establishing realtime subscription', { component: 'useRealtimeShifts' });

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
          logger.debug('Realtime subscription active', { component: 'useRealtimeShifts' });
        } else if (status === 'CHANNEL_ERROR') {
          logger.warn('Realtime subscription error', { status, component: 'useRealtimeShifts' });
          // Invalidate queries to trigger refetch
          queryClient.invalidateQueries({ queryKey: ['active-shift', tenantId] });
          queryClient.invalidateQueries({ queryKey: ['recent-shifts', tenantId] });
        } else if (status === 'TIMED_OUT') {
          logger.warn('Realtime subscription timed out', { status, component: 'useRealtimeShifts' });
          // Invalidate queries to trigger refetch
          queryClient.invalidateQueries({ queryKey: ['active-shift', tenantId] });
          queryClient.invalidateQueries({ queryKey: ['recent-shifts', tenantId] });
        }
      });

    return () => {
      logger.debug('Cleaning up realtime subscription', { component: 'useRealtimeShifts' });
      supabase.removeChannel(channel);
    };
  }, [loading, tenantId, isVerified, isVerifying, queryClient]);
}

export function useRealtimeTransactions(tenantId: string | undefined, shiftId?: string) {
  const { loading } = useTenantAdminAuth();
  const { isVerified, isVerifying } = useVerification();
  const queryClient = useQueryClient();

  useEffect(() => {
    // Guard 1: Don't subscribe if auth is still loading or tenantId not available
    if (loading || !tenantId) {
      logger.debug('Waiting for authentication', { loading, hasTenantId: !!tenantId, component: 'useRealtimeTransactions' });
      return;
    }

    // Guard 2: Don't subscribe until verification is complete
    if (!isVerified || isVerifying) {
      logger.debug('Waiting for verification to complete', { isVerified, isVerifying, component: 'useRealtimeTransactions' });
      return;
    }

    logger.debug('Authentication verified, establishing realtime subscription', { component: 'useRealtimeTransactions' });

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
          logger.debug('Realtime subscription active', { component: 'useRealtimeTransactions' });
        } else if (status === 'CHANNEL_ERROR') {
          logger.warn('Realtime subscription error', { status, component: 'useRealtimeTransactions' });
          // Invalidate queries to trigger refetch
          queryClient.invalidateQueries({ queryKey: ['pos-analytics', tenantId] });
          queryClient.invalidateQueries({ queryKey: ['shift-transactions', shiftId] });
        } else if (status === 'TIMED_OUT') {
          logger.warn('Realtime subscription timed out', { status, component: 'useRealtimeTransactions' });
          // Invalidate queries to trigger refetch
          queryClient.invalidateQueries({ queryKey: ['pos-analytics', tenantId] });
          queryClient.invalidateQueries({ queryKey: ['shift-transactions', shiftId] });
        }
      });

    return () => {
      logger.debug('Cleaning up realtime subscription', { component: 'useRealtimeTransactions' });
      supabase.removeChannel(channel);
    };
  }, [loading, tenantId, shiftId, isVerified, isVerifying, queryClient]);
}

export function useRealtimeCashDrawer(shiftId: string | undefined) {
  const { loading } = useTenantAdminAuth();
  const { isVerified, isVerifying } = useVerification();
  const queryClient = useQueryClient();

  useEffect(() => {
    // Guard 1: Don't subscribe if auth is still loading or shiftId not available
    if (loading || !shiftId) {
      logger.debug('Waiting for authentication', { loading, hasShiftId: !!shiftId, component: 'useRealtimeCashDrawer' });
      return;
    }

    // Guard 2: Don't subscribe until verification is complete
    if (!isVerified || isVerifying) {
      logger.debug('Waiting for verification to complete', { isVerified, isVerifying, component: 'useRealtimeCashDrawer' });
      return;
    }

    logger.debug('Authentication verified, establishing realtime subscription', { component: 'useRealtimeCashDrawer' });

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
          logger.debug('[useRealtimeCashDrawer] Realtime subscription active');
        } else if (status === 'CHANNEL_ERROR') {
          logger.error('[useRealtimeCashDrawer] Realtime subscription error');
          // Invalidate queries to trigger refetch
          queryClient.invalidateQueries({ queryKey: ['cash-drawer-events', shiftId] });
          queryClient.invalidateQueries({ queryKey: ['active-shift'] });
        } else if (status === 'TIMED_OUT') {
          logger.error('[useRealtimeCashDrawer] Realtime subscription timed out');
          // Invalidate queries to trigger refetch
          queryClient.invalidateQueries({ queryKey: ['cash-drawer-events', shiftId] });
          queryClient.invalidateQueries({ queryKey: ['active-shift'] });
        }
      });

    return () => {
      logger.debug('Cleaning up realtime subscription', { component: 'useRealtimeCashDrawer' });
      supabase.removeChannel(channel);
    };
  }, [loading, shiftId, isVerified, isVerifying, queryClient]);
}
