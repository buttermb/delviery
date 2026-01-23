import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { CRMClient, ClientFormValues } from '@/types/crm';
import { toast } from 'sonner';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { logger } from '@/lib/logger';

/**
 * Query key factory for CRM clients
 */
export const crmClientKeys = {
    all: ['crm-clients'] as const,
    lists: () => [...crmClientKeys.all, 'list'] as const,
    list: (filters: string) => [...crmClientKeys.lists(), { filters }] as const,
    details: () => [...crmClientKeys.all, 'detail'] as const,
    detail: (id: string) => [...crmClientKeys.details(), id] as const,
};

/**
 * Fetch all clients for current account
 */
export function useClients(status?: 'active' | 'archived') {
    const { tenant } = useTenantAdminAuth();
    const accountId = tenant?.id;

    return useQuery({
        queryKey: crmClientKeys.list(status || 'all'),
        queryFn: async () => {
            if (!accountId) {
                throw new Error('Account ID is required');
            }

            let query = supabase
                .from('crm_clients')
                .select('id, account_id, name, email, phone, open_balance, status, created_at, updated_at')
                .eq('account_id', accountId)
                .order('created_at', { ascending: false });

            if (status) {
                query = query.eq('status', status);
            }

            const { data, error } = await query;

            if (error) {
                logger.error('Failed to fetch clients', error, { component: 'useClients', accountId, status });
                throw error;
            }
            return data as CRMClient[];
        },
        enabled: !!accountId,
        staleTime: 30_000,
        gcTime: 300_000,
    });
}

/**
 * Fetch a single client by ID
 */
export function useClient(clientId: string | undefined) {
    const { tenant } = useTenantAdminAuth();
    const accountId = tenant?.id;

    return useQuery({
        queryKey: crmClientKeys.detail(clientId || ''),
        queryFn: async () => {
            if (!clientId || !accountId) return null;

            const { data, error } = await supabase
                .from('crm_clients')
                .select('id, account_id, name, email, phone, open_balance, status, portal_password_hash, portal_last_login, notified_about_menu_update, created_at, updated_at')
                .eq('id', clientId)
                .eq('account_id', accountId)
                .maybeSingle();

            if (error) {
                logger.error('Failed to fetch client', error, { component: 'useClient', clientId, accountId });
                throw error;
            }
            return data as CRMClient;
        },
        enabled: !!clientId && !!accountId,
        staleTime: 30_000,
        gcTime: 300_000,
    });
}

/**
 * Create a new client
 */
export function useCreateClient() {
    const queryClient = useQueryClient();
    const { tenant } = useTenantAdminAuth();
    const accountId = tenant?.id;

    return useMutation({
        mutationFn: async (values: ClientFormValues & { account_id?: string }) => {
            const finalAccountId = values.account_id || accountId;

            if (!finalAccountId) {
                throw new Error('Account ID is required to create a client');
            }

            const { data, error } = await supabase
                .from('crm_clients')
                .insert({
                    account_id: finalAccountId,
                    name: values.name,
                    email: values.email || null,
                    phone: values.phone || null,
                    status: values.status || 'active',
                })
                .select()
                .maybeSingle();

            if (error) {
                logger.error('Failed to create client', error, { component: 'useCreateClient', accountId: finalAccountId, values });
                throw error;
            }
            return data as CRMClient;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: crmClientKeys.lists() });
            toast.success('Client created successfully');
        },
        onError: (error: unknown) => {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger.error('Client creation failed', error, { component: 'useCreateClient' });
            toast.error(`Failed to create client: ${errorMessage}`);
        },
    });
}

/**
 * Update an existing client
 */
