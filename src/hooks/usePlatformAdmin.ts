import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/lib/queryKeys';

export function usePlatformAdmin() {
    const { data, isLoading, error } = useQuery({
        queryKey: queryKeys.platformAdmin.check(),
        queryFn: async () => {
            const { data, error } = await (supabase as any).rpc('check_platform_admin_access');
            if (error) throw error;
            return data as { access: boolean; role?: string };
        },
        staleTime: 1000 * 60 * 5, // Check every 5 minutes
        retry: false,
    });

    return {
        isPlatformAdmin: data?.access ?? false,
        role: data?.role,
        isLoading,
        error
    };
}
