import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { toast } from 'sonner';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import { humanizeError } from '@/lib/humanizeError';
import { formatCurrency } from '@/lib/formatters';

export type CashDrawerEventType = 'open' | 'close' | 'add' | 'remove' | 'payout' | 'deposit';

export interface CashDrawerEvent {
  id: string;
  tenant_id: string;
  shift_id: string;
  event_type: CashDrawerEventType;
  amount: number;
  reason: string | null;
  performed_by: string | null;
  performed_by_name: string | null;
  created_at: string;
}

export interface CashCount {
  pennies: number;
  nickels: number;
  dimes: number;
  quarters: number;
  ones: number;
  fives: number;
  tens: number;
  twenties: number;
  fifties: number;
  hundreds: number;
}

export interface CashDrawerState {
  isOpen: boolean;
  currentBalance: number;
  lastEvent: CashDrawerEvent | null;
  events: CashDrawerEvent[];
}

interface CreateEventParams {
  shiftId: string;
  eventType: CashDrawerEventType;
  amount: number;
  reason?: string;
}

/**
 * Calculate the total from a cash count
 */
export function calculateCashCountTotal(count: CashCount): number {
  return (
    count.pennies * 0.01 +
    count.nickels * 0.05 +
    count.dimes * 0.10 +
    count.quarters * 0.25 +
    count.ones * 1 +
    count.fives * 5 +
    count.tens * 10 +
    count.twenties * 20 +
    count.fifties * 50 +
    count.hundreds * 100
  );
}

/**
 * Hook for managing cash drawer operations
 * Provides queries for drawer state and mutations for drawer events
 */
export function useCashDrawer(shiftId: string | undefined) {
  const { tenant, admin } = useTenantAdminAuth();
  const queryClient = useQueryClient();
  const tenantId = tenant?.id;

  // Query for cash drawer events
  const eventsQuery = useQuery({
    queryKey: queryKeys.pos.cashDrawer.events(shiftId),
    queryFn: async (): Promise<CashDrawerEvent[]> => {
      if (!shiftId || !tenantId) return [];

      const { data, error } = await supabase
        .from('pos_cash_drawer_events')
        .select('id, tenant_id, shift_id, event_type, amount, reason, performed_by, performed_by_name, created_at')
        .eq('shift_id', shiftId)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (error) {
        logger.error('Failed to fetch cash drawer events', error, { component: 'useCashDrawer' });
        throw error;
      }

      return (data ?? []) as CashDrawerEvent[];
    },
    enabled: !!shiftId && !!tenantId,
  });

  // Calculate current drawer state from events
  const drawerState: CashDrawerState = {
    isOpen: false,
    currentBalance: 0,
    lastEvent: eventsQuery.data?.[0] || null,
    events: eventsQuery.data ?? [],
  };

  if (eventsQuery.data && eventsQuery.data.length > 0) {
    // Drawer is open if the last event wasn't a 'close'
    drawerState.isOpen = eventsQuery.data[0].event_type !== 'close';

    // Calculate balance from all events
    let balance = 0;
    for (const event of eventsQuery.data) {
      switch (event.event_type) {
        case 'open':
        case 'add':
        case 'deposit':
          balance += event.amount;
          break;
        case 'remove':
        case 'payout':
          balance -= event.amount;
          break;
        case 'close':
          // Close event amount represents final count
          break;
      }
    }
    drawerState.currentBalance = balance;
  }

  // Mutation to create a cash drawer event
  const createEventMutation = useMutation({
    mutationFn: async ({ shiftId, eventType, amount, reason }: CreateEventParams) => {
      if (!tenantId) throw new Error('Tenant ID required');

      const { data, error } = await supabase
        .from('pos_cash_drawer_events')
        .insert({
          tenant_id: tenantId,
          shift_id: shiftId,
          event_type: eventType,
          amount,
          reason: reason || null,
          performed_by: admin?.id || null,
          performed_by_name: admin?.email?.split('@')[0] || 'Unknown',
        })
        .select()
        .maybeSingle();

      if (error) {
        logger.error('Failed to create cash drawer event', error, { component: 'useCashDrawer' });
        throw error;
      }

      return data as CashDrawerEvent;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.pos.cashDrawer.events(shiftId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.pos.shifts.active(tenantId) });

      const eventLabels: Record<CashDrawerEventType, string> = {
        open: 'opened',
        close: 'closed',
        add: 'cash added',
        remove: 'cash removed',
        payout: 'payout recorded',
        deposit: 'deposit recorded',
      };

      toast.success(`Drawer ${eventLabels[data.event_type]}: ${formatCurrency(data.amount)}`);
    },
    onError: (error: Error) => {
      toast.error(humanizeError(error));
    },
  });

  // Convenience methods
  const openDrawer = (amount: number, reason?: string) => {
    if (!shiftId) return;
    return createEventMutation.mutateAsync({
      shiftId,
      eventType: 'open',
      amount,
      reason: reason || 'Drawer opened',
    });
  };

  const closeDrawer = (amount: number, reason?: string) => {
    if (!shiftId) return;
    return createEventMutation.mutateAsync({
      shiftId,
      eventType: 'close',
      amount,
      reason: reason || 'Drawer closed',
    });
  };

  const addCash = (amount: number, reason?: string) => {
    if (!shiftId) return;
    return createEventMutation.mutateAsync({
      shiftId,
      eventType: 'add',
      amount,
      reason,
    });
  };

  const removeCash = (amount: number, reason?: string) => {
    if (!shiftId) return;
    return createEventMutation.mutateAsync({
      shiftId,
      eventType: 'remove',
      amount,
      reason,
    });
  };

  const recordPayout = (amount: number, reason?: string) => {
    if (!shiftId) return;
    return createEventMutation.mutateAsync({
      shiftId,
      eventType: 'payout',
      amount,
      reason,
    });
  };

  const recordDeposit = (amount: number, reason?: string) => {
    if (!shiftId) return;
    return createEventMutation.mutateAsync({
      shiftId,
      eventType: 'deposit',
      amount,
      reason,
    });
  };

  return {
    // State
    drawerState,
    events: eventsQuery.data ?? [],
    isLoading: eventsQuery.isLoading,
    isError: eventsQuery.isError,
    isPending: createEventMutation.isPending,

    // Actions
    openDrawer,
    closeDrawer,
    addCash,
    removeCash,
    recordPayout,
    recordDeposit,
    createEvent: createEventMutation.mutate,
    createEventAsync: createEventMutation.mutateAsync,
  };
}
