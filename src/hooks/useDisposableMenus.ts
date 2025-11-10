import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { showSuccessToast, showErrorToast } from '@/utils/toastHelpers';
import { logger } from '@/lib/logger';

export const useDisposableMenus = (tenantId?: string) => {
  return useQuery({
    queryKey: ['disposable-menus', tenantId],
    queryFn: async () => {
      let query = supabase
        .from('disposable_menus')
        .select(`
          *,
          disposable_menu_products(
            *,
            product:wholesale_inventory(*)
          ),
          menu_access_whitelist(count),
          menu_access_logs(count),
          menu_orders(*)
        `);
      
      if (tenantId) {
        query = query.eq('tenant_id', tenantId);
      }
      
      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: tenantId !== undefined,
  });
};

export const useCreateDisposableMenu = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (menuData: {
      name: string;
      description?: string;
      product_ids: string[];
      security_settings?: any;
      appearance_settings?: any;
      min_order_quantity?: number;
      max_order_quantity?: number;
      custom_prices?: Record<string, number>;
    }) => {
      const { data, error } = await supabase.functions.invoke('menu-generate', {
        body: menuData
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['disposable-menus'] });
      showSuccessToast('Menu Created', 'Encrypted menu generated successfully');
    },
    onError: (error: unknown) => {
      logger.error('Menu creation error', error, { component: 'useDisposableMenus' });
      showErrorToast('Creation Failed', error instanceof Error ? error.message : 'Could not create menu');
    }
  });
};

export const useBurnMenu = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (burnData: {
      menu_id: string;
      burn_type: 'soft' | 'hard';
      burn_reason: string;
      auto_regenerate?: boolean;
      migrate_customers?: boolean;
    }) => {
      const { data, error } = await supabase.functions.invoke('menu-burn', {
        body: burnData
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['disposable-menus'] });
      
      if (data.regenerated_menu_id && data.customers_to_notify?.length > 0) {
        showSuccessToast(
          'Menu Burned & Regenerated',
          `New menu created with ${data.customers_to_notify.length} customers migrated. Copy new links from Manage Access.`
        );
      } else if (data.regenerated_menu_id) {
        showSuccessToast(
          'Menu Burned & Regenerated',
          'New menu created successfully. Add customers from Manage Access.'
        );
      } else {
        showSuccessToast('Menu Burned', 'Menu burned and all access revoked');
      }
    },
    onError: (error: unknown) => {
      logger.error('Burn error', error, { component: 'useDisposableMenus' });
      showErrorToast('Burn Failed', error instanceof Error ? error.message : 'Could not burn menu');
    }
  });
};

export const useMenuWhitelist = (menuId: string) => {
  return useQuery({
    queryKey: ['menu-whitelist', menuId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('menu_access_whitelist')
        .select('*, customer:wholesale_clients(*)')
        .eq('menu_id', menuId)
        .order('invited_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!menuId
  });
};

export const useManageWhitelist = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (whitelistData: {
      menu_id: string;
      action: 'add' | 'revoke' | 'regenerate_token';
      customer_data?: any;
      whitelist_id?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke('menu-whitelist-manage', {
        body: whitelistData
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['menu-whitelist', variables.menu_id] });
      
      const messages = {
        add: 'Customer invited successfully',
        revoke: 'Access revoked successfully',
        regenerate_token: 'New access link generated'
      };
      
      showSuccessToast('Success', messages[variables.action]);
    },
    onError: (error: unknown) => {
      logger.error('Menu action failed', error, { component: 'useDisposableMenus' });
      showErrorToast('Action Failed', error instanceof Error ? error.message : 'Could not complete action');
    }
  });
};

export const useMenuOrders = (menuId?: string) => {
  return useQuery({
    queryKey: ['menu-orders', menuId],
    queryFn: async () => {
      let query = supabase
        .from('menu_orders')
        .select(`
          *,
          menu:disposable_menus(name),
          whitelist:menu_access_whitelist(customer_name, customer_phone)
        `)
        .order('created_at', { ascending: false });

      if (menuId) {
        query = query.eq('menu_id', menuId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    }
  });
};

export const useMenuSecurityEvents = (menuId?: string) => {
  return useQuery({
    queryKey: ['menu-security-events', menuId],
    queryFn: async () => {
      let query = supabase
        .from('menu_security_events')
        .select(`
          *,
          menu:disposable_menus(name),
          whitelist:menu_access_whitelist(customer_name)
        `)
        .order('created_at', { ascending: false })
        .limit(50);

      if (menuId) {
        query = query.eq('menu_id', menuId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    }
  });
};

export const useMenuAccessLogs = (menuId: string) => {
  return useQuery({
    queryKey: ['menu-access-logs', menuId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('menu_access_logs')
        .select(`
          *,
          whitelist:menu_access_whitelist(customer_name, customer_phone)
        `)
        .eq('menu_id', menuId)
        .order('accessed_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      return data;
    },
    enabled: !!menuId
  });
};
