import { logger } from '@/lib/logger';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { showSuccessToast, showErrorToast } from '@/utils/toastHelpers';
import { invalidateOnEvent } from '@/lib/invalidation';
import { queryKeys } from '@/lib/queryKeys';

export const useDisposableMenus = (tenantId?: string) => {
  return useQuery({
    queryKey: queryKeys.menus.list(tenantId),
    queryFn: async () => {
      // Optimized query - select specific columns, use count for orders
      let query = supabase
        .from('disposable_menus')
        .select(`
          *,
          disposable_menu_products(id, product_id, custom_price, display_order),
          menu_access_whitelist(count),
          menu_access_logs(count),
          menu_orders(id, total_amount)
        `);

      if (tenantId) {
        query = query.eq('tenant_id', tenantId);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) {
        // Log but don't throw - return empty array for graceful degradation
        logger.warn('Failed to fetch disposable menus', { error: error.message, tenantId });
        return [];
      }
      
      // Add computed stats for each menu
      return (data ?? []).map((menu: Record<string, unknown>) => ({
        ...menu,
        view_count: (menu.menu_access_logs as Array<{ count: number }> | undefined)?.[0]?.count ?? 0,
        customer_count: (menu.menu_access_whitelist as Array<{ count: number }> | undefined)?.[0]?.count ?? 0,
        order_count: Array.isArray(menu.menu_orders) ? menu.menu_orders.length : 0,
        total_revenue: Array.isArray(menu.menu_orders)
          ? menu.menu_orders.reduce((sum: number, o: { total_amount?: number }) => sum + Number(o.total_amount ?? 0), 0)
          : 0,
      }));
    },
    enabled: !!tenantId,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  });
};

export const useCreateDisposableMenu = () => {
  const queryClient = useQueryClient();

  return useMutation({
    retry: 2,
    mutationFn: async (menuData: {
      name: string;
      description?: string;
      product_ids: string[];
      security_settings?: Record<string, unknown>;
      appearance_settings?: Record<string, unknown>;
      min_order_quantity?: number;
      max_order_quantity?: number;
      custom_prices?: Record<string, number>;
      access_code: string;
      tenant_id: string;
      expiration_date?: string;
      never_expires?: boolean;
    }) => {
      // Transform product_ids and custom_prices into products array (only if products exist)
      const products = menuData.product_ids && menuData.product_ids.length > 0
        ? menuData.product_ids.map(productId => ({
          product_id: productId,
          custom_price: menuData.custom_prices?.[productId],
          display_availability: true,
          display_order: 0,
        }))
        : undefined; // Don't pass empty array, use undefined for forum menus

      // Build request body, only including optional fields if they have values
      const requestBody: Record<string, unknown> = {
        tenant_id: menuData.tenant_id,
        name: menuData.name,
        description: menuData.description,
        security_settings: menuData.security_settings || {},
        appearance_settings: menuData.appearance_settings || {},
        access_code: menuData.access_code,
        expiration_date: menuData.expiration_date,
        never_expires: menuData.never_expires ?? true,
      };

      // Only add products if provided (forum menus won't have products)
      if (products && products.length > 0) {
        requestBody.products = products;
      }

      // Only add order quantities if provided (forum menus won't have these)
      if (menuData.min_order_quantity !== undefined && menuData.min_order_quantity > 0) {
        requestBody.min_order_quantity = menuData.min_order_quantity;
      }
      if (menuData.max_order_quantity !== undefined && menuData.max_order_quantity > 0) {
        requestBody.max_order_quantity = menuData.max_order_quantity;
      }

      // Call the new encrypted menu creation edge function
      const { data, error } = await supabase.functions.invoke('create-encrypted-menu', {
        body: requestBody
      });

      if (error) throw error;

      // Check for error in response body
      if (data && typeof data === 'object' && 'error' in data && data.error) {
        const errorMessage = typeof data.error === 'string' ? data.error : 'Failed to create menu';
        throw new Error(errorMessage);
      }

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.menus.all });
      showSuccessToast(
        'Menu Created & Encrypted',
        `AES-256 encrypted menu created successfully${data?.encrypted ? ' 🔐' : ''}`
      );
    },
    onError: (error: unknown) => {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorDetails = error instanceof Error ? error.stack : String(error);

      logger.error('Menu creation error', {
        error,
        errorMessage,
        errorDetails,
        component: 'useDisposableMenus'
      });

      showErrorToast(
        'Creation Failed',
        errorMessage.includes('validation')
          ? 'Please check all required fields'
          : errorMessage
      );
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

      // Check for error in response body (some edge functions return 200 with error)
      if (data && typeof data === 'object' && 'error' in data && data.error) {
        const errorMessage = typeof data.error === 'string' ? data.error : 'Failed to burn menu';
        throw new Error(errorMessage);
      }

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.menus.all });

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
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Burn error', { error, errorMessage, component: 'useDisposableMenus' });
      showErrorToast('Burn Failed', errorMessage);
    }
  });
};

