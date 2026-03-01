import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import { toast } from 'sonner';

export interface StaticMenuPage {
  id: string;
  name: string;
  encrypted_url_token: string;
  created_at: string;
  status: string;
  product_count: number;
}

export function useStaticMenuPages(tenantId?: string) {
  return useQuery({
    queryKey: [...queryKeys.menus.all, 'static-pages', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];

      const { data, error } = await supabase
        .from('disposable_menus')
        .select(`
          id,
          name,
          encrypted_url_token,
          created_at,
          status,
          security_settings,
          disposable_menu_products(id)
        `)
        .eq('tenant_id', tenantId)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (error) {
        logger.warn('Failed to fetch static menu pages', { error: error.message, tenantId });
        return [];
      }

      // Filter for static_page menu_type and map to our interface
      return (data ?? [])
        .filter((menu) => {
          const settings = menu.security_settings as Record<string, unknown> | null;
          return settings?.menu_type === 'static_page';
        })
        .map((menu): StaticMenuPage => ({
          id: menu.id,
          name: menu.name ?? 'Untitled',
          encrypted_url_token: menu.encrypted_url_token ?? '',
          created_at: menu.created_at ?? '',
          status: menu.status ?? 'active',
          product_count: Array.isArray(menu.disposable_menu_products)
            ? menu.disposable_menu_products.length
            : 0,
        }));
    },
    enabled: !!tenantId,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}

export function useDeleteStaticMenuPage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (menuId: string) => {
      const { error } = await supabase
        .from('disposable_menus')
        .update({
          status: 'burned' as never,
          burned_at: new Date().toISOString(),
        })
        .eq('id', menuId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.menus.all });
      toast.success('Menu page deleted');
      logger.info('Static menu page deleted', { component: 'useDeleteStaticMenuPage' });
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Failed to delete page';
      toast.error(message);
      logger.error('Failed to delete static menu page', { error: message, component: 'useDeleteStaticMenuPage' });
    },
  });
}