export function useUpdateClient() {
    const queryClient = useQueryClient();
    const { tenant } = useTenantAdminAuth();
    const accountId = tenant?.id;

    return useMutation({
        mutationFn: async ({ id, values }: { id: string; values: Partial<ClientFormValues> }) => {
            if (!accountId) {
                throw new Error('Account ID is required to update a client');
            }

            const { data, error } = await supabase
                .from('crm_clients')
                .update({
                    name: values.name,
                    email: values.email || null,
                    phone: values.phone || null,
                    status: values.status,
                })
                .eq('id', id)
                .eq('account_id', accountId)
                .select()
                .maybeSingle();

            if (error) {
                logger.error('Failed to update client', error, { component: 'useUpdateClient', clientId: id, accountId });
                throw error;
            }
            return data as CRMClient;
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: crmClientKeys.lists() });
            queryClient.invalidateQueries({ queryKey: crmClientKeys.detail(variables.id) });
            toast.success('Client updated successfully');
        },
        onError: (error: unknown) => {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger.error('Client update failed', error, { component: 'useUpdateClient' });
            toast.error(`Failed to update client: ${errorMessage}`);
        },
    });
}

/**
 * Archive a client (soft delete)
 */
export function useArchiveClient() {
    const queryClient = useQueryClient();
    const { tenant } = useTenantAdminAuth();
    const accountId = tenant?.id;

    return useMutation({
        mutationFn: async (clientId: string) => {
            if (!accountId) {
                throw new Error('Account ID is required to archive a client');
            }

            const { data, error } = await supabase
                .from('crm_clients')
                .update({ status: 'archived' })
                .eq('id', clientId)
                .eq('account_id', accountId)
                .select()
                .maybeSingle();

            if (error) {
                logger.error('Failed to archive client', error, { component: 'useArchiveClient', clientId, accountId });
                throw error;
            }
            return data as CRMClient;
        },
        onSuccess: (_, clientId) => {
            queryClient.invalidateQueries({ queryKey: crmClientKeys.lists() });
            queryClient.invalidateQueries({ queryKey: crmClientKeys.detail(clientId) });
            toast.success('Client archived successfully');
        },
        onError: (error: unknown) => {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger.error('Client archive failed', error, { component: 'useArchiveClient' });
            toast.error(`Failed to archive client: ${errorMessage}`);
        },
    });
}

/**
 * Restore an archived client
 */
export function useRestoreClient() {
    const queryClient = useQueryClient();
    const { tenant } = useTenantAdminAuth();
    const accountId = tenant?.id;

    return useMutation({
        mutationFn: async (clientId: string) => {
            if (!accountId) {
                throw new Error('Account ID is required to restore a client');
            }

            const { data, error } = await supabase
                .from('crm_clients')
                .update({ status: 'active' })
                .eq('id', clientId)
                .eq('account_id', accountId)
                .select()
                .maybeSingle();

            if (error) {
                logger.error('Failed to restore client', error, { component: 'useRestoreClient', clientId, accountId });
                throw error;
            }
            return data as CRMClient;
        },
        onSuccess: (_, clientId) => {
            queryClient.invalidateQueries({ queryKey: crmClientKeys.lists() });
            queryClient.invalidateQueries({ queryKey: crmClientKeys.detail(clientId) });
            toast.success('Client restored successfully');
        },
        onError: (error: unknown) => {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger.error('Client restore failed', error, { component: 'useRestoreClient' });
            toast.error(`Failed to restore client: ${errorMessage}`);
        },
    });
}

/**
 * Search clients by name, email, or phone
 */
export function useSearchClients(searchTerm: string) {
    const { tenant } = useTenantAdminAuth();
    const accountId = tenant?.id;

    return useQuery({
        queryKey: [...crmClientKeys.lists(), 'search', searchTerm],
        queryFn: async () => {
            if (!searchTerm || searchTerm.length < 2 || !accountId) {
                return [];
            }

            const { data, error } = await supabase
                .from('crm_clients')
                .select('id, account_id, name, email, phone, open_balance, status, created_at, updated_at')
                .eq('account_id', accountId)
                .or(`name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%`)
                .limit(10);

            if (error) {
                logger.error('Failed to search clients', error, { component: 'useSearchClients', searchTerm, accountId });
                throw error;
            }
            return data as CRMClient[];
        },
        enabled: searchTerm.length >= 2 && !!accountId,
    });
}