export const useMenuWhitelist = (menuId: string) => {
  return useQuery({
    queryKey: queryKeys.menuWhitelist.byMenu(menuId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('menu_access_whitelist')
        .select('id, menu_id, customer_name, customer_email, customer_phone, unique_access_token, invited_at, last_access_at, view_count, revoked_at, revoked_reason, status')
        .eq('menu_id', menuId)
        .order('invited_at', { ascending: false });

      if (error) throw error;
      return data ?? [];
    },
    enabled: !!menuId,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  });
};

export const useManageWhitelist = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (whitelistData: {
      menu_id: string;
      action: 'add' | 'revoke' | 'regenerate_token';
      customer_data?: Record<string, unknown>;
      whitelist_id?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke('menu-whitelist-manage', {
        body: whitelistData
      });

      if (error) throw error;

      // Check for error in response body (some edge functions return 200 with error)
      if (data && typeof data === 'object' && 'error' in data && data.error) {
        const errorMessage = typeof data.error === 'string' ? data.error : 'Failed to manage whitelist';
        throw new Error(errorMessage);
      }

      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.menuWhitelist.byMenu(variables.menu_id) });

      const messages = {
        add: 'Customer invited successfully',
        revoke: 'Access revoked successfully',
        regenerate_token: 'New access link generated'
      };

      showSuccessToast('Success', messages[variables.action]);
    },
    onError: (error: unknown) => {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Menu action failed', { error, errorMessage, component: 'useDisposableMenus' });
      showErrorToast('Action Failed', errorMessage);
    }
  });
};

export const useMenuOrders = (menuId?: string, tenantId?: string) => {
  return useQuery({
    queryKey: queryKeys.menuOrders.byMenu(menuId, tenantId),
    queryFn: async () => {
      if (!tenantId) return [];

      let query = supabase
        .from('menu_orders')
        .select(`
          id, menu_id, tenant_id, contact_phone, status, total_amount, order_data, created_at, converted_to_invoice_id,
          menu:disposable_menus(name)
        `)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(100);

      if (menuId) {
        query = query.eq('menu_id', menuId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
    // Performance: cache for 15 seconds (orders change more frequently)
    staleTime: 15 * 1000,
    gcTime: 2 * 60 * 1000,
  });
};

export const useUpdateOrderStatus = (tenantId?: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ orderId, status }: { orderId: string; status: string }) => {
      const { data, error } = await supabase
        .from('menu_orders')
        .update({ status: status as 'pending' | 'confirmed' | 'preparing' | 'ready' | 'delivered' | 'cancelled' })
        .eq('id', orderId)
        .select()
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.menuOrders.all });
      showSuccessToast('Order Updated', `Order marked as ${variables.status}`);

      // Cross-panel invalidation - menu order status affects dashboard, orders list
      if (tenantId) {
        invalidateOnEvent(queryClient, 'ORDER_STATUS_CHANGED', tenantId, {
          orderId: variables.orderId,
        });
      }
    },
    onError: (error: unknown) => {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Order status update failed', { error, errorMessage, component: 'useDisposableMenus' });
      showErrorToast('Update Failed', errorMessage);
    }
  });
};

export const useMenuSecurityEvents = (menuId?: string, tenantId?: string) => {
  return useQuery({
    queryKey: queryKeys.menuSecurityEvents.byMenu(menuId, tenantId),
    queryFn: async () => {
      if (!tenantId) return [];

      let query = supabase
        .from('menu_security_events')
        .select(`
          *,
          menu:disposable_menus(name)
        `)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (menuId) {
        query = query.eq('menu_id', menuId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
    staleTime: 60 * 1000, // Security events change less frequently
    gcTime: 10 * 60 * 1000,
  });
};

export const useMenuAccessLogs = (menuId: string) => {
  return useQuery({
    queryKey: queryKeys.menuAccessLogs.byMenu(menuId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('menu_access_logs')
        .select('id, menu_id, access_whitelist_id, accessed_at, ip_address, user_agent, device_fingerprint, location, access_code_correct, geofence_pass, time_restriction_pass, suspicious_flags, actions_taken, session_duration_seconds')
        .eq('menu_id', menuId)
        .order('accessed_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      return data;
    },
    enabled: !!menuId,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  });
};
