import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { toast } from 'sonner';
import { humanizeError } from '@/lib/humanizeError';
import { logger } from '@/lib/logger';
import { queryKeys } from '@/lib/queryKeys';

export interface Vendor {
    id: string;
    name: string;
    contact_name?: string;
    email?: string;
    phone?: string;
    address?: string;
    created_at?: string;
}

export function useVendors() {
    const { tenant } = useTenantAdminAuth();

    return useQuery({
        queryKey: queryKeys.vendors.list(tenant?.id),
        queryFn: async () => {
            if (!tenant?.id) return [];
            const { data, error } = await supabase
                .from('vendors')
                .select('id, name, contact_name, contact_email, contact_phone, address, created_at')
                .eq('account_id', tenant.id)
                .order('name');

            if (error) throw error;

            return (data ?? []).map(v => ({
                id: v.id,
                name: v.name,
                contact_name: v.contact_name || undefined,
                email: v.contact_email || undefined,
                phone: v.contact_phone || undefined,
                address: v.address || undefined,
                created_at: v.created_at || undefined,
            }));
        },
        enabled: !!tenant?.id,
    });
}

export function useCreateVendor() {
    const { tenant } = useTenantAdminAuth();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (vendor: Omit<Vendor, 'id' | 'created_at'>) => {
            if (!tenant?.id) throw new Error('No tenant ID');

            const { data, error } = await supabase
                .from('vendors')
                .insert([{
                    name: vendor.name,
                    contact_name: vendor.contact_name,
                    contact_email: vendor.email,
                    contact_phone: vendor.phone,
                    address: vendor.address,
                    account_id: tenant.id
                }])
                .select()
                .maybeSingle();

            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.vendors.all });
            toast.success('Vendor created successfully');
        },
        onError: (error: Error) => {
            logger.error('Failed to create vendor', { error });
            toast.error('Failed to create vendor', { description: humanizeError(error) });
        },
    });
}
