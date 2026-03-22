import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { toast } from 'sonner';
import { humanizeError } from '@/lib/humanizeError';
import { logger } from '@/lib/logger';
import { queryKeys } from '@/lib/queryKeys';
import { useCreditGatedAction } from '@/hooks/useCreditGatedAction';

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
        retry: 2,
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

/**
 * Pre-configured hook for credit-gated vendor creation.
 * Uses 'vendor_add' action key (5 credits).
 */
export function useCreditGatedCreateVendor() {
    const creditGated = useCreditGatedAction();
    const { tenant } = useTenantAdminAuth();
    const queryClient = useQueryClient();
    const [isCreating, setIsCreating] = useState(false);

    const createVendor = useCallback(
        async (
            vendor: Omit<Vendor, 'id' | 'created_at'>,
            options?: {
                onSuccess?: (data: unknown) => void;
                onError?: (error: Error) => void;
            }
        ) => {
            if (!tenant?.id) {
                const err = new Error('No tenant ID');
                options?.onError?.(err);
                return null;
            }

            setIsCreating(true);
            try {
                const result = await creditGated.execute({
                    actionKey: 'vendor_add',
                    action: async () => {
                        const { data, error } = await supabase
                            .from('vendors')
                            .insert([{
                                name: vendor.name,
                                contact_name: vendor.contact_name,
                                contact_email: vendor.email,
                                contact_phone: vendor.phone,
                                address: vendor.address,
                                account_id: tenant.id,
                            }])
                            .select()
                            .maybeSingle();

                        if (error) throw error;
                        return data;
                    },
                    referenceType: 'vendor',
                    onSuccess: (data) => {
                        queryClient.invalidateQueries({ queryKey: queryKeys.vendors.all });
                        toast.success('Vendor created successfully');
                        options?.onSuccess?.(data);
                    },
                    onError: (error) => {
                        logger.error('Failed to create vendor', { error });
                        toast.error('Failed to create vendor', { description: humanizeError(error) });
                        options?.onError?.(error);
                    },
                });

                return result;
            } finally {
                setIsCreating(false);
            }
        },
        [creditGated, tenant?.id, queryClient]
    );

    return {
        createVendor,
        isCreating: isCreating || creditGated.isExecuting,
        showOutOfCreditsModal: creditGated.showOutOfCreditsModal,
        closeOutOfCreditsModal: creditGated.closeOutOfCreditsModal,
        blockedAction: creditGated.blockedAction,
        balance: creditGated.balance,
        isFreeTier: creditGated.isFreeTier,
    };
}
