import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { safeStorage, STORAGE_KEYS } from '@/constants/storageKeys';
import { logger } from '@/lib/logger';
import { queryKeys } from '@/lib/queryKeys';

interface RecentClient {
  id: string;
  business_name: string;
  contact_name: string;
  last_accessed: string;
}

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
  last_order_date?: string;
  last_order_amount?: number;
}

const MAX_RECENT_CLIENTS = 5;

/**
 * Hook to track and retrieve recently accessed wholesale clients
 * Combines localStorage for quick access with database queries for full data
 */
export function useRecentClients() {
  const { tenant } = useTenantAdminAuth();
  const [recentClientIds, setRecentClientIds] = useState<RecentClient[]>([]);

  // Load recent client IDs from localStorage on mount
  useEffect(() => {
    try {
      const stored = safeStorage.getItem(STORAGE_KEYS.RECENT_WHOLESALE_CLIENTS);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Filter by tenant if stored data includes tenant
        const filtered = parsed.filter((c: RecentClient & { tenantId?: string }) => 
          !c.tenantId || c.tenantId === tenant?.id
        );
        setRecentClientIds(filtered.slice(0, MAX_RECENT_CLIENTS));
      }
    } catch {
      logger.warn('Failed to load recent clients from storage', { component: 'useRecentClients' });
    }
  }, [tenant?.id]);

  // Fetch full client data for recent client IDs
  const { data: recentClients = [], isLoading } = useQuery({
    queryKey: queryKeys.recentWholesaleClients.byTenant(tenant?.id, recentClientIds.map(c => c.id)),
    queryFn: async () => {
      if (!tenant?.id || recentClientIds.length === 0) return [];

      const clientIds = recentClientIds.map(c => c.id);
      
      // Fetch clients with their last order info
      const { data: clients, error } = await supabase
        .from('wholesale_clients')
        .select('id, business_name, contact_name, credit_limit, outstanding_balance, status, address, phone, email')
        .eq('tenant_id', tenant.id)
        .in('id', clientIds);

      if (error) {
        logger.error('Failed to fetch recent clients', error, { component: 'useRecentClients' });
        return [];
      }

      // Fetch last order for each client
      const clientsWithOrders = await Promise.all(
        (clients ?? []).map(async (client) => {
          const { data: lastOrder } = await supabase
            .from('wholesale_orders')
            .select('created_at, total_amount')
            .eq('client_id', client.id)
            .eq('tenant_id', tenant.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          return {
            ...client,
            last_order_date: lastOrder?.created_at,
            last_order_amount: lastOrder?.total_amount,
          } as WholesaleClient;
        })
      );

      // Maintain the order from recentClientIds
      return clientIds
        .map(id => clientsWithOrders.find(c => c.id === id))
        .filter(Boolean) as WholesaleClient[];
    },
    enabled: !!tenant?.id && recentClientIds.length > 0,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Add a client to recent list
  const addRecentClient = useCallback((client: { id: string; business_name: string; contact_name: string }) => {
    if (!tenant?.id) return;

    const newRecent: RecentClient & { tenantId: string } = {
      id: client.id,
      business_name: client.business_name,
      contact_name: client.contact_name,
      last_accessed: new Date().toISOString(),
      tenantId: tenant.id,
    };

    setRecentClientIds(prev => {
      // Remove if already exists, then add to front
      const filtered = prev.filter(c => c.id !== client.id);
      const updated = [newRecent, ...filtered].slice(0, MAX_RECENT_CLIENTS);

      // Persist to localStorage
      try {
        safeStorage.setItem(STORAGE_KEYS.RECENT_WHOLESALE_CLIENTS, JSON.stringify(updated));
      } catch {
        logger.warn('Failed to save recent clients to storage', { component: 'useRecentClients' });
      }

      return updated;
    });
  }, [tenant?.id]);

  // Clear recent clients
  const clearRecentClients = useCallback(() => {
    setRecentClientIds([]);
    try {
      safeStorage.removeItem(STORAGE_KEYS.RECENT_WHOLESALE_CLIENTS);
    } catch {
      logger.warn('Failed to clear recent clients from storage', { component: 'useRecentClients' });
    }
  }, []);

  return {
    recentClients,
    recentClientIds,
    isLoading,
    addRecentClient,
    clearRecentClients,
  };
}

