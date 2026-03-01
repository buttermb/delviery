import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { logger } from '@/lib/logger';
import { queryKeys } from '@/lib/queryKeys';
import { formatCurrency } from '@/lib/formatters';

interface WholesaleClient {
  id: string;
  business_name: string;
  contact_name: string;
  credit_limit: number;
  outstanding_balance: number;
  status: string;
  address?: string;
  phone?: string;
  email?: string;
  is_favorite?: boolean;
}

interface ClientSuggestion extends WholesaleClient {
  suggestion_reason: string;
  suggestion_type: 'recurring' | 'overdue' | 'high_value' | 'favorite' | 'recent_activity';
  priority: number;
  last_order_date?: string;
  order_frequency_days?: number;
  days_since_last_order?: number;
}

/**
 * Hook to provide smart client suggestions based on:
 * - Order frequency patterns (recurring orders)
 * - Overdue balances that need attention
 * - High-value clients
 * - Favorited clients
 * - Recent activity
 */
export function useClientSuggestions() {
  const { tenant } = useTenantAdminAuth();

  // Fetch all clients with their order history summary
  const { data: clientsWithHistory = [], isLoading } = useQuery({
    queryKey: queryKeys.clientSuggestions.byTenant(tenant?.id),
    queryFn: async () => {
      if (!tenant?.id) return [];

      // Fetch clients
      const { data: clients, error: clientsError } = await supabase
        .from('wholesale_clients')
        .select('*')
        .eq('tenant_id', tenant.id)
        .eq('status', 'active');

      if (clientsError) {
        logger.error('Failed to fetch clients for suggestions', clientsError, { component: 'useClientSuggestions' });
        return [];
      }

      // Fetch order history for each client
      const clientsWithOrders = await Promise.all(
        (clients ?? []).map(async (client) => {
          const { data: orders } = await supabase
            .from('wholesale_orders')
            .select('created_at, total_amount')
            .eq('client_id', client.id)
            .order('created_at', { ascending: false })
            .limit(10);

          // Calculate order frequency
          let orderFrequencyDays: number | undefined;
          let daysSinceLastOrder: number | undefined;

          if (orders && orders.length >= 2) {
            const orderDates = orders.map(o => new Date(o.created_at).getTime());
            const intervals: number[] = [];
            
            for (let i = 0; i < orderDates.length - 1; i++) {
              const daysBetween = (orderDates[i] - orderDates[i + 1]) / (1000 * 60 * 60 * 24);
              intervals.push(daysBetween);
            }
            
            if (intervals.length > 0) {
              orderFrequencyDays = Math.round(intervals.reduce((a, b) => a + b, 0) / intervals.length);
            }
          }

          if (orders && orders.length > 0) {
            daysSinceLastOrder = Math.floor(
              (Date.now() - new Date(orders[0].created_at).getTime()) / (1000 * 60 * 60 * 24)
            );
          }

          return {
            ...client,
            last_order_date: orders?.[0]?.created_at,
            last_order_amount: orders?.[0]?.total_amount,
            order_count: orders?.length ?? 0,
            order_frequency_days: orderFrequencyDays,
            days_since_last_order: daysSinceLastOrder,
            total_order_value: orders?.reduce((sum, o) => sum + Number(o.total_amount ?? 0), 0) ?? 0,
          };
        })
      );

      return clientsWithOrders;
    },
    enabled: !!tenant?.id,
    staleTime: 1000 * 60 * 10, // 10 minutes
  });

  // Generate smart suggestions
  const suggestions = useMemo((): ClientSuggestion[] => {
    const suggestions: ClientSuggestion[] = [];

    clientsWithHistory.forEach((client) => {
      // Recurring order pattern - due for reorder
      if (client.order_frequency_days && client.days_since_last_order !== undefined) {
        const daysOverdue = client.days_since_last_order - client.order_frequency_days;
        if (daysOverdue >= -3 && daysOverdue <= 14) {
          // Within 3 days of expected or up to 2 weeks overdue
          let reason = '';
          if (daysOverdue < 0) {
            reason = `Usually orders every ${client.order_frequency_days} days - due in ${Math.abs(daysOverdue)} days`;
          } else if (daysOverdue === 0) {
            reason = `Usually orders every ${client.order_frequency_days} days - due today`;
          } else {
            reason = `Usually orders every ${client.order_frequency_days} days - ${daysOverdue} days overdue`;
          }

          suggestions.push({
            ...client,
            suggestion_reason: reason,
            suggestion_type: 'recurring',
            priority: daysOverdue >= 0 ? 10 - Math.min(daysOverdue, 5) : 8 + daysOverdue,
          });
        }
      }

      // Overdue balance
      if (client.outstanding_balance > 0) {
        const percentOfLimit = (client.outstanding_balance / client.credit_limit) * 100;
        if (percentOfLimit >= 50) {
          suggestions.push({
            ...client,
            suggestion_reason: `Outstanding balance: ${formatCurrency(client.outstanding_balance)} (${percentOfLimit.toFixed(0)}% of limit)`,
            suggestion_type: 'overdue',
            priority: Math.min(percentOfLimit / 10, 10),
          });
        }
      }

      // High-value clients (top performers)
      if (client.total_order_value > 50000 || client.order_count >= 10) {
        suggestions.push({
          ...client,
          suggestion_reason: `High-value client: ${client.order_count} orders, ${formatCurrency(client.total_order_value)} total`,
          suggestion_type: 'high_value',
          priority: 5,
        });
      }

      // Favorite clients
      if ((client as unknown as { is_favorite?: boolean }).is_favorite) {
        suggestions.push({
          ...client,
          suggestion_reason: 'Starred client',
          suggestion_type: 'favorite',
          priority: 8,
        });
      }
    });

    // Sort by priority (descending) and deduplicate
    const seen = new Set<string>();
    return suggestions
      .sort((a, b) => b.priority - a.priority)
      .filter(s => {
        if (seen.has(s.id)) return false;
        seen.add(s.id);
        return true;
      })
      .slice(0, 10);
  }, [clientsWithHistory]);

  // Separate into categories
  const recurringClients = suggestions.filter(s => s.suggestion_type === 'recurring');
  const overdueClients = suggestions.filter(s => s.suggestion_type === 'overdue');
  const favoriteClients = suggestions.filter(s => s.suggestion_type === 'favorite');
  const highValueClients = suggestions.filter(s => s.suggestion_type === 'high_value');

  return {
    suggestions,
    recurringClients,
    overdueClients,
    favoriteClients,
    highValueClients,
    allClients: clientsWithHistory as WholesaleClient[],
    isLoading,
  };
}

/**
 * Hook to toggle a client's favorite status
 */
export function useToggleClientFavorite() {
  const { tenant } = useTenantAdminAuth();

  const toggleFavorite = async (clientId: string, isFavorite: boolean) => {
    if (!tenant?.id) return false;
    try {
      const { error } = await supabase
        .from('wholesale_clients')
        .update({ is_favorite: isFavorite })
        .eq('id', clientId)
        .eq('tenant_id', tenant.id);

      if (error) throw error;
      return true;
    } catch (error) {
      logger.error('Failed to toggle client favorite', error, { component: 'useToggleClientFavorite' });
      return false;
    }
  };

  return { toggleFavorite };
}

