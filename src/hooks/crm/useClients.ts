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
                .select('*')
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
                .select('*')
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
        onMutate: async (values: { account_id?: string; name: string; email?: string | null; phone?: string | null; status?: string }) => {
            await queryClient.cancelQueries({ queryKey: crmClientKeys.lists() });
            const previousClients = queryClient.getQueriesData<CRMClient[]>({ queryKey: crmClientKeys.lists() });

            const optimisticClient = {
                id: `temp-${Date.now()}`,
                account_id: values.account_id || accountId || '',
                name: values.name,
                email: values.email || null,
                phone: values.phone || null,
                status: values.status || 'active',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            } as CRMClient;

            queryClient.setQueriesData<CRMClient[]>(
                { queryKey: crmClientKeys.lists() },
                (old) => old ? [optimisticClient, ...old] : [optimisticClient]
            );

            return { previousClients };
        },
        onError: (error: unknown, _variables: unknown, context: { previousClients?: [unknown, CRMClient[] | undefined][] } | undefined) => {
            if (context?.previousClients) {
                context.previousClients.forEach(([queryKey, data]) => {
                    queryClient.setQueryData(queryKey as readonly unknown[], data);
                });
            }
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger.error('Client creation failed', error, { component: 'useCreateClient' });
            toast.error('Client creation failed', { description: errorMessage });
        },
        onSuccess: () => {
            toast.success('Client created successfully');
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: crmClientKeys.lists() });
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
        onMutate: async ({ id, values }) => {
            await queryClient.cancelQueries({ queryKey: crmClientKeys.lists() });
            await queryClient.cancelQueries({ queryKey: crmClientKeys.detail(id) });

            const previousLists = queryClient.getQueriesData<CRMClient[]>({ queryKey: crmClientKeys.lists() });
            const previousDetail = queryClient.getQueryData<CRMClient>(crmClientKeys.detail(id));

            queryClient.setQueriesData<CRMClient[]>(
                { queryKey: crmClientKeys.lists() },
                (old) => old?.map(client =>
                    client.id === id ? { ...client, ...values, updated_at: new Date().toISOString() } : client
                )
            );

            if (previousDetail) {
                queryClient.setQueryData<CRMClient>(
                    crmClientKeys.detail(id),
                    { ...previousDetail, ...values, updated_at: new Date().toISOString() }
                );
            }

            return { previousLists, previousDetail, clientId: id };
        },
        onError: (error: unknown, _variables: unknown, context: { previousLists?: [unknown, CRMClient[] | undefined][]; previousDetail?: CRMClient; clientId?: string } | undefined) => {
            if (context?.previousLists) {
                context.previousLists.forEach(([queryKey, data]) => {
                    queryClient.setQueryData(queryKey as readonly unknown[], data);
                });
            }
            if (context?.previousDetail && context.clientId) {
                queryClient.setQueryData(crmClientKeys.detail(context.clientId), context.previousDetail);
            }
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger.error('Client update failed', error, { component: 'useUpdateClient' });
            toast.error('Client update failed', { description: errorMessage });
        },
        onSuccess: () => {
            toast.success('Client updated successfully');
        },
        onSettled: (_data: unknown, _error: unknown, variables: { id: string; values: Partial<ClientFormValues> } | undefined) => {
            queryClient.invalidateQueries({ queryKey: crmClientKeys.lists() });
            if (variables) {
                queryClient.invalidateQueries({ queryKey: crmClientKeys.detail(variables.id) });
            }
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
        onMutate: async (clientId) => {
            await queryClient.cancelQueries({ queryKey: crmClientKeys.lists() });
            const previousClients = queryClient.getQueriesData<CRMClient[]>({ queryKey: crmClientKeys.lists() });

            // Optimistically remove from active lists
            queryClient.setQueriesData<CRMClient[]>(
                { queryKey: crmClientKeys.lists() },
                (old) => old?.filter(client => client.id !== clientId)
            );

            return { previousClients };
        },
        onError: (error: unknown, _clientId: unknown, context: { previousClients?: [unknown, CRMClient[] | undefined][] } | undefined) => {
            if (context?.previousClients) {
                context.previousClients.forEach(([queryKey, data]) => {
                    queryClient.setQueryData(queryKey as readonly unknown[], data);
                });
            }
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger.error('Client archive failed', error, { component: 'useArchiveClient' });
            toast.error('Client archive failed', { description: errorMessage });
        },
        onSuccess: () => {
            toast.success('Client archived successfully');
        },
        onSettled: (_data: unknown, _error: unknown, clientId: string | undefined) => {
            queryClient.invalidateQueries({ queryKey: crmClientKeys.lists() });
            if (clientId) {
                queryClient.invalidateQueries({ queryKey: crmClientKeys.detail(clientId) });
            }
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
        onMutate: async (clientId) => {
            await queryClient.cancelQueries({ queryKey: crmClientKeys.lists() });
            const previousClients = queryClient.getQueriesData<CRMClient[]>({ queryKey: crmClientKeys.lists() });

            // Optimistically update status in cached lists
            queryClient.setQueriesData<CRMClient[]>(
                { queryKey: crmClientKeys.lists() },
                (old) => old?.map(client =>
                    client.id === clientId ? { ...client, status: 'active' } : client
                )
            );

            return { previousClients };
        },
        onError: (error: unknown, _clientId: unknown, context: { previousClients?: [unknown, CRMClient[] | undefined][] } | undefined) => {
            if (context?.previousClients) {
                context.previousClients.forEach(([queryKey, data]) => {
                    queryClient.setQueryData(queryKey as readonly unknown[], data);
                });
            }
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger.error('Client restore failed', error, { component: 'useRestoreClient' });
            toast.error('Client restore failed', { description: errorMessage });
        },
        onSuccess: () => {
            toast.success('Client restored successfully');
        },
        onSettled: (_data: unknown, _error: unknown, clientId: string | undefined) => {
            queryClient.invalidateQueries({ queryKey: crmClientKeys.lists() });
            if (clientId) {
                queryClient.invalidateQueries({ queryKey: crmClientKeys.detail(clientId) });
            }
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
                .select('*')
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
