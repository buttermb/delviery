// @ts-nocheck
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function usePlatformAdmin() {
    const { data, isLoading, error } = useQuery({
        queryKey: ['platform-admin-check'],
        queryFn: async () => {
            const { data, error } = await supabase.rpc('check_platform_admin_access');
            if (error) throw error;
            return data as { access: boolean; role?: string };
        },
        staleTime: 1000 * 60 * 5, // Check every 5 minutes
        retry: false,
    });

    return {
        isPlatformAdmin: data?.access || false,
        role: data?.role,
        isLoading,
        error
    };
}
